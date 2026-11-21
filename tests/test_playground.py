"""Exercise the exact Python bridge loaded by the browser worker."""

import importlib.util
from pathlib import Path
import sys

import pytest


spec = importlib.util.spec_from_file_location(
    "playground_runner", Path(__file__).resolve().parents[1] / "playground" / "runner.py"
)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def execute(source, language="dari", stdin="", translate=False):
    events = []
    emit = lambda stream, text: events.append((stream, text))
    result = (
        runner.translate(source, language, emit) if translate
        else runner.run(source, language, stdin, emit)
    )
    return result, {
        stream: "".join(text for name, text in events if name == stream)
        for stream in ("stdout", "stderr")
    }


@pytest.mark.parametrize("keyword, language", [("چاپ", "dari"), ("چاپول", "pashto")])
def test_native_programs_and_digits(keyword, language):
    result, output = execute(f'{keyword}("سلام ۱۲۳", ۲ + ۳)\n', language)
    assert result["ok"]
    assert output == {"stdout": "سلام ۱۲۳ 5\n", "stderr": ""}
    assert result["python"] == 'print("سلام ۱۲۳", 2 + 3)\n'


def test_multiline_stdin_prompts_and_eof():
    result, output = execute('چاپ(ورودی("نام: "))\nچاپ(ورودی())\n', stdin="بلخ\nافغانستان\n")
    assert result["ok"]
    assert output["stdout"] == "نام: بلخ\nافغانستان\n"
    result, output = execute("ورودی()\n")
    assert not result["ok"]
    assert "EOFError" in output["stderr"]


def test_streams_are_separate_and_writes_are_immediate():
    events = []
    result = runner.run(
        'import sys\nsys.stdout.write("one")\nsys.stderr.write("two")\nprint("three")\n',
        "dari", "", lambda stream, text: events.append((stream, text)),
    )
    assert result["ok"]
    assert events == [("stdout", "one"), ("stderr", "two"), ("stdout", "three"), ("stdout", "\n")]


def test_explicit_flush_reaches_the_page_before_execution_finishes():
    events = []
    result = runner.run(
        'import sys\nsys.stdout.write("progress")\nsys.stdout.flush()\nprint("finished", flush=True)\n',
        "dari", "", lambda stream, text: events.append((stream, text)),
        lambda: events.append(("flush", "")),
    )
    assert result["ok"]
    assert events[:4] == [("stdout", "progress"), ("flush", ""), ("stdout", "finished"), ("stdout", "\n")]
    assert events[4] == ("flush", "")


@pytest.mark.parametrize("status", ["None", "0"])
def test_clean_system_exit_is_successful_and_execution_stops(status):
    result, output = execute(f'print("before")\nraise SystemExit({status})\nprint("unreachable")\n')
    assert result["ok"]
    assert output == {"stdout": "before\n", "stderr": ""}


def test_nonzero_system_exit_is_localized_and_worker_can_run_again():
    result, output = execute("raise SystemExit(7)\n")
    assert not result["ok"]
    assert "SystemExit" in output["stderr"]
    assert "خطای اجرا" in output["stderr"]
    assert execute('print("still usable")\n')[1]["stdout"] == "still usable\n"


@pytest.mark.parametrize("language, label", [("dari", "خط ۲"), ("pashto", "کرښه ۲")])
def test_runtime_error_uses_original_source_and_language(language, label):
    result, output = execute("مقدار = ۱\nچاپ(مقدار / ۰)\n", language)
    assert not result["ok"]
    assert label in output["stderr"]
    assert "چاپ(مقدار / ۰)" in output["stderr"]
    assert "ZeroDivisionError" in output["stderr"]
    assert "runner.py" not in output["stderr"]


@pytest.mark.parametrize("source, kind", [("اگر درست\n    چاپ(۱)\n", "SyntaxError"), ("چاپ(۱", "TokenError")])
def test_invalid_programs_have_localized_diagnostics(source, kind):
    result, output = execute(source)
    assert not result["ok"]
    assert "خطای نگارشی" in output["stderr"]
    assert kind in output["stderr"]
    assert output["stdout"] == ""


