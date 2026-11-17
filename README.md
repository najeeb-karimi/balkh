# 🏛️ Balkh (زبان برنامه‌نویسی بلخ)

**Balkh** is the first bilingual **Dari & Pashto** programming language, transpiled directly to Python. 

Named after the ancient Afghan center of science, mathematics, and literature (*Umm al-Bilad*), Balkh lets you write real Python programs using native Dari keywords, Pashto keywords, and Persian/Pashto numerals (`۰-۹`).

## ✨ Features
- **Bilingual Syntax:** Write in Dari (`اگر`, `تابع`, `چاپ`), Pashto (`که`, `فنکشن`, `چاپول`), or mix both in the same file.
- **Native Numerals:** Automatically converts numeric literals such as `۱۲۳` to `123`, preserving text inside strings and comments.
- **Full Python Ecosystem:** Import and use any standard or third-party Python library (`random`, `math`, `json`, `requests`, etc.).
- **Friendly Error Messages:** Helpful, culturally flavored error hints when you miss a bracket.
- **Interactive Shell:** Run `balkh` without a filename to try expressions, keep variables, and write multi-line programs live.
- **Bidirectional Translation:** Export Balkh as Python, or translate Python into Dari or Pashto Balkh without executing it.

## 🚀 Quick Start

1. **Clone & Install:**
   ```bash
   git clone https://github.com
   cd balkh
   pip install -e .
   ```

2. **Run an Example:**
   ```bash
   balkh examples/salam.blk
   ```

3. **Inspect the Generated Python Code:**
   ```bash
   balkh examples/salam.blk --py
   ```

4. **Start an Interactive Shell:**
   ```bash
   balkh
   ```

   ```text
   بلخ >>> نام = "بلخ"
   بلخ >>> چاپ("سلام", نام)
   سلام بلخ
   بلخ >>> ۲ + ۳
   5
   بلخ >>> تابع دوبرابر(مقدار):
   بلخ ...     بېرته مقدار * ۲
   بلخ ...
   بلخ >>> دوبرابر(۴)
   8
   ```

   End an indented block with an empty line. Variables, functions, and imports stay available throughout the session. Press Ctrl+C to cancel pending input. Exit with `exit()`, `quit()`, or EOF (Ctrl+Z then Enter on Windows; Ctrl+D on Linux/macOS).

## Translating Files

Save a Balkh program as Python:

```bash
balkh examples/salam.blk --to-py salam.py
```

Translate Python into Balkh using preferred Dari or Pashto aliases. Without an output path, `--to-blk` prints the translated code:

```bash
balkh salam.py --to-blk --lang dari
balkh salam.py --to-blk salam-pashto.blk --lang pashto
balkh salam-pashto.blk
```

`--lang` defaults to `dari` and requires `--to-blk`. The translation modes (`--py`, `--to-py`, and `--to-blk`) are mutually exclusive. `--py` continues to display Python without saving it.

Translation preserves strings, comments, numeric spellings, and formatting; exporting Balkh to Python converts native numeric literals to Python digits. Python keywords without a localized alias remain in English. Pashto output uses existing shared aliases where a separate Pashto spelling is not available yet.

Saved files use UTF-8, with any encoding header updated to match. An explicitly named output file is replaced after translation succeeds; input and output must be different files. Neither export mode runs the source program.

## Running Tests

Install the test dependencies and run the suite:

```bash
python -m pip install -e ".[test]"
python -m pytest
```

## 🤝 Contributing
Want to add better Pashto or Dari aliases, translate standard library wrappers (`ریاضی.py`), or add funny error messages? Pull requests are warmly welcomed!
