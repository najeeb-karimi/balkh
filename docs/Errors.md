# 🩺 Errors and Tracebacks

Balkh reports errors in Dari by default. Select Pashto with `--lang pashto`; this option also selects the language of reverse translation when using `--to-blk`.

```bash
balkh app.blk --lang dari
balkh app.blk --lang pashto
balkh --lang pashto
```

In the browser Playground, choose the diagnostic language from **Error messages** in Results. It applies to the next run and is independent of the interface language.

## 💬 Explanations and Hints

| Exception | Guidance |
| --- | --- |
| `NameError` (including `UnboundLocalError`) | Check the variable/function spelling and assign a value before using it. |
| `TypeError` | Check operand types and the function's argument types/count. |
| `ZeroDivisionError` | Check the divisor before division or remainder operations. |
| `IndexError` | Check the sequence length and valid index range. |
| `SyntaxError`, `IndentationError`, `TabError` | Check syntax, colons, quotes, brackets, and consistent indentation. |
| Tokenization errors | Check unfinished or mismatched brackets, quotes, and line endings. |
| Other exceptions | Show localized general guidance and retain the original exception message. |

The exception class name and precise Python message are kept alongside the localized explanation and hint. This preserves details such as incompatible types, argument counts, or custom application messages.

## 📍 Original Source Locations

For this `app.blk`:

```python
تابع تقسیم(الف, ب):
    برگشت الف / ب
چاپ(تقسیم(۱۰, ۰))
```

Running `balkh app.blk` reports:

```text
خطای اجرا (ZeroDivisionError):
  در app.blk، خط ۳ (برنامه)
    چاپ(تقسیم(۱۰, ۰))
  در app.blk، خط ۲ (تقسیم)
        برگشت الف / ب
  تقسیم یا باقیمانده با صفر ممکن نیست.
  جزئیات Python: division by zero
  راهنما: مقدار مقسوم‌علیه را پیش از تقسیم بررسی کنید.
```

`--lang pashto` uses Pashto labels, explanations, and hints, including `کرښه` for a source line and `لارښوونه` for a hint. Balkh's source location labels use native digits (`۰۱۲۳۴۵۶۷۸۹`). File names, original source text, and Python messages retain their original spelling.

The call stack shows the original program's frames in call order. Interpreter and library implementation frames are omitted; a failing library call still shows the program line that called it. Explicit causes (`raise ... from ...`) and implicit exception contexts are shown with localized connecting messages. Suppressing a context with `raise ... from None` also suppresses it in the diagnostic.

## 🐚 Interactive Shell

The REPL uses the same diagnostics and continues after errors. Variables and functions remain available. Each completed input has its own source label, such as `<بلخ:۱>`, so a function defined earlier still points to its original definition if it fails later.

Open brackets, triple-quoted strings, and unfinished blocks continue to request input. Finish an indented block with an empty line, or cancel pending input with Ctrl+C.

## 🖥️ Streams and Exit Status

Diagnostics go to standard error; program output stays on standard output. An uncaught file execution error, syntax error, or file read/write failure exits with status `1`. Invalid command-line arguments exit with status `2`. A program's explicit `SystemExit` retains its requested status. Errors handled by the program's own `try` / `except` blocks follow normal Python behavior.

Export validation uses the selected diagnostic language:

```bash
balkh app.blk --py --lang pashto
balkh app.blk --to-py app.py --lang pashto
balkh app.py --to-blk app.blk --lang pashto
```

Running an exported `.py` directly uses Python's error reporting. Run a `.blk` with Balkh for localized diagnostics.