def test_python_preview_validates_without_running():
    result, output = execute('چاپ("never printed")\nخطا_بده RuntimeError("never raised")\n', translate=True)
    assert result["ok"]
    assert result["python"].startswith('print("never printed")')
    assert output == {"stdout": "", "stderr": ""}
    result, output = execute("اگر درست\n", translate=True)
    assert not result["ok"]
    assert "SyntaxError" in output["stderr"]


def test_each_run_has_fresh_globals_and_input():
    assert execute("secret = ورودی()\n", stdin="first\n")[0]["ok"]
    result, output = execute("چاپ(secret)\n")
    assert not result["ok"]
    assert "NameError" in output["stderr"]
    assert execute("چاپ(ورودی())\n", stdin="second\n")[1]["stdout"] == "second\n"


def test_program_is_the_main_module_for_imports_dataclasses_and_pickle():
    source = (
        "from __future__ import annotations\n"
        "from dataclasses import dataclass, InitVar\n"
        "import __main__, pickle\n"
        "@dataclass\n"
        "class Point:\n"
        "    x: int\n"
        "    initial: InitVar[int] = 1\n"
        "point = Point(3)\n"
        "assert __main__.point is point\n"
        "print(pickle.loads(pickle.dumps(point)))\n"
    )
    result, output = execute(source)
    assert result["ok"], output["stderr"]
    assert output["stdout"] == "Point(x=3)\n"


@pytest.mark.parametrize("ending", ["", "raise ValueError('test')\n", "raise SystemExit(0)\n"])
def test_main_module_is_restored_after_program_execution(ending):
    previous = sys.modules["__main__"]
    execute("import __main__\n__main__.playground_temporary = True\n" + ending)
    assert sys.modules["__main__"] is previous
    assert not hasattr(previous, "playground_temporary")


def test_main_module_is_removed_if_it_did_not_exist_before_execution(monkeypatch):
    monkeypatch.delitem(sys.modules, "__main__")
    result, output = execute("import __main__\nprint(__main__.__name__)\n")
    assert result["ok"], output["stderr"]
    assert output["stdout"] == "__main__\n"
    assert "__main__" not in sys.modules


@pytest.mark.parametrize("source", ["raise SystemExit(2)\n", "raise KeyboardInterrupt()\n", "1 / 0\n"])
def test_streams_restored_after_program_exit_and_errors(source):
    before = (sys.stdin, sys.stdout, sys.stderr)
    result, _ = execute(source)
    assert not result["ok"]
    assert (sys.stdin, sys.stdout, sys.stderr) == before
    assert execute('چاپ("recovered")\n')[1]["stdout"] == "recovered\n"


def test_standard_library_imports_use_the_regular_package():
    result, output = execute("از balkh.stdlib وارد ریاضی\nچاپ(ریاضی.جذر(۸۱))\n")
    assert result["ok"], output["stderr"]
    assert output["stdout"] == "9.0\n"


def test_output_is_bounded_across_both_streams_and_reported_once():
    source = 'import sys\nprint("a" * 60000, end="")\nsys.stderr.write("b" * 60000)\nprint("discarded")\n'
    result, output = execute(source)
    assert result["ok"]
    assert len(output["stdout"]) == 60000
    assert output["stderr"] == "b" * 40000 + runner.TRUNCATED
    assert "discarded" not in output["stdout"]


def test_custom_exception_chain_preserves_localized_context():
    result, output = execute('try:\n    1 / 0\nexcept Exception as cause:\n    raise ValueError("custom") from cause\n')
    assert not result["ok"]
    assert "ZeroDivisionError" in output["stderr"]
    assert "ValueError" in output["stderr"]
    assert "custom" in output["stderr"]


def test_invalid_language_is_a_bridge_error():
    with pytest.raises(ValueError, match="language"):
        execute("", language="unknown")
