import sys

import pytest

from balkh.translator import reverse_transpile, transpile


@pytest.mark.parametrize(
    "language, expected",
    [
        ("dari", 'تابع greet(name):\n    اگر name است هیچ:\n        برگشت غلط\n    چاپ(رشته(name))\n    برگشت درست\n'),
        ("pashto", 'فنکشن greet(name):\n    که name دی هېڅ:\n        بېرته غلط\n    چاپول(لیکنه(name))\n    بېرته سم\n'),
    ],
)
def test_preferred_language_aliases(language, expected):
    source = (
        "def greet(name):\n"
        "    if name is None:\n"
        "        return False\n"
        "    print(str(name))\n"
        "    return True\n"
    )
    assert reverse_transpile(source, language) == expected


def test_default_language_is_dari():
    assert reverse_transpile('print("hello")') == 'چاپ("hello")'


@pytest.mark.parametrize("language", ["english", "Dari", "", None])
def test_invalid_language(language):
    with pytest.raises(ValueError, match="dari.*pashto"):
        reverse_transpile("pass", language)


@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_round_trip_executes_equivalently(language, capsys):
    source = '''\
from math import sqrt as root

class Calculator:
    def total(self, values):
        result = 0
        for value in values:
            if value is None or not value:
                continue
            elif value < 0:
                break
            else:
                result += int(root(value))
        return result

try:
    assert Calculator().total([1, 4, None, 0, 9, -1, 16]) == 6
except AssertionError:
    raise ValueError("incorrect result")
finally:
    print("finished ۱۲۳")
'''
    balkh = reverse_transpile(source, language)
    python = transpile(balkh)
    assert python == source
    exec(python, {})
    assert capsys.readouterr().out == "finished ۱۲۳\n"


@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_preserve_non_code_text_and_whole_identifier_boundaries(language):
    source = (
        '# if print True ۱۲۳\r\n'
        'printer = "print if ۱۲۳"\r\n'
        's = """return\r\nFalse ٤٥٦"""\r\n'
        'printable = r"print\\n۱۲۳"\r\n'
        'total = (1 + \\\r\n\t2)\r\n'
        'print(printer, total)\r\n'
    )
    translated = reverse_transpile(source, language)
    assert translated != source
    assert transpile(translated) == source


@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_unmapped_python_syntax_and_standard_library_names(language):
    source = '''\
import json
from contextlib import nullcontext

def counter():
    count = 0
    def increment():
        nonlocal count
        count += 1
        return count
    with nullcontext():
        yield increment()

assert json.loads("[1, 2]") == [1, 2]
assert next(counter()) == 1
'''
    result = transpile(reverse_transpile(source, language))
    assert result == source
    exec(result, {})


@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_async_keywords_round_trip(language):
    source = "async def run(task):\n    return await task\n"
    assert transpile(reverse_transpile(source, language)) == source


@pytest.mark.skipif(sys.version_info < (3, 12), reason="Separate f-string tokens require Python 3.12+")
@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_fstring_expressions_translate_without_changing_text(language):
    source = 'value = f"print ۱۲۳ {{len}} {len(str(123))}"\n'
    localized = reverse_transpile(source, language)
    assert localized != source
    assert 'f"print ۱۲۳ {{len}} ' in localized
    assert transpile(localized) == source


@pytest.mark.parametrize("source", ["", "# only a comment", "\n\n"])
def test_empty_sources_preserve_text(source):
    assert reverse_transpile(source) == source


def test_forward_translation_preserves_formatting_and_continuations():
    source = '# ۱۲۳\r\nنتیجه = ۱ + \\\r\n    ۲\r\nچاپ(نتیجه)\r\n'
    expected = '# ۱۲۳\r\nنتیجه = 1 + \\\r\n    2\r\nprint(نتیجه)\r\n'
    assert transpile(source) == expected
