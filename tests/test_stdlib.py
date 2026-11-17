import datetime
import importlib
import math
import random

import pytest

from balkh.cli import BalkhConsole
from balkh.stdlib import ریاضی, تصادفی, زمان
from balkh.translator import transpile


@pytest.mark.parametrize(
    "name, args, expected",
    [
        ("جذر", (81,), 9), ("مربع_ریښه", (81,), 9),
        ("توان", (2, 3), 8),
        ("قدر_مطلق", (-2.5,), 2.5), ("مطلق_ارزښت", (-2.5,), 2.5),
        ("سقف", (2.1,), 3), ("پورته_ګردول", (2.1,), 3),
        ("کف", (2.9,), 2), ("ښکته_ګردول", (2.9,), 2),
        ("فاکتوریل", (5,), 120), ("فاکټوریل", (5,), 120),
        ("سینوس", (math.pi / 2,), 1), ("کسینوس", (0,), 1),
        ("تانژانت", (0,), 0), ("لگاریتم", (8, 2), 3),
        ("لگاریتم_ده", (100,), 2), ("نمایی", (0,), 1),
        ("رادیان", (180,), math.pi), ("درجه", (math.pi,), 180),
    ],
)
def test_localized_math(name, args, expected):
    assert getattr(ریاضی, name)(*args) == pytest.approx(expected)


def test_math_constants_and_errors():
    assert ریاضی.پی == math.pi
    assert ریاضی.ای == ریاضی.اي == math.e
    assert ریاضی.تاو == 2 * math.pi
    assert math.isinf(ریاضی.بینهایت)
    assert ریاضی.بې_پایه == ریاضی.بینهایت
    with pytest.raises(ValueError):
        ریاضی.جذر(-1)
    with pytest.raises(ValueError):
        ریاضی.فاکټوریل(-1)


@pytest.fixture
def random_state():
    state = random.getstate()
    try:
        yield
    finally:
        random.setstate(state)


@pytest.mark.parametrize(
    "seed_name, integer_name, float_name, uniform_name",
    [("بذر", "عدد_صحیح", "اعشاری_تصادفی", "یکنواخت"),
     ("تخم", "بشپړ_شمېر", "تصادفي_شمېره", "یوشان")],
)
def test_random_ranges_and_repeatability(
    seed_name, integer_name, float_name, uniform_name, random_state
):
    seed = getattr(تصادفی, seed_name)
    integer = getattr(تصادفی, integer_name)
    fraction = getattr(تصادفی, float_name)
    uniform = getattr(تصادفی, uniform_name)
    seed(123)
    first = [integer(1, 10), fraction(), uniform(2, 3)]
    assert 1 <= first[0] <= 10
    assert 0 <= first[1] < 1
    assert 2 <= first[2] <= 3
    seed(123)
    assert [integer(1, 10), fraction(), uniform(2, 3)] == first
    assert integer(7, 7) == 7


@pytest.mark.parametrize("choice, shuffle", [("انتخاب", "درهم_کردن"), ("ټاکنه", "ګډول")])
def test_random_collections(choice, shuffle, random_state):
    assert getattr(تصادفی, choice)(["بلخ"]) == "بلخ"
    sampled = تصادفی.نمونه([1, 2, 3, 4], 3)
    assert len(sampled) == len(set(sampled)) == 3
    assert set(sampled) <= {1, 2, 3, 4}
    items = [1, 2, 3, 4]
    assert getattr(تصادفی, shuffle)(items) is None
    assert sorted(items) == [1, 2, 3, 4]
    with pytest.raises(IndexError):
        getattr(تصادفی, choice)([])
    with pytest.raises(ValueError):
        تصادفی.نمونه([1], 2)


def test_random_helpers_share_standard_library_state(random_state):
    تصادفی.بذر(42)
    expected = random.random()
    تصادفی.تخم(42)
    assert تصادفی.اعشاری_تصادفی() == expected


@pytest.mark.parametrize("name", ["تاریخ", "نېټه"])
def test_date_constructors_return_python_dates(name):
    assert getattr(زمان, name)(2024, 2, 29) == datetime.date(2024, 2, 29)
    with pytest.raises(ValueError):
        getattr(زمان, name)(2023, 2, 29)


def test_datetime_time_and_timezone_constructors():
    assert زمان.زمان_جهانی is زمان.نړیوال_وخت is datetime.timezone.utc
    for name in ("تاریخ_و_زمان", "نېټه_او_وخت"):
        assert getattr(زمان, name)(2024, 2, 29, 12, 30) == datetime.datetime(2024, 2, 29, 12, 30)
    for name in ("ساعت", "ګړۍ"):
        assert getattr(زمان, name)(12, 30) == datetime.time(12, 30)
    for name in ("منطقه_زمانی", "وخت_سیمه"):
        assert getattr(زمان, name)(datetime.timedelta(hours=4, minutes=30)) == datetime.timezone(
            datetime.timedelta(hours=4, minutes=30)
        )


@pytest.mark.parametrize("name", ["اکنون", "اوس"])
def test_current_datetime(name):
    before = datetime.datetime.now(datetime.timezone.utc)
    actual = getattr(زمان, name)(زمان.زمان_جهانی)
    after = datetime.datetime.now(datetime.timezone.utc)
    assert before <= actual <= after
    assert actual.tzinfo is datetime.timezone.utc


