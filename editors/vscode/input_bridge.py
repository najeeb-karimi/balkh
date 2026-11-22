"""Extension-owned stdin adapter; ordinary CLI and terminal runs stay native."""

from io import TextIOBase
import json
from operator import index
import os
import runpy
import sys


class _Output:
    def __init__(self, stream):
        self.stream = stream
        self.tail = ""

    def write(self, text):
        result = self.stream.write(text)
        self.tail = (self.tail + text[-512:]).rsplit("\n", 1)[-1][-512:]
        return result

    def __getattr__(self, name):
        return getattr(self.stream, name)


class _Input(TextIOBase):
    def __init__(self, raw, output, token):
        self.raw = raw
        self.output = output
        self.prefix = "\x1eBALKH_INPUT:" + token + ":"
        self.sequence = 0
        self.pending = ""
        self.eof = False

    @property
    def encoding(self):
        return "utf-8"

    def readable(self):
        return True

    def _fill(self):
        self.sequence += 1
        self.output.flush()
        request = {"type": "input", "id": self.sequence, "prompt": self.output.tail}
        # Use stdout for both text and control frames so a prompt is displayed
        # before its input request, even when pipe reads split or combine writes.
        self.output.stream.write(self.prefix + json.dumps(request) + "\x1f")
        self.output.stream.flush()
        line = self.raw.readline()
        if not line:
            self.eof = True
            return
        response = json.loads(line)
        if (not isinstance(response, dict) or response.get("id") != self.sequence
                or not isinstance(response.get("value"), str)
                or not isinstance(response.get("eof"), bool)):
            raise OSError("Invalid input response from the Balkh extension")
        self.output.tail = ""
        if response["eof"]:
            self.eof = True
        else:
            self.pending += response["value"] + "\n"

    def read(self, size=-1):
        if self.closed:
            raise ValueError("I/O operation on closed file")
        size = -1 if size is None else index(size)
        while not self.eof and (size < 0 or len(self.pending) < size):
            self._fill()
        end = len(self.pending) if size < 0 else size
        value, self.pending = self.pending[:end], self.pending[end:]
        return value

    def readline(self, size=-1):
        if self.closed:
            raise ValueError("I/O operation on closed file")
        size = -1 if size is None else index(size)
        if not self.pending and not self.eof and size != 0:
            self._fill()
        newline = self.pending.find("\n")
        end = newline + 1 if newline >= 0 else len(self.pending)
        if size >= 0:
            end = min(end, size)
        value, self.pending = self.pending[:end], self.pending[end:]
        return value


def main():
    token = os.environ.pop("BALKH_INPUT_TOKEN")
    original_input, original_output = sys.stdin, sys.stdout
    output = _Output(original_output)
    sys.stdin = _Input(original_input, output, token)
    sys.stdout = output
    # Match `python -m balkh.cli`: resolve the package in the workspace/Python
    # environment, not relative to the installed extension's helper file.
    sys.path[0] = os.getcwd()
    try:
        runpy.run_module("balkh.cli", run_name="__main__", alter_sys=True)
    finally:
        output.flush()
        sys.stdin, sys.stdout = original_input, original_output


if __name__ == "__main__":
    main()
