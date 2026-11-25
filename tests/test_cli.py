import os
from pathlib import Path
import subprocess
import sys
import tokenize

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


def test_file_input_keeps_native_python_stdin_for_cli_and_vscode(tmp_path):
    path = tmp_path / "interactive.blk"
    path.write_text(
        'name = ورودی("نام: ")\n'
        'place = ننوت("ځای: ")\n'
        'empty = input("Empty: ")\n'
        'چاپ(name, place, repr(empty))\n',
        encoding="utf-8",
    )
    result = run_cli(path, input_text="بلخ 😀\nافغانستان\n\n")
    assert result.returncode == 0, result.stderr
    assert result.stdout == "نام: ځای: Empty: بلخ 😀 افغانستان ''\n"
    assert result.stderr == ""


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
    assert result.stdout == ""
    assert str(path) in result.stderr
    assert "پیدا نشد" in result.stderr


def test_unclosed_bracket(tmp_path):
    path = tmp_path / "broken.blk"
    path.write_text("چاپ(۱۲۳", encoding="utf-8")
    result = run_cli(path)
    assert result.returncode == 1
    assert result.stdout == ""
    assert "خطای نگارشی" in result.stderr
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


@pytest.mark.parametrize("flag_first", [False, True])
def test_export_python_without_execution(program, tmp_path, flag_first):
    output = tmp_path / "ترجمه با فاصله.py"
    args = ["--to-py", output, program] if flag_first else [program, "--to-py", output]
    result = run_cli(*args)
    assert result.returncode == 0
    assert result.stdout == result.stderr == ""
    exported = subprocess.run(
        [sys.executable, str(output)], capture_output=True,
        encoding="utf-8", env={**os.environ, "PYTHONIOENCODING": "utf-8"}, timeout=10,
    )
    assert exported.returncode == 0
    assert exported.stdout == "سلام ۱۲۳ 123\n"


@pytest.fixture
def python_program(tmp_path):
    path = tmp_path / "source.py"
    path.write_text('print("hello ۱۲۳", len([1, 2]))\n', encoding="utf-8")
    return path


@pytest.mark.parametrize(
    "language, expected",
    [("dari", 'چاپ("hello ۱۲۳", طول([1, 2]))\n'),
     ("pashto", 'چاپول("hello ۱۲۳", اوږدوالی([1, 2]))\n')],
)
def test_reverse_translation_to_stdout(python_program, language, expected):
    result = run_cli(python_program, "--to-blk", "--lang", language)
    assert result.returncode == 0
    assert result.stderr == ""
    assert result.stdout == expected


def test_reverse_translation_defaults_to_dari(python_program):
    result = run_cli(python_program, "--to-blk")
    assert result.returncode == 0
    assert result.stdout.startswith("چاپ(")


@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_export_balkh_and_execute(python_program, tmp_path, language):
    output = tmp_path / "برنامه بلخ.blk"
    result = run_cli(python_program, "--to-blk", output, "--lang", language)
    assert result.returncode == 0
    assert result.stdout == result.stderr == ""
    exported = run_cli(output)
    assert exported.returncode == 0
    assert exported.stdout == "hello ۱۲۳ 2\n"


def test_reverse_flags_before_filename(python_program):
    result = run_cli("--to-blk", "--lang", "pashto", python_program)
    assert result.returncode == 0
    assert result.stdout.startswith("چاپول(")


@pytest.mark.parametrize("flag", ["--to-py", "--to-blk"])
def test_translation_does_not_execute_source(tmp_path, flag):
    source = tmp_path / "source.txt"
    source.write_text('raise RuntimeError("must not execute")\n', encoding="utf-8")
    output = tmp_path / "result.txt"
    result = run_cli(source, flag, output)
    assert result.returncode == 0
    assert result.stdout == result.stderr == ""
    assert "must not execute" in output.read_text(encoding="utf-8")


