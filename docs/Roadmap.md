# 🏛️ Balkh Development Roadmap

1. **Fix CLI Argument Indexing & Add Automated Tests (`pytest`) — Complete**
   * Parse file paths and flags (`--py`, `--help`) with `argparse`, supporting flags before or after the filename and reporting invalid arguments.
   * Add a `tests/` suite using `pytest` for Dari keywords, Pashto keywords, mixed code, native digits, string literal preservation, and CLI behavior.
   * Preserve native digits in identifiers, strings, and comments while converting numeric literals in code.

2. **Add an Interactive REPL Shell (`balkh` with no arguments) — Complete**
   * Launch an interactive terminal prompt (`بلخ >>> `) that transpiles and evaluates single lines and multi-line indented blocks, using `بلخ ... ` for continued input.
   * Keep variables, functions, and imports between commands. Display expression results and recover from errors or interrupted input.
   * Finish indented blocks with an empty line, cancel input with Ctrl+C, and exit with `exit()`, `quit()`, or EOF.

3. **Build Bidirectional Translation (`--to-blk` and `--to-py`) — Complete**
   * Use the same validated Python conversion for `--py` and `--to-py`. Translate recognizable localized library calls to standard Python, keeping user-defined names, aliases, and strings.
   * Translate Python into Balkh with `balkh app.py --to-blk`, optionally saving it with `--to-blk app.blk`. Default to Dari and use `--lang pashto` for Pashto.
   * Share token-based translation between the CLI and REPL, preserving formatting, strings, and comments. Use explicit preferred aliases for each language while retaining all existing forward aliases.
   * Validate exports without executing programs, reject conflicting flags and input/output collisions, and test both languages and round trips.

4. **Create Localized Standard Library Wrappers — Complete**
   * Add optional modules inside `balkh/stdlib/`: `ریاضی` for `math`, `تصادفی` for `random`, and `زمان` for `datetime`, with Dari and Pashto operation names.
   * Provide Pashto module paths (`ریاضي`, `تصادفي`, `وخت`), localized duration units, and date/time formatting and parsing helpers.
   * Use regular package imports in Balkh programs and the REPL. Python export replaces recognizable calls with standard-library equivalents and retains wrappers when needed. Document the APIs in `docs/Stdlib.md` and add `examples/stdlib.blk` with tests for both languages.

5. **Upgrade Error Handling & Tracebacks — Complete**
   * Add Dari and Pashto explanations and hints for `NameError`, `TypeError`, `ZeroDivisionError`, and `IndexError`, plus syntax/indentation/token errors and a fallback for other exceptions.
   * Report native-digit line numbers and original source frames, retain Python details and exception chains, and track earlier REPL definitions correctly.
   * Use `--lang dari|pashto` for diagnostics in files, the REPL, and export validation. Send diagnostics to standard error and return a failing status for uncaught file errors.
   * Document behavior in `docs/Errors.md` and test both languages, nested calls, REPL recovery, custom messages, and exit statuses.

6. **Build a VS Code Syntax Highlighting Extension — Complete**
   * Add a declarative extension under `editors/vscode/`, associating `.blk` files with the `source.balkh` TextMate grammar.
   * Highlight all current Dari/Pashto aliases, mixed English keywords, native numeric literals, comments, strings, f-string expressions, and function/class definitions, with Unicode-aware word boundaries.
   * Provide comment toggling, bracket/quote pairing, word selection, folding, and block auto-indent after single-line headers. Generate rules using `balkh/keywords.py` and share them between both VS Code editors and the Playground.
   * Add real TextMate/Oniguruma tokenizer tests, local VSIX packaging and installation instructions, and keep editor tooling out of the Python distribution.
   * Offer an optional Monaco-based RTL editor with right-aligned lines and indentation, the same highlighting grammar, an RTL/LTR toggle, VS Code document save/undo/redo, and external-change conflict handling. Follow VS Code's `editor.autoIndent` setting.
   * Run `.blk` files from the editor or Explorer in a right-aligned Balkh Output panel with UTF-8 streaming, an RTL/LTR toggle, native interactive input boxes, EOF and Stop controls; offer a terminal option for terminal-specific programs, save pending edits before execution, detect workspace Python environments, and configure Code Runner compatibility.

7. **Create a Browser-Based Playground — Complete**
   * Use **Pyodide** (Python running in WebAssembly) to build a single-page web editor on GitHub Pages so anyone can write and run `.blk` code directly in their browser with zero installation.
   * Add a Monaco editor with the extension's syntax grammar, RTL/LTR editing and right-aligned indentation, RTL output, Dari/Pashto diagnostics, examples, source downloads, and a locally saved draft.
   * Support block auto-indent in both the main and basic editors, persistent draft filenames, and tab-filling fullscreen with docked, resizable, and maximizable Results.
   * Run the repository's interpreter and localized standard library in a module Web Worker, accept interactive input in Results while programs run, start each run with fresh variables and input, bound output, and stop infinite loops or pending input by restarting the worker.
   * Build a static Pages artifact, test the Python bridge and real browser runtime, and add a GitHub Actions workflow for checks and deployment. Document local preview, browser limitations, and the repository's one-time Pages setup.

8. **Publish to PyPI (`pip install balkh`)**
   * Add GitHub Actions workflows to automatically run tests and publish new releases to PyPI whenever you tag a version (`v0.2.0`, `v1.0.0`).
