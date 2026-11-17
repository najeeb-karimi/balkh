# 🏛️ Balkh Development Roadmap

1. **Fix CLI Argument Indexing & Add Automated Tests (`pytest`) — Complete**
   * Parse file paths and flags (`--py`, `--help`) with `argparse`, supporting flags before or after the filename and reporting invalid arguments.
   * Add a `tests/` suite using `pytest` for Dari keywords, Pashto keywords, mixed code, native digits, string literal preservation, and CLI behavior.
   * Preserve native digits inside strings and comments while converting numeric literals in code.

2. **Add an Interactive REPL Shell (`balkh` with no arguments) — Complete**
   * Launch an interactive terminal prompt (`بلخ >>> `) that transpiles and evaluates single lines and multi-line indented blocks, using `بلخ ... ` for continued input.
   * Keep variables, functions, and imports between commands. Display expression results and recover from errors or interrupted input.
   * Finish indented blocks with an empty line, cancel input with Ctrl+C, and exit with `exit()`, `quit()`, or EOF.

3. **Build Bidirectional Translation (`--to-blk` and `--to-py`) — Complete**
   * Save transpiled output directly to a `.py` file (`balkh app.blk --to-py app.py`), retaining `--py` for inspection.
   * Translate Python into Dari or Pashto (`balkh app.py --to-blk --lang dari|pashto`), optionally saving it with `--to-blk app.blk`. Default to Dari.
   * Share token-based translation between the CLI and REPL, preserving formatting, strings, and comments. Use explicit preferred aliases for each language while retaining all existing forward aliases.
   * Validate exports without executing programs, reject conflicting flags and input/output collisions, and test both languages and round trips.

4. **Create Localized Standard Library Wrappers — Complete**
   * Add optional modules inside `balkh/stdlib/`: `ریاضی` for `math`, `تصادفی` for `random`, and `زمان` for `datetime`, with Dari and Pashto operation names.
   * Provide Pashto module paths (`ریاضي`, `تصادفي`, `وخت`), localized duration units, and date/time formatting and parsing helpers.
   * Use regular package imports in programs, the REPL, and exported Python. Document the APIs in `docs/Stdlib.md` and add `examples/stdlib.blk` with tests for both languages.

5. **Upgrade Error Handling & Tracebacks**
   * Intercept Python runtime exceptions (`NameError`, `TypeError`, `ZeroDivisionError`, `IndexError`) and translate both the error explanation and line numbers into friendly, helpful Dari and Pashto messages.

6. **Build a VS Code Syntax Highlighting Extension**
   * Create a lightweight TextMate grammar extension (`.tmLanguage.json`) that highlights Dari/Pashto keywords, strings, numbers, and comments in `.blk` files inside VS Code.

7. **Create a Browser-Based Playground**
   * Use **Pyodide** (Python running in WebAssembly) to build a single-page web editor on GitHub Pages so anyone can write and run `.blk` code directly in their browser with zero installation.

8. **Publish to PyPI (`pip install balkh`)**
   * Add GitHub Actions workflows to automatically run tests and publish new releases to PyPI whenever you tag a version (`v0.2.0`, `v1.0.0`).
