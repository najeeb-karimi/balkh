"""Localized Gregorian date/time helpers returning Python datetime objects."""

import datetime as _datetime

تاریخ = نېټه = _datetime.date
تاریخ_و_زمان = نېټه_او_وخت = _datetime.datetime
ساعت = ګړۍ = _datetime.time
منطقه_زمانی = وخت_سیمه = _datetime.timezone
زمان_جهانی = نړیوال_وخت = _datetime.timezone.utc
اکنون = اوس = _datetime.datetime.now
امروز = نن = _datetime.date.today


def مدت(روز=0, ساعت=0, دقیقه=0, ثانیه=0, هفته=0):
    """Create a timedelta using Dari units (days, hours, minutes, seconds, weeks)."""
    return _datetime.timedelta(
        days=روز, hours=ساعت, minutes=دقیقه, seconds=ثانیه, weeks=هفته
    )


def موده(ورځې=0, ساعتونه=0, دقیقې=0, ثانیې=0, اونۍ=0):
    """Create a timedelta using Pashto units (days, hours, minutes, seconds, weeks)."""
    return مدت(ورځې, ساعتونه, دقیقې, ثانیې, اونۍ)


def قالب(مقدار, الگو=None):
    """Format a date, datetime, or time as ISO text or with a strftime pattern."""
    if الگو is None:
        return مقدار.isoformat()
    return مقدار.strftime(الگو)


بڼه = قالب


def تجزیه(متن, الگو=None):
    """Parse a datetime from ISO text or a strptime pattern."""
    if الگو is None:
        return _datetime.datetime.fromisoformat(متن)
    return _datetime.datetime.strptime(متن, الگو)


لوستل = تجزیه

__all__ = [
    "تاریخ", "نېټه", "تاریخ_و_زمان", "نېټه_او_وخت", "ساعت", "ګړۍ",
    "منطقه_زمانی", "وخت_سیمه", "زمان_جهانی", "نړیوال_وخت",
    "اکنون", "اوس", "امروز", "نن", "مدت", "موده", "قالب", "بڼه", "تجزیه", "لوستل",
]
