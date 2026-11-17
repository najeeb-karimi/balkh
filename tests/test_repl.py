import pytest

from balkh.cli import BalkhConsole


def test_expressions_and_variables_persist(capsys):
    console = BalkhConsole()
    assert console.push("نتیجه = ۱۲۳") is False
    assert console.push("نتیجه + ۲") is False
    assert console.locals["نتیجه"] == 123
    assert capsys.readouterr().out == "125\n"


@pytest.mark.parametrize(
    "header, body",
    [
        ("تابع دوبرابر(مقدار):", "    برگشت مقدار * ۲"),
        ("فنکشن دوبرابر(مقدار):", "    بېرته مقدار * ۲"),
        ("تابع دوبرابر(مقدار):", "    بېرته مقدار * ۲"),
    ],
    ids=["dari", "pashto", "mixed"],
)
def test_functions_wait_for_blank_line(header, body, capsys):
    console = BalkhConsole()
    assert console.push(header) is True
    assert console.push(body) is True
    assert "دوبرابر" not in console.locals
    assert console.push("") is False
    assert console.push("دوبرابر(۳)") is False
    assert capsys.readouterr().out == "6\n"


def test_nested_blocks_and_else_branches(capsys):
    console = BalkhConsole()
    lines = [
        "برای مقدار در محدوده(۳):",
        "    که مقدار == ۱:",
        '        چاپول("میانه")',
        "    وگرنه:",
        "        چاپ(مقدار)",
    ]
    for line in lines:
        assert console.push(line) is True
    assert capsys.readouterr().out == ""
    assert console.push("") is False
    assert capsys.readouterr().out == "0\nمیانه\n2\n"


@pytest.mark.parametrize(
    "lines, expected",
    [
        (["نتیجه = (", "    ۱ +", "    ۲", ")"], 3),
        (["نتیجه = [", "    ۱,", "    ۲,", "]"], [1, 2]),
        (['نتیجه = """۱۲۳', 'اگر که"""'], "۱۲۳\nاگر که"),
        (["نتیجه = ۱ + \\", "    ۲"], 3),
    ],
    ids=["parentheses", "list", "multiline-string", "backslash"],
)
def test_multiline_expressions(lines, expected):
    console = BalkhConsole()
    for line in lines[:-1]:
        assert console.push(line) is True
    assert console.push(lines[-1]) is False
    assert console.locals["نتیجه"] == expected


def test_imports_and_main_namespace(capsys):
    console = BalkhConsole()
    assert console.push("وارد math") is False
    assert console.push("math.isqrt(۸۱)") is False
    assert console.locals["__name__"] == "__main__"
    assert capsys.readouterr().out == "9\n"


@pytest.mark.parametrize("line", ["", "# اگر ۱۲۳"])
def test_empty_input_and_comments(line, capsys):
    assert BalkhConsole().push(line) is False
    assert capsys.readouterr() == ("", "")


@pytest.mark.parametrize(
    "lines, error_name",
    [
        (["۱ / ۰"], "ZeroDivisionError"),
        (["نام_ناشناخته"], "NameError"),
        (["اگر درست"], "SyntaxError"),
        (["x = [)"], "SyntaxError"),
        (['x = "oops'], None),
        (["اگر درست:", "    x = ۱", "  x = ۲"], "IndentationError"),
    ],
)
def test_errors_reset_the_buffer_and_preserve_state(lines, error_name, capsys):
    console = BalkhConsole()
    console.push("value = ۷")
    for line in lines:
        more = console.push(line)
    assert more is False
    error = capsys.readouterr().err
    assert error
    if error_name:
        assert error_name in error
    assert console.push("value + ۱") is False
    assert capsys.readouterr().out == "8\n"


def test_keyboard_interrupt_cancels_pending_input(monkeypatch, capsys):
    console = BalkhConsole()
    events = iter(["اگر درست:", "    value = ۹", KeyboardInterrupt(), "۲ + ۳", EOFError()])
    prompts = []

    def read_line(prompt):
        prompts.append(prompt)
        event = next(events)
        if isinstance(event, BaseException):
            raise event
        return event

    monkeypatch.setattr("builtins.input", read_line)
    console.interact(banner="", exitmsg="")
    captured = capsys.readouterr()
    assert "KeyboardInterrupt" in captured.err
    assert captured.out == "5\n"
    assert "value" not in console.locals
    assert prompts == ["بلخ >>> ", "بلخ ... ", "بلخ ... ", "بلخ >>> ", "بلخ >>> "]


@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_traceback_retains_source_of_previously_defined_function(language, capsys):
    console = BalkhConsole(language)
    assert console.push("تابع تقسیم(الف, ب):") is True
    assert console.push("    برگشت الف / ب") is True
    assert console.push("") is False
    for _ in range(10):
        assert console.push("نتیجه = ۱") is False
    assert console.push("تقسیم(۱, ۰)") is False
    captured = capsys.readouterr()
    assert "<بلخ:۱>" in captured.err
    assert "<بلخ:۱۲>" in captured.err
    assert ("خط ۲" if language == "dari" else "کرښه ۲") in captured.err
    assert "برگشت الف / ب" in captured.err
    assert "تقسیم(۱, ۰)" in captured.err
    assert "cli.py" not in captured.err
    assert console.push("۲ + ۳") is False
    assert capsys.readouterr().out == "5\n"


def test_invalid_console_language():
    with pytest.raises(ValueError, match="dari.*pashto"):
        BalkhConsole("english")
