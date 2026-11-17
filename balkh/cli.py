import argparse
import code
import os
from pathlib import Path
import re
import sys
import tokenize

from balkh import __version__
from balkh.translator import normalize_digits, reverse_transpile, transpile


class BalkhConsole(code.InteractiveConsole):
    """An interactive Python console accepting Balkh source code."""

    def __init__(self):
        super().__init__(
            locals={"__name__": "__main__", "__doc__": None}, filename="<balkh>"
        )

    def raw_input(self, prompt=""):
        return input("بلخ ... " if self.buffer else "بلخ >>> ")

    def runsource(self, source, filename="<balkh>", symbol="single"):
        try:
            python_code = transpile(source)
        except tokenize.TokenError as error:
            # Open brackets, explicit continuations, and triple-quoted strings
            # need another input line before they can be transpiled.
            if error.args[0].startswith(
                ("EOF in multi-line", "unexpected EOF in multi-line")
            ):
                return True
            self.write(f"خطای نگارشی در توکن‌ها: {error}\n")
            return False
        except (SyntaxError, OverflowError, ValueError):
            self.showsyntaxerror(filename)
            return False
        return super().runsource(python_code, filename, symbol)


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="balkh",
        description=f"زبان برنامه‌نویسی بلخ (Balkh v{__version__})",
    )
    parser.add_argument("file", nargs="?", help="فایل برنامه (.blk یا .py)")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument(
        "--py", action="store_true", help="نمایش کد ترجمه شده پایتون"
    )
    modes.add_argument("--to-py", metavar="OUTPUT", help="ذخیره کد پایتون در فایل")
    modes.add_argument(
        "--to-blk", nargs="?", const="", metavar="OUTPUT",
        help="ترجمه پایتون به بلخ؛ نمایش کد یا ذخیره در فایل",
    )
    parser.add_argument(
        "--lang", choices=("dari", "pashto"),
        help="زبان ترجمه با --to-blk (پیش‌فرض: dari)",
    )
    args = parser.parse_args(argv)
    if args.lang is not None and args.to_blk is None:
        parser.error("--lang requires --to-blk")
    if args.file is None:
        if args.py or args.to_py is not None or args.to_blk is not None:
            parser.error("translation flags require an input file")
        BalkhConsole().interact(
            banner=(
                f"زبان برنامه‌نویسی بلخ (Balkh v{__version__})\n"
                "برای اجرای بلاک، یک خط خالی وارد کنید. "
                "برای پایان exit() یا quit() را بنویسید."
            ),
            exitmsg="",
        )
        return

    file_path = args.file

    if not os.path.exists(file_path):
        print(f"او برادر! فایل '{file_path}' پیدا نشد.")
        sys.exit(1)

    output_path = args.to_py if args.to_py is not None else args.to_blk or None
    try:
        if output_path is not None and (
            Path(output_path).resolve() == Path(file_path).resolve()
            or (os.path.exists(output_path) and os.path.samefile(file_path, output_path))
        ):
            parser.error("input and output must be different files")
        if args.to_blk is not None:
            # Respect Python encoding cookies and UTF-8 BOMs on Python input.
            with tokenize.open(file_path) as f:
                f.reconfigure(newline="")
                source_code = f.read()
        else:
            with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
                source_code = f.read()
    except (OSError, UnicodeError, SyntaxError) as error:
        parser.exit(1, f"خطای خواندن فایل '{file_path}': {error}\n")

    try:
        if args.to_blk is not None:
            compile(source_code, file_path, "exec")
            translated_code = reverse_transpile(source_code, args.lang or "dari")
        else:
            translated_code = transpile(source_code)
            if args.to_py is not None:
                compile(translated_code, file_path, "exec")
    except tokenize.TokenError as e:
        print(f"خطای نگارشی در توکن‌ها: {e}")
        print("قوس‌ها یا ناخنک‌ها را چک کو!")
        sys.exit(1)
    except (SyntaxError, ValueError) as error:
        parser.exit(1, f"خطای نگارشی ({type(error).__name__}): {error}\n")

    if output_path is not None:
        # Saved files are UTF-8, including when Python input declared another encoding.
        lines = translated_code.split("\n")
        for index in range(min(2, len(lines))):
            cookie = re.match(
                r"(^[ \t\f]*#.*?coding[:=][ \t]*)([-\w.]+)",
                lines[index], flags=re.ASCII,
            )
            if cookie:
                lines[index] = cookie[1] + "utf-8" + lines[index][cookie.end():]
                break
            if (
                lines[index].strip(" \t\f\r")
                and not lines[index].lstrip(" \t\f").startswith("#")
            ):
                break
        try:
            with open(output_path, "w", encoding="utf-8", newline="") as f:
                f.write("\n".join(lines))
        except (OSError, UnicodeError) as error:
            parser.exit(1, f"خطای نوشتن فایل '{output_path}': {error}\n")
        return

    if args.py:
        print(translated_code.replace("\r\n", "\n"))
        return
    if args.to_blk is not None:
        # Let stdout apply platform newline conversion only once.
        sys.stdout.write(translated_code.replace("\r\n", "\n"))
        return

    try:
        exec_globals = {"__name__": "__main__", "__file__": file_path}
        exec(translated_code, exec_globals)
    except SyntaxError as e:
        print(f"او برادر! خطای نگارشی (SyntaxError) در خط {e.lineno}:")
        print(f"  {e.text.strip() if e.text else ''}")
        print("یک پیاله چای سبز بخور و دوباره کوشش کو! ☕")
    except Exception as e:
        print(f"خطای اجرا ({type(e).__name__}): {e}")

if __name__ == "__main__":
    main()
