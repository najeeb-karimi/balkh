# 🏛️ Balkh (زبان برنامه‌نویسی بلخ)

To our knowledge, **Balkh** is the first bilingual **Dari & Pashto** programming language, transpiled directly to Python.

Named after the ancient Afghan center of science, mathematics, and literature (*Umm al-Bilad*), Balkh lets you write real Python programs using native Dari keywords, Pashto keywords, and Persian/Pashto numerals (`۰-۹`).

## ✨ Features
- **Bilingual Syntax:** Write in Dari (`اگر`, `تابع`, `چاپ`), Pashto (`که`, `فنکشن`, `چاپول`), or mix both in the same file.
- **Native Numerals:** Automatically converts numeric literals such as `۱۲۳` to `123`, preserving text inside strings and comments.
- **Python Ecosystem:** Use standard and third-party libraries from your local Python environment when running Balkh through the CLI.
- **Friendly Error Messages:** Dari and Pashto explanations and hints, native-digit line numbers, and original Balkh source locations.
- **Interactive Shell:** Run `balkh` without a filename to try expressions, keep variables, and write multi-line programs live.
- **Bidirectional Translation:** Export Balkh as Python, or translate Python into Dari or Pashto Balkh without executing it.
- **Localized Standard Library:** Optional math, random, and date/time helpers with Dari and Pashto names.
- **VS Code Support:** Syntax highlighting and block auto-indent for `.blk` files, with an optional right-aligned editor for Dari and Pashto.
- **Browser Playground:** Run Balkh in your browser with RTL editing and output, interactive input, and localized errors. No installation required.

## 🌐 Browser Playground

The playground runs Python locally in your browser using Pyodide. It includes the repository's examples and localized standard library, saves your source draft in this browser, and offers a Stop button for long-running programs. When code calls `input()`, answer interactively in **Results** and press Enter. Interactive input works in current Chrome, Edge, and Firefox releases with JavaScript Promise Integration.

You can rename the saved draft inline and expand the editor to fill the browser tab. In fullscreen, Results can dock below the editor, resize, or fill the workspace.

On a cold Chrome visit, Pyodide transfers about **6 MB** before the first run. See the [playground guide](playground/README.md#-browser-limits) for runtime size, caching, and browser support.

Once GitHub Pages is enabled and the playground workflow has deployed, open [the Balkh playground](https://najeeb-karimi.github.io/balkh/). See the [playground README](playground/README.md) for local preview, browser limitations, testing, and deployment setup.

## 🚀 Quick Start

Requires Python **3.8 or newer**.

1. **Clone & Install:**
   ```bash
   git clone https://github.com/najeeb-karimi/balkh.git
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

   <div dir="rtl" align="right">

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

   </div>

   End an indented block with an empty line. Variables, functions, and imports stay available throughout the session. Press Ctrl+C to cancel pending input. Exit with `exit()`, `quit()`, or EOF (Ctrl+Z then Enter on Windows; Ctrl+D on Linux/macOS).

## 🔄 Translating Files

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

`--lang` defaults to `dari` and selects the language for reverse translation and error messages. It also works when running files or starting the REPL. The translation modes (`--py`, `--to-py`, and `--to-blk`) are mutually exclusive. Use `--py` to see the generated Python in your terminal or `--to-py` to save it.

Both Python modes translate Balkh keywords, built-ins, numeric literals, and recognizable `balkh.stdlib` calls to standard Python. User-defined names, explicit import aliases, and string literals keep their spelling. Dynamic references to the bundled wrappers can still require the original imports.

Lines that mix left-to-right English with right-to-left Dari or Pashto can look jumbled in terminals and editors, especially around punctuation and operators. Python reads the generated code in its stored order regardless of how it appears on screen.

Translation to Balkh preserves strings, comments, numeric spellings, and formatting. Python keywords without a localized alias remain in English. Pashto output uses shared aliases where a separate Pashto spelling is unavailable.

Saved files use UTF-8, with any encoding header updated to match. An explicitly named output file is replaced after translation succeeds. Input and output must be different files. Translation validates the source without running it.

## 📚 Localized Standard Library

Import optional helpers from `balkh.stdlib`:

<div dir="rtl" align="right">

```balkh
از balkh.stdlib وارد ریاضی, تصادفی, زمان
چاپ(ریاضی.جذر(۸۱))
چاپ(تصادفی.انتخاب(["بلخ", "کابل"]))
چاپ(زمان.قالب(زمان.تاریخ(۲۰۲۴, ۲, ۲۸) + زمان.مدت(روز=۱)))
```

</div>

Pashto module names and functions are available too:

<div dir="rtl" align="right">

```balkh
له balkh.stdlib راوړل ریاضي, تصادفي, وخت
چاپول(ریاضي.مربع_ریښه(۸۱))
چاپول(تصادفي.ټاکنه(["بلخ", "کابل"]))
چاپول(وخت.بڼه(وخت.نېټه(۲۰۲۴, ۲, ۲۸) + وخت.موده(ورځې=۱)))
```

</div>

Run `balkh examples/stdlib.blk` to try the helpers, which also work in the REPL. Dates use Python's Gregorian calendar. See the [standard library reference](docs/Stdlib.md) for the full alias tables and how Python export handles these wrappers.

## 🩺 Errors and Tracebacks

Choose Dari or Pashto diagnostics for files or the interactive shell:

```bash
balkh app.blk --lang pashto
balkh --lang pashto
```

Common runtime errors include localized explanations and fix hints, with native-digit line numbers and the original source. The REPL remembers earlier function definitions when reporting errors. Python exception names and detailed messages remain available for debugging.

Errors go to standard error, and uncaught file execution errors exit with status `1`. See the [error handling reference](docs/Errors.md) for examples, exception chains, and exit behavior.

## 🎨 VS Code Support

Build and install the local Balkh Language extension:

```bash
cd editors/vscode
npm ci --ignore-scripts
npm run package
code --install-extension balkh-language-0.5.0.vsix
```

Open a `.blk` file and choose **Balkh** as its language mode. For right-aligned editing, right-click the editor tab, choose **Reopen Editor With…**, and select **Balkh RTL Editor**. Both editors provide syntax highlighting, comment toggling, and bracket and quote pairing. With `editor.autoIndent` set to `full`, pressing Enter after a single-line block header indents its body in English, Dari, or Pashto.

Use **Run Balkh File** to save and run the program in the right-aligned **Balkh Output** panel. Answer prompts in native VS Code input boxes. Enter submits, Escape stops, and **End input (EOF)** ends input. Set `balkh.runInTerminal` to `true` for programs that need terminal features. The runner detects workspace `.venv` and `venv` environments, and `balkh.pythonPath` lets you choose another interpreter. See the [extension README](editors/vscode/README.md) for prerequisites, Code Runner compatibility, and development instructions.

## 🧪 Running Tests

Install the test dependencies and run the suite:

```bash
python -m pip install -e ".[test]"
python -m pytest
```

## 🤝 Contributing
Want to add better Pashto or Dari aliases, translate standard library wrappers (`ریاضی.py`), or add funny error messages? Pull requests are warmly welcomed!

## ⚖️ License

Balkh is licensed under the [MIT License](LICENSE), including the interpreter, examples, documentation, and VS Code extension. Bundled third-party components retain their respective licenses.
