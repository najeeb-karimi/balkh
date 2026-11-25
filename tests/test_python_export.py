"""Check the CLI's source conversion independently of the browser runner."""

import builtins
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
import random
from unittest.mock import patch

import pytest

from balkh.preview import python_preview
from balkh.translator import transpile


def to_python(source):
    return python_preview(transpile(source))


def stdout(code, answers):
    output = StringIO()
    with patch("sys.stdin", StringIO(answers)), redirect_stdout(output):
        exec(compile(code, "<export>", "exec"), {})
    return output.getvalue()


@pytest.mark.parametrize("name", ["salam", "stdlib", "bazi"])
def test_examples_export_without_balkh_imports(name):
    path = Path(__file__).resolve().parents[1] / "examples" / f"{name}.blk"
    source = path.read_text(encoding="utf-8")
    code = to_python(source)
    assert "balkh.stdlib" not in code
    if name == "salam":
        assert "def خوش_آمدید(نام, زبان)" in code
        assert 'if زبان == "دری"' in code
    if name == "stdlib":
        assert "math.sqrt(81)" in code and "datetime.timedelta(days=1)" in code
    if name == "bazi":
        assert "عدد_مخفی = random.randint(1, 10)" in code

    rng = random.getstate()
    builtin_import = builtins.__import__

    def import_stdlib_only(name, *args, **kwargs):
        assert name.split(".")[0] != "balkh"
        return builtin_import(name, *args, **kwargs)

    try:
        random.seed(7)
        answers = f"{random.randint(1, 10)}\n"
        random.seed(7)
        expected = stdout(transpile(source), answers)
        random.seed(7)
        with patch("builtins.__import__", import_stdlib_only):
            assert stdout(code, answers) == expected
    finally:
        random.setstate(rng)


def test_export_keeps_shadowed_modules_and_local_names():
    source = (
        "from balkh.stdlib import ریاضی as calc\n"
        "language = 1\nزبان = 2\n"
        "def test(calc):\n    return calc.جذر(4)\n"
        "print(language, زبان, test(calc))\n"
    )
    assert to_python(source) == source


def test_export_translates_imported_helpers_and_keeps_explicit_aliases():
    source = (
        'از balkh.stdlib.ریاضی وارد جذر, توان بعنوان نیرو\n'
        'پایله = جذر(۸۱) + نیرو(۲, ۳)\n'
        'چاپ("پایله:", پایله)\n'
    )
    assert to_python(source) == (
        'from math import sqrt\nfrom math import pow as نیرو\n'
        'پایله = sqrt(81) + نیرو(2, 3)\n'
        'print("پایله:", پایله)\n'
    )


def test_export_keeps_the_expression_label_in_debug_fstrings():
    source = 'from balkh.stdlib import ریاضی\nprint(f"{ریاضی.جذر(4)=}")\n'
    assert to_python(source) == source


def test_export_handles_deeply_nested_expressions_that_compile():
    source = "زبان = 1\nprint(" + " + ".join(["زبان"] * 700) + ")\n"
    compile(to_python(source), "<export>", "exec")
