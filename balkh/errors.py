"""Localized diagnostics using original Balkh source locations."""

import tokenize


_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
_LABELS = {
    "dari": {
        "runtime": "خطای اجرا",
        "syntax": "خطای نگارشی",
        "location": "در {filename}، خط {line} ({function})",
        "module": "برنامه",
        "hint": "راهنما",
        "name": "نام",
        "details": "جزئیات Python",
        "cause": "خطای بالا باعث خطای بعدی شد:",
        "context": "هنگام رسیدگی به خطای بالا، خطای دیگری رخ داد:",
        "missing": "فایل '{filename}' پیدا نشد.",
        "read": "خطای خواندن فایل '{filename}'",
        "write": "خطای نوشتن فایل '{filename}'",
    },
    "pashto": {
        "runtime": "د اجرا تېروتنه",
        "syntax": "د لیکنې تېروتنه",
        "location": "په {filename} کې، کرښه {line} ({function})",
        "module": "پروګرام",
        "hint": "لارښوونه",
        "name": "نوم",
        "details": "د Python جزئیات",
        "cause": "پورته تېروتنه د بلې تېروتنې لامل شوه:",
        "context": "د پورته تېروتنې د سمبالولو پر مهال بله تېروتنه رامنځته شوه:",
        "missing": "دوتنه '{filename}' ونه موندل شوه.",
        "read": "د دوتنې د لوستلو تېروتنه '{filename}'",
        "write": "د دوتنې د لیکلو تېروتنه '{filename}'",
    },
}

# Each entry contains an explanation and an actionable hint.
_MESSAGES = {
    "dari": {
        "name": ("این نام تعریف نشده است.", "نام متغیر یا تابع را بررسی کنید و پیش از استفاده به آن مقدار بدهید."),
        "type": ("نوع مقدارها با این عملیات یا ورودی تابع سازگار نیست.", "نوع مقدارها و تعداد آرگومان‌های تابع را بررسی کنید."),
        "zero": ("تقسیم یا باقیمانده با صفر ممکن نیست.", "مقدار مقسوم‌علیه را پیش از تقسیم بررسی کنید."),
        "index": ("این اندیس در دنباله وجود ندارد.", "طول دنباله و محدودهٔ اندیس را بررسی کنید؛ اندیس نخست صفر است."),
        "indent": ("تورفتگی خط‌ها درست نیست.", "تورفتگی بلاک را یکسان نگه دارید و فاصله و تب را مخلوط نکنید."),
        "syntax": ("ساختار این دستور درست نیست.", "دونقطه، قوس‌ها، ناخنک‌ها و تورفتگی را بررسی کنید."),
        "token": ("قوس‌ها یا ناخنک‌ها کامل یا درست نیستند.", "قوس‌ها و ناخنک‌های باز را ببندید و پایان خط را بررسی کنید."),
        "other": ("برنامه با یک خطا متوقف شد.", "خط مشخص‌شده و پیام خطا را بررسی کنید."),
    },
    "pashto": {
        "name": ("دا نوم نه دی تعریف شوی.", "د متغیر یا فنکشن نوم وګورئ او له کارولو مخکې ارزښت ورکړئ."),
        "type": ("د ارزښتونو ډولونه له دې عملیاتو یا د فنکشن له ورودي سره سمون نه لري.", "د ارزښتونو ډولونه او د فنکشن د آرګومانونو شمېر وګورئ."),
        "zero": ("پر صفر وېشل یا د صفر په وسیله پاتې شونی اخیستل ممکن نه دي.", "له وېشلو مخکې د وېشونکي ارزښت وګورئ."),
        "index": ("دا اندیس په لړۍ کې نشته.", "د لړۍ اوږدوالی او د اندیس حدود وګورئ؛ لومړی اندیس صفر دی."),
        "indent": ("د کرښو تورفتګي سمه نه ده.", "د بلاک تورفتګي یوشان وساتئ او تشې او ټبونه مه ګډوئ."),
        "syntax": ("د دې دستور جوړښت سم نه دی.", "دوه ټکي، قوسونه، ناخنکونه او تورفتګي وګورئ."),
        "token": ("قوسونه یا ناخنکونه بشپړ یا سم نه دي.", "پرانیستي قوسونه او ناخنکونه وتړئ او د کرښې پای وګورئ."),
        "other": ("پروګرام د یوې تېروتنې له امله ودرېد.", "ښودل شوې کرښه او د تېروتنې پیغام وګورئ."),
    },
}


