import pytest

from balkh.errors import format_error, format_file_error
from balkh.translator import transpile


def capture_error(source, filename="lesson.blk"):
    try:
        exec(compile(transpile(source), filename, "exec"), {})
    except Exception as error:
        return error
    raise AssertionError("source did not raise an exception")


@pytest.mark.parametrize(
    "source, exception_name, dari, pashto",
    [
        ("چاپ(ناشناخته)", "NameError", "این نام تعریف نشده", "دا نوم نه دی تعریف شوی"),
        ('نتیجه = "بلخ" + ۱', "TypeError", "نوع مقدارها", "د ارزښتونو ډولونه"),
        ("نتیجه = ۱ / ۰", "ZeroDivisionError", "تقسیم یا باقیمانده", "پر صفر وېشل"),
        ("نتیجه = [۱][۳]", "IndexError", "این اندیس", "دا اندیس"),
    ],
)
@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_localized_runtime_explanations_and_original_source(
    source, exception_name, dari, pashto, language
):
    original = "\n" * 11 + source + "\n"
    error = capture_error(original)
    message = format_error(error, language, {"lesson.blk": original})
    assert exception_name in message
    assert (dari if language == "dari" else pashto) in message
    assert ("خط ۱۲" if language == "dari" else "کرښه ۱۲") in message
    assert ("راهنما:" if language == "dari" else "لارښوونه:") in message
    assert source in message
    assert "lesson.blk" in message
    assert "test_errors.py" not in message
    assert "Traceback" not in message


@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_nested_user_frames_are_reported_in_call_order(language):
    source = (
        "تابع بیرونی():\n"
        "    برگشت درونی()\n"
        "تابع درونی():\n"
        "    برگشت ۱ / ۰\n"
        "بیرونی()\n"
    )
    message = format_error(capture_error(source), language, {"lesson.blk": source})
    label = "خط" if language == "dari" else "کرښه"
    assert message.index(label + " ۵") < message.index(label + " ۲") < message.index(label + " ۴")
    assert "(بیرونی)" in message
    assert "(درونی)" in message
    assert "برگشت ۱ / ۰" in message
    assert "return 1 / 0" not in message


@pytest.mark.parametrize(
    "source, exception_name",
    [("اگر درست\n    چاپ(۱)\n", "SyntaxError"),
     ("اگر درست:\n    x = ۱\n  x = ۲\n", "IndentationError"),
     ("چاپ(۱۲۳", "TokenError")],
)
@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_syntax_and_token_errors_use_original_file(source, exception_name, language):
    error = capture_error(source)
    message = format_error(error, language, {"lesson.blk": source}, "lesson.blk")
    assert exception_name in message
    assert ("خطای نگارشی" if language == "dari" else "د لیکنې تېروتنه") in message
    assert "lesson.blk" in message
    assert "<tokenize>" not in message
    assert "Traceback" not in message


@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_library_frames_are_filtered_but_the_user_call_is_retained(language):
    source = 'از balkh.stdlib وارد زمان\nزمان.تجزیه("not a date")\n'
    message = format_error(capture_error(source), language, {"lesson.blk": source})
    assert "ValueError" in message
    assert 'زمان.تجزیه("not a date")' in message
    assert ("خط ۲" if language == "dari" else "کرښه ۲") in message
    assert "زمان.py" not in message
    assert "_datetime" not in message


@pytest.mark.parametrize("language", ["dari", "pashto"])
@pytest.mark.parametrize("explicit", [False, True])
def test_exception_chains_and_custom_messages(language, explicit):
    source = (
        "تلاش:\n"
        "    ۱ / ۰\n"
        "بجز ZeroDivisionError بعنوان خطا:\n"
        '    خطا_بده TypeError("پیام 123")'
        + (" از خطا" if explicit else "") + "\n"
    )
    message = format_error(capture_error(source), language, {"lesson.blk": source})
    assert message.index("(ZeroDivisionError)") < message.index("(TypeError)")
    assert "پیام 123" in message
    if explicit:
        assert ("باعث" if language == "dari" else "لامل") in message
    else:
        assert ("رسیدگی" if language == "dari" else "سمبالولو") in message


def test_suppressed_exception_context_stays_hidden():
    source = (
        "تلاش:\n    ۱ / ۰\n"
        "بجز ZeroDivisionError:\n"
        '    خطا_بده TypeError("custom message") از هیچ\n'
    )
    message = format_error(capture_error(source), sources={"lesson.blk": source})
    assert "custom message" in message
    assert "ZeroDivisionError" not in message


def test_cyclic_exception_chain_does_not_recurse_forever():
    error = ValueError("cycle")
    error.__cause__ = error
    assert format_error(error).count("(ValueError)") == 1


def test_custom_exception_without_source_keeps_its_message():
    class DomainError(Exception):
        pass

    message = format_error(DomainError("پیام 123"), "pashto")
    assert "(DomainError)" in message
    assert "پروګرام د یوې تېروتنې" in message
    assert "پیام 123" in message


def test_unicode_line_separators_do_not_shift_locations():
    source = 'text = "۱۲۳\u2028٤٥٦"\n۱ / ۰\n'
    message = format_error(capture_error(source), sources={"lesson.blk": source})
    assert "خط ۲" in message
    assert "۱ / ۰" in message


@pytest.mark.parametrize("language", ["dari", "pashto"])
def test_missing_file_message(language):
    message = format_file_error("test123.blk", "missing", language=language)
    assert "test123.blk" in message
    assert ("پیدا نشد" if language == "dari" else "ونه موندل شوه") in message


def test_invalid_language_is_rejected():
    with pytest.raises(ValueError, match="dari.*pashto"):
        format_error(TypeError(), "english")
