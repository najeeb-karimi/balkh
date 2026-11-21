"""Small execution bridge shared by the browser worker and native tests."""

from contextlib import redirect_stderr, redirect_stdout
from io import StringIO, TextIOBase
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


def _process(source, language, stdin, emit, execute, flush=None):
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
                sys.stdin = StringIO(stdin)
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


def run(source, language, stdin, emit, flush=None):
    """Run once with fresh globals and pre-supplied multiline standard input.

    ``emit(stream, text)`` receives writes immediately. This is process-style
    namespace isolation, not a Python security sandbox: imported modules and
    the worker's virtual filesystem persist until the worker is restarted.
    """
    return _process(source, language, stdin, emit, execute=True, flush=flush)


def translate(source, language, emit, flush=None):
    """Validate and return Python without executing the user's program."""
    return _process(source, language, "", emit, execute=False, flush=flush)