@pytest.mark.parametrize(
    "args",
    [
        ["--to-py"], ["--to-py", "result.py"], ["--to-blk"],
        ["--lang", "english"],
        ["source.py", "--to-blk", "--lang", "english"],
        ["source.blk", "--py", "--to-py", "result.py"],
        ["source.blk", "--py", "--to-blk"],
        ["source.blk", "--to-py", "result.py", "--to-blk"],
    ],
)
def test_invalid_translation_arguments(args):
    result = run_cli(*args)
    assert result.returncode == 2
    assert "usage:" in result.stderr
    assert result.stdout == ""


@pytest.mark.parametrize("flag", ["--to-py", "--to-blk"])
def test_export_rejects_input_as_output(python_program, flag):
    original = python_program.read_bytes()
    result = run_cli(python_program, flag, python_program)
    assert result.returncode == 2
    assert "different files" in result.stderr
    assert python_program.read_bytes() == original


@pytest.mark.parametrize("source_code", ["if True\n", "print(\n"])
@pytest.mark.parametrize("flag", ["--to-py", "--to-blk"])
def test_invalid_source_leaves_output_untouched(tmp_path, flag, source_code):
    source = tmp_path / "broken.txt"
    source.write_text(source_code, encoding="utf-8")
    output = tmp_path / "output.txt"
    output.write_text("keep this", encoding="utf-8")
    result = run_cli(source, flag, output)
    assert result.returncode == 1
    assert "Traceback" not in result.stderr
    assert output.read_text(encoding="utf-8") == "keep this"


@pytest.mark.parametrize("flag", ["--to-py", "--to-blk"])
def test_unwritable_output_has_clean_error(python_program, tmp_path, flag):
    result = run_cli(python_program, flag, tmp_path / "missing" / "output.txt")
    assert result.returncode == 1
    assert "خطای نوشتن فایل" in result.stderr
    assert "Traceback" not in result.stderr


def test_unreadable_source_has_clean_error(tmp_path):
    result = run_cli(tmp_path, "--to-blk")
    assert result.returncode == 1
    assert "خطای خواندن فایل" in result.stderr
    assert "Traceback" not in result.stderr


@pytest.mark.parametrize("header", ["# coding: latin-1\n", "#!/usr/bin/env python\n# coding: latin-1\n"])
def test_encoded_python_round_trip(tmp_path, header):
    source = tmp_path / "latin.py"
    source.write_bytes((header + 'print("caf\xe9")\n').encode("latin-1"))
    balkh = tmp_path / "localized.blk"
    python = tmp_path / "exported.py"
    assert run_cli(source, "--to-blk", balkh).returncode == 0
    assert balkh.read_text(encoding="utf-8").startswith(header.replace("latin-1", "utf-8"))
    assert run_cli(balkh, "--to-py", python).returncode == 0
    with tokenize.open(str(python)) as file:
        assert 'print("caf\xe9")' in file.read()


@pytest.mark.parametrize("flag", ["--to-py", "--to-blk"])
def test_encoding_cookie_text_inside_string_is_preserved(tmp_path, flag):
    source = tmp_path / "source.txt"
    text = 'text = """\n# coding: latin-1\n"""\n'
    source.write_text(text, encoding="utf-8")
    output = tmp_path / "output.txt"
    result = run_cli(source, flag, output)
    assert result.returncode == 0
    assert output.read_text(encoding="utf-8") == text


def test_file_round_trip_preserves_line_endings_and_bom_input(tmp_path):
    source = tmp_path / "source.py"
    text = 'print("hello ۱۲۳")\r\n'
    source.write_bytes(text.encode("utf-8-sig"))
    balkh = tmp_path / "localized.blk"
    python = tmp_path / "exported.py"
    assert run_cli(source, "--to-blk", balkh, "--lang", "pashto").returncode == 0
    assert balkh.read_bytes().decode("utf-8") == 'چاپول("hello ۱۲۳")\r\n'
    assert run_cli(balkh, "--to-py", python).returncode == 0
    assert python.read_bytes().decode("utf-8") == text


