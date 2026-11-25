# Localized Standard Library

The optional `balkh.stdlib` package provides native names for common Python math, random, and date/time operations. It needs no extra dependencies. Import modules explicitly in Balkh programs and in the REPL. The same modules are available in the Playground.

| Python library | Dari module | Pashto module |
| --- | --- | --- |
| `math` | `ریاضی` | `ریاضي` |
| `random` | `تصادفی` | `تصادفي` |
| `datetime` | `زمان` | `وخت` |

Each module exposes both Dari and Pashto function names. Names repeated in both columns below are shared spellings. Use regular package imports, including the `balkh.stdlib` prefix:

```python
از balkh.stdlib وارد ریاضی, تصادفی, زمان
چاپ(ریاضی.جذر(۸۱))
چاپ(تصادفی.انتخاب(["بلخ", "کابل"]))
چاپ(زمان.قالب(زمان.امروز()))
```

```python
له balkh.stdlib راوړل ریاضي, تصادفي, وخت
چاپول(ریاضي.مربع_ریښه(۸۱))
چاپول(تصادفي.ټاکنه(["بلخ", "کابل"]))
چاپول(وخت.بڼه(وخت.نن()))
```

Import individual helpers or give modules your own names:

```python
از balkh.stdlib.ریاضی وارد جذر
وارد balkh.stdlib.زمان بعنوان تقویم
چاپ(جذر(۸۱))
چاپ(تقویم.قالب(تقویم.تاریخ(۲۰۲۴, ۲, ۲۹)))
```

Run `balkh examples/stdlib.blk` for a complete mixed-language example. Export it with `balkh examples/stdlib.blk --to-py stdlib-demo.py` to use `math`, `random`, and `datetime` directly in the generated file. Use `--py` to display the same conversion. Explicit import aliases are preserved. Dynamic references to the wrappers can still require Balkh.

## Math

These aliases use the original `math` functions, including their signatures, return types, and errors. Use positional arguments with localized names, such as `ریاضی.توان(۲, ۳)` or `ریاضي.لگاریتم(۸, ۲)`.

| Python operation | Dari | Pashto |
| --- | --- | --- |
| `sqrt(x)` | `جذر` | `مربع_ریښه` |
| `pow(x, y)` | `توان` | `توان` |
| `fabs(x)` | `قدر_مطلق` | `مطلق_ارزښت` |
| `ceil(x)` | `سقف` | `پورته_ګردول` |
| `floor(x)` | `کف` | `ښکته_ګردول` |
| `factorial(n)` | `فاکتوریل` | `فاکټوریل` |
| `sin(x)` | `سینوس` | `سینوس` |
| `cos(x)` | `کسینوس` | `کسینوس` |
| `tan(x)` | `تانژانت` | `تانژانت` |
| `log(x, base)` | `لگاریتم` | `لگاریتم` |
| `log10(x)` | `لگاریتم_ده` | `لگاریتم_ده` |
| `exp(x)` | `نمایی` | `نمایی` |
| `radians(x)` | `رادیان` | `رادیان` |
| `degrees(x)` | `درجه` | `درجه` |
| `pi` | `پی` | `پی` |
| `e` | `ای` | `اي` |
| `tau` | `تاو` | `تاو` |
| `inf` | `بینهایت` | `بې_پایه` |

Trigonometric functions take radians. Omitting the base of `لگاریتم` uses the natural logarithm. Constants are values, used without parentheses.

## Random

These aliases share Python `random`'s module-level generator and retain its signatures and behavior. Use positional arguments with localized aliases. Seeding either wrapper also seeds Python's `random` module.

| Python operation | Dari | Pashto |
| --- | --- | --- |
| `randint(a, b)` (inclusive bounds) | `عدد_صحیح` | `بشپړ_شمېر` |
| `random()` (from 0 inclusive to 1 exclusive) | `اعشاری_تصادفی` | `تصادفي_شمېره` |
| `uniform(a, b)` | `یکنواخت` | `یوشان` |
| `choice(sequence)` | `انتخاب` | `ټاکنه` |
| `sample(population, count)` | `نمونه` | `نمونه` |
| `shuffle(sequence)` | `درهم_کردن` | `ګډول` |
| `seed(value)` | `بذر` | `تخم` |

`نمونه` samples without replacement. `درهم_کردن` / `ګډول` changes a list in place and returns `None`.

```python
له balkh.stdlib راوړل تصادفي
تصادفي.تخم(۴۲)
توکي = [۱, ۲, ۳, ۴]
تصادفي.ګډول(توکي)
چاپول(توکي)
چاپول(تصادفي.بشپړ_شمېر(۱, ۱۰))
```

## Dates and Times

Constructors return ordinary Python `datetime` objects and accept the standard positional arguments. Dates use the Gregorian calendar. The current-date/current-time helpers use the machine's local time by default; pass `زمان_جهانی` / `نړیوال_وخت` to the current-time helper for UTC.

| Python operation | Dari | Pashto |
| --- | --- | --- |
| `date(year, month, day)` | `تاریخ` | `نېټه` |
| `datetime(year, month, day, ...)` | `تاریخ_و_زمان` | `نېټه_او_وخت` |
| `time(hour, minute, ...)` | `ساعت` | `ګړۍ` |
| `timezone(offset)` | `منطقه_زمانی` | `وخت_سیمه` |
| `timezone.utc` (constant) | `زمان_جهانی` | `نړیوال_وخت` |
| `datetime.now(tz=None)` | `اکنون` | `اوس` |
| `date.today()` | `امروز` | `نن` |
| Duration helper returning `timedelta` | `مدت` | `موده` |
| Format as ISO text or with a pattern | `قالب` | `بڼه` |
| Parse a datetime from ISO text or a pattern | `تجزیه` | `لوستل` |

Durations accept localized units; all default to zero, and fractional or negative values follow Python's `timedelta` behavior:

```python
زمان.مدت(روز=۱, ساعت=۲, دقیقه=۳, ثانیه=۴, هفته=۱)
وخت.موده(ورځې=۱, ساعتونه=۲, دقیقې=۳, ثانیې=۴, اونۍ=۱)
```

Use positional arguments with the shared formatting/parsing aliases. Formatting a date, datetime, or time without a pattern returns ISO text. Parsing ISO text returns a datetime. A second argument supplies a Python `strftime` / `strptime` pattern:

```python
از balkh.stdlib وارد زمان
آغاز = زمان.تاریخ(۲۰۲۴, ۲, ۲۸)
فردا = آغاز + زمان.مدت(روز=۱)
چاپ(زمان.قالب(فردا))  # 2024-02-29
چاپ(زمان.قالب(فردا, "%d/%m/%Y"))  # 29/02/2024
لحظه = زمان.تجزیه("2024-02-29T12:30:00")
چاپ(زمان.قالب(لحظه))
چاپ(زمان.قالب(زمان.اکنون(زمان.زمان_جهانی)))
```