def _language(language):
    if language not in _LABELS:
        raise ValueError("language must be 'dari' or 'pashto'")
    return _LABELS[language]


def _category(error):
    for exception_type, category in (
        (IndentationError, "indent"),
        (SyntaxError, "syntax"),
        (tokenize.TokenError, "token"),
        (NameError, "name"),
        (TypeError, "type"),
        (ZeroDivisionError, "zero"),
        (IndexError, "index"),
    ):
        if isinstance(error, exception_type):
            return category
    return "other"


def _locations(error, sources, filename):
    if isinstance(error, (SyntaxError, tokenize.TokenError)):
        path = getattr(error, "filename", None)
        if path not in sources:
            path = filename
        line = getattr(error, "lineno", None)
        if isinstance(error, tokenize.TokenError) and len(error.args) > 1:
            line = error.args[1][0]
        if path in sources and line is not None:
            return [(path, line, "<module>")]

    locations = []
    traceback = error.__traceback__
    while traceback is not None:
        frame_code = traceback.tb_frame.f_code
        if frame_code.co_filename in sources:
            locations.append((frame_code.co_filename, traceback.tb_lineno, frame_code.co_name))
        traceback = traceback.tb_next
    return locations


def _format_single(error, language, sources, filename):
    labels = _LABELS[language]
    category = _category(error)
    title = labels["syntax" if category in ("syntax", "indent", "token") else "runtime"]
    lines = [f"{title} ({type(error).__name__}):"]
    for path, line, function in _locations(error, sources, filename):
        display_path = path
        if path.startswith("<balkh:") and path.endswith(">"):
            display_path = path.replace("balkh:", "بلخ:").translate(_DIGITS)
        location = labels["location"].format(
            filename=display_path, line=str(line).translate(_DIGITS),
            function=labels["module"] if function == "<module>" else function,
        )
        lines.append("  " + location)
        source_lines = sources[path].split("\n")
        if 1 <= line <= len(source_lines) and source_lines[line - 1].strip():
            lines.append("    " + source_lines[line - 1].rstrip("\r"))
    explanation, hint = _MESSAGES[language][category]
    lines.append("  " + explanation)
    if category == "name" and getattr(error, "name", None):
        lines.append(f"  {labels['name']}: {error.name}")
    # Keep precise Python details and custom messages alongside localized guidance.
    if isinstance(error, SyntaxError):
        detail = error.msg
    elif isinstance(error, tokenize.TokenError):
        detail = error.args[0] if error.args else ""
    else:
        detail = str(error)
    if detail:
        lines.append(f"  {labels['details']}: {detail}")
    lines.append(f"  {labels['hint']}: {hint}")
    return lines


def format_error(error, language="dari", sources=None, filename=None):
    """Format an exception chain with localized hints and known source frames.

    ``sources`` maps compiled filenames to original Balkh source strings. Only
    these frames are shown, excluding interpreter and library implementation frames.
    """
    labels = _language(language)
    sources = sources or {}
    lines = []
    seen = set()

    def append(current):
        if id(current) in seen:
            return
        seen.add(id(current))
        previous = current.__cause__
        relation = "cause"
        if previous is None and not current.__suppress_context__:
            previous = current.__context__
            relation = "context"
        if previous is not None and id(previous) not in seen:
            append(previous)
            lines.append(labels[relation])
        lines.extend(_format_single(current, language, sources, filename))

    append(error)
    return "\n".join(lines) + "\n"


def format_file_error(filename, operation, error=None, language="dari"):
    """Format missing-file and read/write failures in the selected language."""
    message = _language(language)[operation].format(filename=filename)
    if error is not None:
        message += f": {error}"
    return message + "\n"
