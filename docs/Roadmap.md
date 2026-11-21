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

5. **Upgrade Error Handling & Tracebacks — Complete**
   * Add Dari and Pashto explanations and hints for `NameError`, `TypeError`, `ZeroDivisionError`, and `IndexError`, plus syntax/indentation/token errors and a fallback for other exceptions.
   * Report native-digit line numbers and original source frames, retain Python details and exception chains, and track earlier REPL definitions correctly.
   * Use `--lang dari|pashto` for diagnostics in files, the REPL, and export validation. Send diagnostics to standard error and return a failing status for uncaught file errors.
   * Document behavior in `docs/Errors.md` and test both languages, nested calls, REPL recovery, custom messages, and exit statuses.

6. **Build a VS Code Syntax Highlighting Extension — Complete**
   * Add a declarative extension under `editors/vscode/`, associating `.blk` files with the `source.balkh` TextMate grammar.
   * Highlight all current Dari/Pashto aliases, mixed English keywords, native numeric literals, comments, strings, f-string expressions, and function/class definitions, with Unicode-aware word boundaries.
   * Provide comment toggling, bracket/quote pairing, word selection, folding, and block indentation. Generate keyword and indentation rules from `balkh/keywords.py`.
   * Add real TextMate/Oniguruma tokenizer tests, local VSIX packaging and installation instructions, and keep editor tooling out of the Python distribution.
   * Offer an optional Monaco-based RTL editor with right-aligned lines and indentation, the same highlighting grammar, an RTL/LTR toggle, VS Code document save/undo/redo, and external-change conflict handling.
   * Run `.blk` files from the editor or Explorer in an Output channel with UTF-8 streaming and a Stop command, offer an interactive terminal option, save pending edits before execution, detect workspace Python environments, and configure Code Runner compatibility.

7. **Create a Browser-Based Playground — Complete**
   * Use **Pyodide** (Python running in WebAssembly) to build a single-page web editor on GitHub Pages so anyone can write and run `.blk` code directly in their browser with zero installation.
   * Add a Monaco editor with the extension's syntax grammar, RTL/LTR editing and right-aligned indentation, RTL output, Dari/Pashto diagnostics, Python preview, examples, source downloads, and a locally saved draft.
   * Run the repository's interpreter and localized standard library in a module Web Worker, accept multiline input before execution, start each run with fresh variables, bound output, and stop infinite loops by restarting the worker.
   * Build a static Pages artifact, test the Python bridge and real browser runtime, and add a GitHub Actions workflow for checks and deployment. Document local preview, browser limitations, and the repository's one-time Pages setup.

8. **Publish to PyPI (`pip install balkh`)**
   * Add GitHub Actions workflows to automatically run tests and publish new releases to PyPI whenever you tag a version (`v0.2.0`, `v1.0.0`).
