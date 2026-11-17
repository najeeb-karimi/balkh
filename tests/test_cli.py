import os
from pathlib import Path
import subprocess
import sys

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def run_cli(*args, input_text=None):
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    return subprocess.run(
        [sys.executable, "-m", "balkh.cli", *map(str, args)],
        cwd=PROJECT_ROOT,
        env=env,
        input=input_text,
        capture_output=True,
        encoding="utf-8",
        timeout=10,
    )


@pytest.fixture
def program(tmp_path):
    path = tmp_path / "برنامه با فاصله.blk"
    path.write_text('چاپ("سلام ۱۲۳", ۱۲۳)\n', encoding="utf-8")
    return path


@pytest.mark.parametrize("args", [["-h"], ["--help"], ["--py", "--help"]])
def test_help(args):
    result = run_cli(*args)
    assert result.returncode == 0
    assert "Balkh v" in result.stdout
    assert "--py" in result.stdout
    assert result.stderr == ""


def test_execute_file(program):
    result = run_cli(program)
    assert result.returncode == 0
    assert result.stdout == "سلام ۱۲۳ 123\n"
    assert result.stderr == ""


@pytest.mark.parametrize("flag_first", [False, True])
def test_show_python_without_executing(program, flag_first, capsys):
    args = ["--py", program] if flag_first else [program, "--py"]
    result = run_cli(*args)
    assert result.returncode == 0
    assert result.stderr == ""
    namespace = {}
    # --py must produce valid Python rather than the program's printed output.
    exec(compile(result.stdout, "<cli-output>", "exec"), namespace)
    assert capsys.readouterr().out == "سلام ۱۲۳ 123\n"
    assert '"سلام ۱۲۳"' in result.stdout


@pytest.mark.parametrize("flag", ["-h", "--help"])
def test_help_after_filename(program, flag):
    result = run_cli(program, flag)
    assert result.returncode == 0
    assert "Balkh v" in result.stdout
    assert "سلام" not in result.stdout


@pytest.mark.parametrize("args", [["--py"], ["--unknown"], ["one.blk", "two.blk"]])
def test_invalid_arguments(args):
    result = run_cli(*args)
    assert result.returncode == 2
    assert "usage:" in result.stderr
    assert result.stdout == ""


def test_missing_file(tmp_path):
    path = tmp_path / "missing.blk"
    result = run_cli(path)
    assert result.returncode == 1
    assert str(path) in result.stdout
    assert "پیدا نشد" in result.stdout


def test_unclosed_bracket(tmp_path):
    path = tmp_path / "broken.blk"
    path.write_text("چاپ(۱۲۳", encoding="utf-8")
    result = run_cli(path)
    assert result.returncode == 1
    assert "خطای نگارشی" in result.stdout
    assert "Traceback" not in result.stderr


def test_no_arguments_starts_repl():
    result = run_cli(input_text="")
    assert result.returncode == 0
    assert result.stdout == "بلخ >>> "
    assert "Balkh v" in result.stderr
    assert "Traceback" not in result.stderr


def test_repl_executes_a_session():
    result = run_cli(
        input_text=(
            "نتیجه = ۲\n"
            "نتیجه + ۳\n"
            "تابع دوبرابر(مقدار):\n"
            "    بېرته مقدار * ۲\n"
            "\n"
            "چاپول(دوبرابر(نتیجه))\n"
        )
    )
    assert result.returncode == 0
    assert "بلخ >>> 5\n" in result.stdout
    assert "بلخ ... " in result.stdout
    assert "بلخ >>> 4\n" in result.stdout
    assert "Traceback" not in result.stderr


@pytest.mark.parametrize("command", ["exit()", "quit()"])
def test_repl_exit_commands(command):
    result = run_cli(input_text=command + '\nچاپ("should not run")\n')
    assert result.returncode == 0
    assert "should not run" not in result.stdout
    assert "Traceback" not in result.stderr


def test_repl_recovers_from_errors():
    result = run_cli(input_text='۱ / ۰\nاگر درست\nچاپ("هنوز اینجا")\n')
    assert result.returncode == 0
    assert "ZeroDivisionError" in result.stderr
    assert "SyntaxError" in result.stderr
    assert "هنوز اینجا" in result.stdout


def test_repl_eof_discards_an_incomplete_block():
    result = run_cli(input_text='اگر درست:\n    چاپ("should not run")\n')
    assert result.returncode == 0
    assert "بلخ ... " in result.stdout
    assert "should not run" not in result.stdout
    assert "Traceback" not in result.stderr