def test_localized_stdlib_example_and_python_export(tmp_path):
    source = PROJECT_ROOT / "examples" / "stdlib.blk"
    result = run_cli(source)
    expected = (
        "جذر ۸۱: 9.0\nد ۸۱ مربع ریښه: 9.0\n"
        "انتخاب: بلخ\nټاکنه: بلخ\n"
        "فردا: 2024-02-29\nسبا: 2024-02-29\n"
    )
    assert result.returncode == 0
    assert result.stdout == expected
    assert result.stderr == ""
    output = tmp_path / "stdlib.py"
    exported = run_cli(source, "--to-py", output)
    assert exported.returncode == 0
    assert exported.stdout == exported.stderr == ""
    shown = run_cli(source, "--py")
    assert shown.returncode == 0, shown.stderr
    assert shown.stdout == output.read_text(encoding="utf-8")
    assert "balkh.stdlib" not in shown.stdout
    assert "math.sqrt(81)" in shown.stdout
    assert "datetime.timedelta(days=1)" in shown.stdout
    python = subprocess.run(
        [sys.executable, "-I", "-S", "-X", "utf8", str(output)], capture_output=True, encoding="utf-8",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"}, timeout=10,
    )
    assert python.returncode == 0
    assert python.stdout == expected
    assert python.stderr == ""


def test_python_modes_keep_names_strings_and_export_line_endings(tmp_path):
    source = tmp_path / "source.blk"
    source.write_bytes((
        '# example\r\nاز balkh.stdlib وارد ریاضی بعنوان حساب\r\n'
        'زبان۱ = "دری"\r\nاگر زبان۱ == "دری":\r\n'
        '    چاپ(زبان۱, حساب.جذر(۸۱))  # روش\r\n'
    ).encode("utf-8"))
    output = tmp_path / "translated.py"
    result = run_cli(source, "--to-py", output)
    assert result.returncode == 0, result.stderr
    code = output.read_bytes().decode("utf-8")
    assert code == (
        '# example\r\nimport math as حساب\r\n'
        'زبان۱ = "دری"\r\nif زبان۱ == "دری":\r\n'
        '    print(زبان۱, حساب.sqrt(81))  # روش\r\n'
    )
    shown = run_cli(source, "--py")
    assert shown.returncode == 0, shown.stderr
    assert shown.stdout == code.replace("\r\n", "\n")


@pytest.mark.parametrize(
    "source, exception_name, dari, pashto",
    [("چاپ(ناشناخته)", "NameError", "این نام تعریف نشده", "دا نوم نه دی تعریف شوی"),
     ('نتیجه = "بلخ" + ۱', "TypeError", "نوع مقدارها", "د ارزښتونو ډولونه"),
     ("نتیجه = ۱ / ۰", "ZeroDivisionError", "تقسیم یا باقیمانده", "پر صفر وېشل"),
     ("نتیجه = [۱][۳]", "IndexError", "این اندیس", "دا اندیس")],
)
@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_localized_file_runtime_errors(tmp_path, source, exception_name, dari, pashto, language):
    path = tmp_path / "برنامه 12.blk"
    path.write_text("\n" * 11 + source + "\n", encoding="utf-8")
    result = run_cli(path, "--lang", language)
    assert result.returncode == 1
    assert result.stdout == ""
    assert str(path) in result.stderr
    assert exception_name in result.stderr
    assert (dari if language == "dari" else pashto) in result.stderr
    assert ("خط ۱۲" if language == "dari" else "کرښه ۱۲") in result.stderr
    assert source in result.stderr
    assert "cli.py" not in result.stderr
    assert "Traceback" not in result.stderr


