import argparse
import code
import sys
import os
import tokenize
from io import BytesIO
from balkh import __version__
from balkh.keywords import KEYWORDS

def normalize_digits(code: str) -> str:
    """Normalize code digits while preserving string literals and comments."""
    persian_digits = "۰۱۲۳۴۵۶۷۸۹"
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    english_digits = "0123456789"
    table = str.maketrans(persian_digits + arabic_digits, english_digits * 2)
    line_offsets = [0]
    for line in code.split("\n"):
        line_offsets.append(line_offsets[-1] + len(line) + 1)

    preserved_types = {tokenize.STRING, tokenize.COMMENT}
    # Python 3.12+ tokenizes f-string text separately from its expressions.
    if hasattr(tokenize, "FSTRING_MIDDLE"):
        preserved_types.add(tokenize.FSTRING_MIDDLE)

    parts = []
    cursor = 0
    tokens = tokenize.tokenize(BytesIO(code.encode("utf-8")).readline)
    for tok in tokens:
        if tok.type in preserved_types:
            start = line_offsets[tok.start[0] - 1] + tok.start[1]
            end = line_offsets[tok.end[0] - 1] + tok.end[1]
            parts.append(code[cursor:start].translate(table))
            parts.append(code[start:end])
            cursor = end
    parts.append(code[cursor:].translate(table))
    return "".join(parts)

def transpile(source_code: str) -> str:
    normalized = normalize_digits(source_code)
    result_tokens = []
    tokens = tokenize.tokenize(BytesIO(normalized.encode("utf-8")).readline)

    for tok in tokens:
        if tok.type == tokenize.NAME and tok.string in KEYWORDS:
            result_tokens.append((tok.type, KEYWORDS[tok.string]))
        else:
            result_tokens.append((tok.type, tok.string))

    return tokenize.untokenize(result_tokens).decode("utf-8")

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
    parser.add_argument("file", nargs="?", help="فایل بلخ برای اجرا (.blk)")
    parser.add_argument(
        "--py", action="store_true", help="نمایش کد ترجمه شده پایتون"
    )
    args = parser.parse_args(argv)
    if args.file is None:
        if args.py:
            parser.error("--py requires a .blk file")
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

    with open(file_path, "r", encoding="utf-8") as f:
        balkh_code = f.read()

    try:
        python_code = transpile(balkh_code)
    except tokenize.TokenError as e:
        print(f"خطای نگارشی در توکن‌ها: {e}")
        print("قوس‌ها یا ناخنک‌ها را چک کو!")
        sys.exit(1)

    if args.py:
        print(python_code)
        return

    try:
        exec_globals = {"__name__": "__main__", "__file__": file_path}
        exec(python_code, exec_globals)
    except SyntaxError as e:
        print(f"او برادر! خطای نگارشی (SyntaxError) در خط {e.lineno}:")
        print(f"  {e.text.strip() if e.text else ''}")
        print("یک پیاله چای سبز بخور و دوباره کوشش کو! ☕")
    except Exception as e:
        print(f"خطای اجرا ({type(e).__name__}): {e}")

if __name__ == "__main__":
    main()
