import sys
import os
import tokenize
from io import BytesIO
from balkh.keywords import KEYWORDS

def normalize_digits(code: str) -> str:
    persian_digits = "۰۱۲۳۴۵۶۷۸۹"
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    english_digits = "0123456789"
    table = str.maketrans(persian_digits + arabic_digits, english_digits * 2)
    return code.translate(table)

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

def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print("زبان برنامه‌نویسی بلخ (Balkh v0.1.0)")
        print("استفاده:")
        print("  balkh <file.blk>        اجرای برنامه")
        print("  balkh <file.blk> --py   نمایش کد ترجمه شده پایتون")
        sys.exit(0)

    file_path = sys.argv[1]
    show_python = "--py" in sys.argv

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

    if show_python:
        print(python_code)
        sys.exit(0)

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
