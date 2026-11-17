import io
import sys
import tokenize
from pathlib import Path

import pytest

from balkh.cli import normalize_digits, transpile
from balkh.keywords import KEYWORDS


@pytest.mark.parametrize("alias, expected", KEYWORDS.items())
def test_keyword_aliases(alias, expected):
    assert transpile(alias).strip() == expected


@pytest.mark.parametrize(
    "source",
    [
        """\
تابع جمع(الف, ب):
    برگشت الف + ب
نتیجه = ۰
برای شمار در محدوده(۴):
    اگر شمار > ۱:
        نتیجه = جمع(نتیجه, شمار)
چاپ(نتیجه)
""",
        """\
فنکشن جمع(الف, ب):
    بېرته الف + ب
نتیجه = ۰
دپاره شمار کې حدود(۴):
    که شمار > ۱:
        نتیجه = جمع(نتیجه, شمار)
چاپول(نتیجه)
""",
        """\
تابع جمع(الف, ب):
    بېرته الف + ب
نتیجه = ۰
دپاره شمار در range(۴):
    اگر شمار > ۱:
        نتیجه = جمع(نتیجه, شمار)
print(نتیجه)
""",
    ],
    ids=["dari", "pashto", "mixed"],
)
def test_programs_execute(source, capsys):
    exec(transpile(source), {})
    assert capsys.readouterr().out == "5\n"


@pytest.mark.parametrize("digits", ["۰۱۲۳۴۵۶۷۸۹", "٠١٢٣٤٥٦٧٨٩"])
def test_every_native_digit(digits):
    namespace = {}
    source = "values = [" + ", ".join(digits) + "]"
    exec(transpile(source), namespace)
    assert namespace["values"] == list(range(10))


@pytest.mark.parametrize(
    "literal, expected",
    [("۱۲۳", 123), ("١٢٣", 123), ("۱۲.۳۴", 12.34), ("۱_۰۰۰", 1000), ("۲e۳", 2000)],
)
def test_numeric_literals(literal, expected):
    namespace = {}
    exec(transpile("value = " + literal), namespace)
    assert namespace["value"] == expected


@pytest.mark.parametrize(
    "literal",
    [
        '"اگر که چاپ ۱۲۳ ٤٥٦"',
        "'تابع فنکشن ۰۱۲'",
        '"""دری ۱۲۳\nپښتو ٤٥٦"""',
        'r"۱۲۳\\n چاپ"',
        '"۱۲۳ \\"چاپ\\""',
        'f"اگر ۱۲۳ {1 + 2}"',
    ],
)
def test_string_literals_are_preserved(literal):
    translated = transpile("value = " + literal)
    namespace = {}
    exec(translated, namespace)
    assert namespace["value"] == eval(literal)


def test_preserve_strings_and_comments_while_converting_code():
    source = 'چاپ("۱۲۳", ۱۲۳)  # اگر چاپ ٤٥٦\n'
    translated = transpile(source)
    tokens = list(tokenize.generate_tokens(io.StringIO(translated).readline))
    assert [t.string for t in tokens if t.type == tokenize.STRING] == ['"۱۲۳"']
    assert [t.string for t in tokens if t.type == tokenize.COMMENT] == ["# اگر چاپ ٤٥٦"]
    assert [t.string for t in tokens if t.type == tokenize.NUMBER] == ["123"]


def test_digit_normalization_preserves_multiline_text():
    source = 'x = ۱۲۳\r\ns = """۱۲۳\r\n٤٥٦"""\r\n# ۷۸۹\r\ny = ٤٥٦\r\n'
    assert normalize_digits(source) == source.replace("x = ۱۲۳", "x = 123").replace(
        "y = ٤٥٦", "y = 456"
    )


def test_unicode_line_separators_inside_strings():
    source = 'x = "۱۲۳\u2028٤٥٦"; y = "۷۸۹"\nz = ۱۲۳\n'
    assert normalize_digits(source) == source.replace("z = ۱۲۳", "z = 123")


@pytest.mark.skipif(sys.version_info < (3, 12), reason="Separate f-string tokens require Python 3.12+")
def test_fstring_text_is_preserved_while_expressions_translate():
    namespace = {}
    exec(transpile('value = f"۱۲۳ {{چاپ}} {عدد(۲) + ۳}"'), namespace)
    assert namespace["value"] == "۱۲۳ {چاپ} 5"


@pytest.mark.parametrize("source", ["", "# فقط یک توضیح\n"])
def test_empty_programs(source):
    exec(transpile(source), {})


def test_unclosed_bracket_raises_token_error():
    with pytest.raises(tokenize.TokenError):
        transpile("چاپ(۱۲۳")


@pytest.mark.parametrize("name", ["salam.blk", "bazi.blk"])
def test_examples_compile(name):
    path = Path(__file__).resolve().parents[1] / "examples" / name
    compile(transpile(path.read_text(encoding="utf-8")), str(path), "exec")