@pytest.mark.parametrize("name", ["امروز", "نن"])
def test_current_date(name):
    before = datetime.date.today()
    actual = getattr(زمان, name)()
    after = datetime.date.today()
    assert before <= actual <= after


def test_duration_units_and_date_arithmetic():
    expected = datetime.timedelta(weeks=1, days=2, hours=3, minutes=4, seconds=5)
    assert زمان.مدت(هفته=1, روز=2, ساعت=3, دقیقه=4, ثانیه=5) == expected
    assert زمان.موده(اونۍ=1, ورځې=2, ساعتونه=3, دقیقې=4, ثانیې=5) == expected
    assert زمان.مدت() == زمان.موده() == datetime.timedelta()
    assert زمان.تاریخ(2024, 2, 28) + زمان.مدت(روز=1) == datetime.date(2024, 2, 29)
    assert زمان.موده(ورځې=-1) == datetime.timedelta(days=-1)
    assert زمان.مدت(روز=0.5) == datetime.timedelta(hours=12)


@pytest.mark.parametrize("formatter", ["قالب", "بڼه"])
def test_date_time_formatting(formatter):
    format_value = getattr(زمان, formatter)
    assert format_value(زمان.تاریخ(2024, 2, 29)) == "2024-02-29"
    assert format_value(زمان.ساعت(12, 30)) == "12:30:00"
    value = زمان.تاریخ_و_زمان(2024, 2, 29, 12, 30)
    assert format_value(value) == "2024-02-29T12:30:00"
    assert format_value(value, "%d/%m/%Y") == "29/02/2024"


@pytest.mark.parametrize("parser", ["تجزیه", "لوستل"])
def test_datetime_parsing(parser):
    parse = getattr(زمان, parser)
    assert parse("2024-02-29T12:30:00") == datetime.datetime(2024, 2, 29, 12, 30)
    assert parse("29/02/2024", "%d/%m/%Y") == datetime.datetime(2024, 2, 29)
    with pytest.raises(ValueError):
        parse("not a date")


@pytest.mark.parametrize(
    "module, counterpart, function",
    [("ریاضي", "ریاضی", "مربع_ریښه"),
     ("تصادفي", "تصادفی", "ټاکنه"),
     ("وخت", "زمان", "بڼه")],
)
def test_pashto_module_paths(module, counterpart, function):
    localized = importlib.import_module("balkh.stdlib." + module)
    original = importlib.import_module("balkh.stdlib." + counterpart)
    assert getattr(localized, function) is getattr(original, function)


@pytest.mark.parametrize(
    "source",
    [
        "از balkh.stdlib وارد ریاضی\nنتیجه = ریاضی.جذر(۸۱)",
        "له balkh.stdlib راوړل ریاضي\nنتیجه = ریاضي.مربع_ریښه(۸۱)",
        "وارد balkh.stdlib.ریاضی بعنوان حساب\nنتیجه = حساب.جذر(۸۱)",
        "راوړل balkh.stdlib.ریاضي لکه حساب\nنتیجه = حساب.مربع_ریښه(۸۱)",
        "از balkh.stdlib.ریاضی وارد جذر بعنوان ریشه\nنتیجه = ریشه(۸۱)",
        "له balkh.stdlib.ریاضي راوړل مربع_ریښه لکه ریښه\nنتیجه = ریښه(۸۱)",
    ],
)
def test_balkh_import_forms(source):
    namespace = {}
    exec(transpile(source), namespace)
    assert namespace["نتیجه"] == 9


@pytest.mark.parametrize("module", ["ریاضی", "ریاضي", "تصادفی", "تصادفي", "زمان", "وخت"])
def test_star_imports_expose_localized_names_only(module):
    namespace = {}
    exec(transpile(f"از balkh.stdlib.{module} وارد *"), namespace)
    public = set(namespace) - {"__builtins__"}
    assert public
    assert all(not name.isascii() for name in public)
    assert all(not name.startswith("_") for name in public)


def test_localized_durations_work_through_transpiler():
    namespace = {}
    exec(transpile(
        "از balkh.stdlib وارد زمان, وخت\n"
        "فردا = زمان.تاریخ(۲۰۲۴, ۲, ۲۸) + زمان.مدت(روز=۱)\n"
        "سبا = وخت.نېټه(۲۰۲۴, ۲, ۲۸) + وخت.موده(ورځې=۱)\n"
    ), namespace)
    assert namespace["فردا"] == namespace["سبا"] == datetime.date(2024, 2, 29)


def test_wrappers_in_repl(capsys):
    console = BalkhConsole()
    assert console.push("له balkh.stdlib راوړل ریاضي, وخت") is False
    assert console.push("ریاضي.مربع_ریښه(۸۱)") is False
    assert console.push("وخت.بڼه(وخت.نېټه(۲۰۲۴, ۲, ۲۹))") is False
    captured = capsys.readouterr()
    assert captured.out == "9.0\n'2024-02-29'\n"
    assert captured.err == ""
