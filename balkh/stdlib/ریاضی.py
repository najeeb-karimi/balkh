"""Common math operations with Dari and Pashto aliases.

Functions retain Python's math signatures, return types, and exceptions.
Use positional arguments with the localized aliases.
"""

import math as _math

جذر = مربع_ریښه = _math.sqrt
توان = _math.pow
قدر_مطلق = مطلق_ارزښت = _math.fabs
سقف = پورته_ګردول = _math.ceil
کف = ښکته_ګردول = _math.floor
فاکتوریل = فاکټوریل = _math.factorial
سینوس = _math.sin
کسینوس = _math.cos
تانژانت = _math.tan
لگاریتم = _math.log
لگاریتم_ده = _math.log10
نمایی = _math.exp
رادیان = _math.radians
درجه = _math.degrees

پی = _math.pi
ای = اي = _math.e
تاو = _math.tau
بینهایت = بې_پایه = _math.inf

__all__ = [
    "جذر", "مربع_ریښه", "توان", "قدر_مطلق", "مطلق_ارزښت",
    "سقف", "پورته_ګردول", "کف", "ښکته_ګردول", "فاکتوریل", "فاکټوریل",
    "سینوس", "کسینوس", "تانژانت", "لگاریتم", "لگاریتم_ده", "نمایی",
    "رادیان", "درجه", "پی", "ای", "اي", "تاو", "بینهایت", "بې_پایه",
]