def test_runtime_failure_preserves_program_stdout_and_stops_execution(tmp_path):
    path = tmp_path / "failure.blk"
    path.write_text('چاپ("پیش از خطا")\n۱ / ۰\nچاپ("نباید اجرا")\n', encoding="utf-8")
    result = run_cli(path)
    assert result.returncode == 1
    assert result.stdout == "پیش از خطا\n"
    assert "ZeroDivisionError" in result.stderr
    assert "نباید اجرا" not in result.stdout


def test_program_can_handle_its_own_errors(tmp_path):
    path = tmp_path / "handled.blk"
    path.write_text(
        'تلاش:\n    ۱ / ۰\nبجز ZeroDivisionError:\n    چاپ("گرفته شد")\n',
        encoding="utf-8",
    )
    result = run_cli(path, "--lang", "pashto")
    assert result.returncode == 0
    assert result.stdout == "گرفته شد\n"
    assert result.stderr == ""


def test_custom_runtime_error_keeps_original_message(tmp_path):
    path = tmp_path / "custom.blk"
    path.write_text('خطا_بده ValueError("پیام 123")\n', encoding="utf-8")
    result = run_cli(path, "--lang", "pashto")
    assert result.returncode == 1
    assert "ValueError" in result.stderr
    assert "پیام 123" in result.stderr
    assert "پروګرام د یوې تېروتنې" in result.stderr


def test_system_exit_status_is_preserved(tmp_path):
    path = tmp_path / "exit.blk"
    path.write_text("خطا_بده SystemExit(۷)\n", encoding="utf-8")
    result = run_cli(path, "--lang", "pashto")
    assert result.returncode == 7
    assert result.stdout == result.stderr == ""


@pytest.mark.parametrize("flag", ["--py", "--to-py", "--to-blk"])
def test_translation_syntax_errors_use_selected_language(tmp_path, flag):
    path = tmp_path / "broken.py"
    path.write_text("if True\n", encoding="utf-8")
    output = tmp_path / "output.txt"
    output.write_text("keep this", encoding="utf-8")
    args = [flag] if flag == "--py" else [flag, output]
    result = run_cli(path, *args, "--lang", "pashto")
    assert result.returncode == 1
    assert result.stdout == ""
    assert "د لیکنې تېروتنه" in result.stderr
    assert "کرښه ۱" in result.stderr
    assert "if True" in result.stderr
    assert output.read_text(encoding="utf-8") == "keep this"


def test_pashto_repl_diagnostics_and_recovery():
    result = run_cli("--lang", "pashto", input_text='۱ / ۰\n[۱][۳]\nناشناخته\n"بلخ" + ۱\n۲ + ۳\n')
    assert result.returncode == 0
    assert "د بلخ پروګرامینګ ژبه" in result.stderr
    assert result.stderr.count("د اجرا تېروتنه") == 4
    assert "لارښوونه:" in result.stderr
    assert "کرښه ۱" in result.stderr
    assert "بلخ >>> 5\n" in result.stdout


@pytest.mark.parametrize("flag_first", [False, True])
def test_execution_accepts_language_option(program, flag_first):
    args = ["--lang", "pashto", program] if flag_first else [program, "--lang", "pashto"]
    result = run_cli(*args)
    assert result.returncode == 0
    assert result.stdout == "سلام ۱۲۳ 123\n"
    assert result.stderr == ""


def test_file_io_errors_use_pashto(tmp_path):
    missing = run_cli(tmp_path / "missing.blk", "--lang", "pashto")
    assert missing.returncode == 1
    assert missing.stdout == ""
    assert "ونه موندل شوه" in missing.stderr
    directory = run_cli(tmp_path, "--lang", "pashto")
    assert directory.returncode == 1
    assert "د دوتنې د لوستلو تېروتنه" in directory.stderr
    source = tmp_path / "source.blk"
    source.write_text("چاپ(۱)\n", encoding="utf-8")
    unwritable = run_cli(source, "--to-py", tmp_path, "--lang", "pashto")
    assert unwritable.returncode == 1
    assert "د دوتنې د لیکلو تېروتنه" in unwritable.stderr
