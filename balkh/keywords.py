# Preferred spellings are listed as (Dari, Pashto). Shared words appear twice.
# Where no separate Pashto alias exists yet, retain the existing shared alias.
_ALIASES = {
    # Functions and classes
    "def": ("تابع", "فنکشن"),
    "return": ("برگشت", "بېرته"),
    "class": ("صنف", "صنف"),
    "pass": ("خالی", "تش"),
    "lambda": ("لامبدا", "لامبدا"),
    # Conditionals
    "if": ("اگر", "که"),
    "elif": ("وگرنه_اگر", "که_نه_نو"),
    "else": ("وگرنه", "که_نه"),
    # Loops
    "for": ("برای", "دپاره"),
    "in": ("در", "کې"),
    "while": ("تاوقتی", "ترڅو"),
    "break": ("توقف", "ودرېږه"),
    "continue": ("ادامه", "دوام"),
    # Logic, booleans, and null
    "True": ("درست", "سم"),
    "False": ("غلط", "غلط"),
    "None": ("هیچ", "هېڅ"),
    "and": ("و", "او"),
    "or": ("یا", "یا"),
    "not": ("نه", "نه"),
    "is": ("است", "دی"),
    # Imports and context
    "import": ("وارد", "راوړل"),
    "from": ("از", "له"),
    "as": ("بعنوان", "لکه"),
    "with": ("با", "سره"),
    # Error handling
    "try": ("تلاش", "هڅه"),
    "except": ("بجز", "پرته"),
    "finally": ("بالاخره", "په_پای"),
    "raise": ("خطا_بده", "تېروتنه"),
    # Scope and async
    "global": ("سراسری", "نړیوال"),
    "async": ("غیرهمزمان", "غیرهمزمان"),
    "await": ("انتظار", "انتظار"),
    # Common built-in functions
    "print": ("چاپ", "چاپول"),
    "input": ("ورودی", "ننوت"),
    "range": ("محدوده", "حدود"),
    "len": ("طول", "اوږدوالی"),
    "int": ("عدد", "عدد"),
    "float": ("اعشاری", "اعشاری"),
    "str": ("رشته", "لیکنه"),
    "list": ("لیست", "لیست"),
    "dict": ("لغتنامه", "سیند"),
    "type": ("نوع", "ډول"),
    "open": ("باز", "پرانیستل"),
}

KEYWORDS = {
    native: python
    for python, aliases in _ALIASES.items()
    for native in aliases
}

REVERSE_KEYWORDS = {
    language: {python: aliases[index] for python, aliases in _ALIASES.items()}
    for index, language in enumerate(("dari", "pashto"))
}
