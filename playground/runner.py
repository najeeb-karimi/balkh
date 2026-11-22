"""Small execution bridge shared by the browser worker and native tests."""

from contextlib import redirect_stderr, redirect_stdout
from io import StringIO, TextIOBase
from operator import index
import sys
from types import ModuleType

from balkh.errors import format_error
from balkh.translator import transpile


FILENAME = "<balkh:playground>"
OUTPUT_LIMIT = 100_000
TRUNCATED = "\n[Output truncated at 100,000 characters.]\n"


class _OutputBudget:
    def __init__(self, emit, flush=None):
        self.emit = emit
        self.flush = flush
        self.remaining = OUTPUT_LIMIT
        self.truncated = False

    def write(self, stream, text):
        visible = text[:self.remaining]
        if visible:
            self.remaining -= len(visible)
            self.emit(stream, visible)
        if len(text) > len(visible) and not self.truncated:
            self.truncated = True
            self.emit("stderr", TRUNCATED)


class _Output(TextIOBase):
    def __init__(self, budget, stream):
        self.budget = budget
        self.stream = stream

    @property
    def encoding(self):
        return "utf-8"

    def writable(self):
        return True

    def write(self, text):
        if not isinstance(text, str):
            raise TypeError("write() argument must be str")
        self.budget.write(self.stream, text)
        return len(text)

    def flush(self):
        if self.budget.flush is not None:
            self.budget.flush()


class _Input(TextIOBase):
    """A line-at-a-time text stream; None from the callback means persistent EOF."""

    def __init__(self, read_line, flush=None):
        self._read_line = read_line
        self._flush = flush
        self._pending = ""
        self._eof = False

    @property
    def encoding(self):
        return "utf-8"

    def readable(self):
        return True

    def isatty(self):
        return True

    def _fill(self):
        if self._flush is not None:
            self._flush()
        line = self._read_line()
        if line is None:
            self._eof = True
        elif not isinstance(line, str):
            raise TypeError("input callback must return a string or None")
        else:
            self._pending += line + "\n"

    def read(self, size=-1):
        if self.closed:
            raise ValueError("I/O operation on closed file")
        size = -1 if size is None else index(size)
        while not self._eof and (size < 0 or len(self._pending) < size):
            self._fill()
        end = len(self._pending) if size < 0 else size
        value, self._pending = self._pending[:end], self._pending[end:]
        return value

    def readline(self, size=-1):
        if self.closed:
            raise ValueError("I/O operation on closed file")
        size = -1 if size is None else index(size)
        if not self._pending and not self._eof and size != 0:
            self._fill()
        newline = self._pending.find("\n")
        end = newline + 1 if newline >= 0 else len(self._pending)
        if size >= 0:
            end = min(size, end)
        value, self._pending = self._pending[:end], self._pending[end:]
        return value


def _process(source, language, stdin, emit, execute, flush=None, read_line=None):
    if language not in ("dari", "pashto"):
        raise ValueError("language must be 'dari' or 'pashto'")
    if not isinstance(source, str) or not isinstance(stdin, str):
        raise TypeError("source and stdin must be strings")
    budget = _OutputBudget(emit, flush)
    stdout = _Output(budget, "stdout")
    stderr = _Output(budget, "stderr")
    python_code = ""
    previous_stdin = sys.stdin
    missing_main = object()
    previous_main = sys.modules.get("__main__", missing_main)
    with redirect_stdout(stdout), redirect_stderr(stderr):
        try:
            python_code = transpile(source)
            code = compile(python_code, FILENAME, "exec")
            if execute:
                sys.stdin = _Input(read_line, flush) if read_line is not None else StringIO(stdin)
                # Module-aware libraries (dataclasses, pickle, and imports of
                # __main__) must see the same namespace as the user's code.
                program = ModuleType("__main__")
                program.__file__ = FILENAME
                sys.modules["__main__"] = program
                exec(code, program.__dict__)
        except BaseException as error:
            # SystemExit and KeyboardInterrupt must not kill the persistent
            # worker interpreter. Stop terminates the worker from the page.
            if isinstance(error, SystemExit) and (error.code is None or error.code == 0):
                return {"ok": True, "python": python_code}
            stderr.write(format_error(error, language, {FILENAME: source}, FILENAME))
            return {"ok": False, "python": python_code}
        finally:
            sys.stdin = previous_stdin
            if execute:
                if previous_main is missing_main:
                    sys.modules.pop("__main__", None)
                else:
                    sys.modules["__main__"] = previous_main
    return {"ok": True, "python": python_code}


def run(source, language, stdin, emit, flush=None, read_line=None):
    """Run once with fresh globals and a line callback or supplied standard input.

    ``emit(stream, text)`` receives writes immediately. This is process-style
    namespace isolation, not a Python security sandbox: imported modules and
    the worker's virtual filesystem persist until the worker is restarted.
    """
    return _process(source, language, stdin, emit, execute=True, flush=flush, read_line=read_line)


def run_interactive(source, language, request_input, emit, flush=None):
    """Browser-only adapter. The CLI and VS Code keep using native Python stdin."""
    def read_line():
        from pyodide.ffi import run_sync

        response = run_sync(request_input())
        return None if response.eof else response.value

    return run(source, language, "", emit, flush, read_line=read_line)


def translate(source, language, emit, flush=None):
    """Validate and return Python without executing the user's program."""
    return _process(source, language, "", emit, execute=False, flush=flush)
