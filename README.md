# 🏛️ Balkh (زبان برنامه‌نویسی بلخ)

**Balkh** is the first bilingual **Dari & Pashto** programming language, transpiled directly to Python. 

Named after the ancient Afghan center of science, mathematics, and literature (*Umm al-Bilad*), Balkh lets you write real Python programs using native Dari keywords, Pashto keywords, and Persian/Pashto numerals (`۰-۹`).

## ✨ Features
- **Bilingual Syntax:** Write in Dari (`اگر`, `تابع`, `چاپ`), Pashto (`که`, `فنکشن`, `چاپول`), or mix both in the same file.
- **Native Numerals:** Automatically converts numeric literals such as `۱۲۳` to `123`, preserving text inside strings and comments.
- **Full Python Ecosystem:** Import and use any standard or third-party Python library (`random`, `math`, `json`, `requests`, etc.).
- **Friendly Error Messages:** Helpful, culturally flavored error hints when you miss a bracket.

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

## Running Tests

Install the test dependencies and run the suite:

```bash
python -m pip install -e ".[test]"
python -m pytest
```

## 🤝 Contributing
Want to add better Pashto or Dari aliases, translate standard library wrappers (`ریاضی.py`), or add funny error messages? Pull requests are warmly welcomed!
