import argparse
import code
import os
from pathlib import Path
import re
import sys
import tokenize

from balkh import __version__
from balkh.errors import format_error, format_file_error
from balkh.preview import python_preview
from balkh.translator import normalize_digits, reverse_transpile, transpile


class BalkhConsole(code.InteractiveConsole):
    """An interactive Python console accepting Balkh source code."""

    def __init__(self, language="dari"):
        if language not in ("dari", "pashto"):
            raise ValueError("language must be 'dari' or 'pashto'")
        super().__init__(
            locals={"__name__": "__main__", "__doc__": None}, filename="<balkh>"
        )
        self.language = language
        self._sources = {}
        self._next_input = 1
        self._active_filename = self.filename

    def raw_input(self, prompt=""):
        return input("بلخ ... " if self.buffer else "بلخ >>> ")

    def runsource(self, source, filename="<balkh>", symbol="single"):
        # Functions retain their defining input's source even after later commands.
        filename = f"<balkh:{self._next_input}>"
        self._active_filename = filename
        self._sources[filename] = source
        try:
            python_code = transpile(source)
        except tokenize.TokenError as error:
            # Open brackets, explicit continuations, and triple-quoted strings
            # need another input line before they can be transpiled.
            if error.args[0].startswith(
                ("EOF in multi-line", "unexpected EOF in multi-line")
            ):
                return True
            self.write(format_error(error, self.language, self._sources, filename))
            self._next_input += 1
            return False
        except (SyntaxError, OverflowError, ValueError):
            self.showsyntaxerror(filename)
            self._next_input += 1
            return False
        more = super().runsource(python_code, filename, symbol)
        if not more:
            self._next_input += 1
        return more

    def showsyntaxerror(self, filename=None, **kwargs):
        self.showtraceback()

    def showtraceback(self):
        error = sys.exc_info()[1]
        if error is not None:
            self.write(format_error(
                error, self.language, self._sources, self._active_filename
            ))


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="balkh",
        description=f"زبان برنامه‌نویسی بلخ (Balkh v{__version__})",
    )
    parser.add_argument("file", nargs="?", help="فایل برنامه (.blk یا .py)")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument(
        "--py", action="store_true", help="نمایش کود ترجمه شده پایتون"
    )
    modes.add_argument("--to-py", metavar="OUTPUT", help="ذخیره کود پایتون در فایل")
    modes.add_argument(
        "--to-blk", nargs="?", const="", metavar="OUTPUT",
        help="ترجمه پایتون به بلخ؛ نمایش کود یا ذخیره در فایل",
    )
    parser.add_argument(
        "--lang", choices=("dari", "pashto"), default="dari",
        help="زبان پیام‌های خطا و ترجمه با --to-blk (پیش‌فرض: dari)",
    )
    args = parser.parse_args(argv)
    if args.file is None:
        if args.py or args.to_py is not None or args.to_blk is not None:
            parser.error("translation flags require an input file")
        instructions = {
            "dari": "برای اجرای بلاک، یک خط خالی وارد کنید. برای پایان exit() یا quit() را بنویسید.",
            "pashto": "د بلاک د اجرا لپاره یوه تشه کرښه ولیکئ. د وتلو لپاره exit() یا quit() ولیکئ.",
        }
        title = "زبان برنامه‌نویسی بلخ" if args.lang == "dari" else "د بلخ پروګرامینګ ژبه"
        BalkhConsole(args.lang).interact(
            banner=(
                f"{title} (Balkh v{__version__})\n{instructions[args.lang]}"
            ),
            exitmsg="",
        )
        return

    file_path = args.file

    if not os.path.exists(file_path):
        parser.exit(1, format_file_error(file_path, "missing", language=args.lang))

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
        parser.exit(1, format_file_error(file_path, "read", error, args.lang))

    sources = {file_path: source_code}
    try:
        if args.to_blk is not None:
            compile(source_code, file_path, "exec")
            translated_code = reverse_transpile(source_code, args.lang)
        else:
            translated_code = transpile(source_code)
            compiled_code = compile(translated_code, file_path, "exec")
            if args.py or args.to_py is not None:
                translated_code = python_preview(translated_code)
                compile(translated_code, file_path, "exec")
    except (tokenize.TokenError, SyntaxError, ValueError, OverflowError) as error:
        parser.exit(1, format_error(error, args.lang, sources, file_path))

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
            parser.exit(1, format_file_error(output_path, "write", error, args.lang))
        return

    if args.py or args.to_blk is not None:
        # Let stdout apply platform newline conversion only once.
        sys.stdout.write(translated_code.replace("\r\n", "\n"))
        return

    try:
        exec_globals = {"__name__": "__main__", "__file__": file_path}
        exec(compiled_code, exec_globals)
    except Exception as error:
        parser.exit(1, format_error(error, args.lang, sources, file_path))

if __name__ == "__main__":
    main()
