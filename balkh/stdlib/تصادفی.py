"""Localized aliases sharing Python random's module-level generator.

Functions retain Python's random signatures, return types, and exceptions.
Use positional arguments with the localized aliases.
"""

import random as _random

عدد_صحیح = بشپړ_شمېر = _random.randint
اعشاری_تصادفی = تصادفي_شمېره = _random.random
یکنواخت = یوشان = _random.uniform
انتخاب = ټاکنه = _random.choice
نمونه = _random.sample
درهم_کردن = ګډول = _random.shuffle
بذر = تخم = _random.seed

__all__ = [
    "عدد_صحیح", "بشپړ_شمېر", "اعشاری_تصادفی", "تصادفي_شمېره",
    "یکنواخت", "یوشان", "انتخاب", "ټاکنه", "نمونه", "درهم_کردن", "ګډول",
    "بذر", "تخم",
]
