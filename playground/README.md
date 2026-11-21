# 🌐 Balkh Playground

A static, browser-based Balkh editor for GitHub Pages. Python runs in a [module Web Worker](https://pyodide.org/en/stable/usage/webworker.html) through [Pyodide](https://pyodide.org/), using the same `balkh/` package as the command-line interpreter.

## ✨ Features

- English, Dari, and Pashto interface languages, with a header language button, RTL controls, and a remembered preference. English is the default.
- Self-hosted Vazirmatn for Dari/Pashto interface text, including the trilingual headline and language menu.
- Monaco editor with Dari, Pashto, and mixed Python syntax highlighting, native numerals, right-aligned indentation, and an RTL/LTR toggle.
- Run and Stop controls, keyboard execution, RTL output, and Dari or Pashto diagnostics with original source locations.
- Python preview without executing the program, `.blk` downloads, repository examples, and a locally saved source draft.
- Optional multiline input supplied before running, including programs that call `input()` repeatedly.
- Localized math, random, and date/time wrappers from `balkh.stdlib`.

## 🚀 Local Preview

Build tooling requires Node.js **22 or newer** and npm. Visitors only need a modern browser with JavaScript, WebAssembly, and Web Workers enabled. No local Python installation is required to build or use the playground.

From the repository root:

```bash
cd playground
npm ci --ignore-scripts
npm run dev
```

Open **http://127.0.0.1:4173/balkh/**. The development server rebuilds and refreshes the browser when playground code, styles, HTML, interpreter sources, examples, or shared highlighting assets change. Reloading preserves your source draft and restarts Python. If a build fails, the last successful version stays available; fixing the source triggers another build. Use Ctrl+C to stop the server, or `PORT` to choose another port. Restart it after changing build/server scripts or dependencies.

To preview the production artifact instead:

```bash
npm run build
npm start
```

This serves `playground/dist/` without watching or injecting development code. Serve the site over HTTP; opening `index.html` as a `file://` URL cannot load its workers and assets.

The build copies the current interpreter sources, examples, and licenses into ignored `playground/dist/`, and bundles the editor and tokenizer. It reuses the VS Code extension's generated grammar and token classification. Changes to keyword mappings should also regenerate that grammar with `python editors/vscode/scripts/generate-grammar.py`.

## 🧭 Using the Playground

Use the language button in the header to choose **English**, **دری**, or **پښتو**. It updates the interface immediately and remembers the choice in this browser. The headline always welcomes visitors in all three languages; its supporting sentence follows the interface language. Interface language, source direction, and the error-message language are independent; switching the interface preserves code, output, input, and running programs.

Choose an example or write code, then select **Run**. **Ctrl+Enter** (or **Cmd+Enter** on macOS) also runs the program. The diagnostics selector changes error explanations; both Dari and Pashto keywords work regardless of that setting. Python preview translates and validates the current source without executing it.

For `input()`, expand **Program input** and enter one response per line before running. Reading beyond the supplied input raises `EOFError`; this is not a live terminal. For the guessing-game example, supplying `1` through `10` on separate lines guarantees the random target is eventually reached.

Each execution starts with fresh program variables and a fresh input stream. The worker's imported modules and virtual filesystem remain until the runtime is restarted. **Stop** terminates the Python worker and creates a new runtime, so it works even for an infinite loop without cross-origin isolation or special GitHub Pages headers. Restarting discards runtime files and module state while preserving the editor draft.

Your source draft is stored in this browser's local storage when available. Download important programs as `.blk` files; browser storage may be cleared. Program input and runtime files are not saved with the source draft.

## 📦 Browser Limits

The first load downloads the pinned **Pyodide 314.0.8** runtime from jsDelivr and can take a moment on slower connections. Later loads can reuse the browser's HTTP cache. An internet connection is required for the runtime; offline use is not guaranteed. Load failures display a retry control.

Python's browser runtime differs from a desktop installation: subprocesses, ordinary OS sockets, and native desktop libraries are unavailable. This playground includes Balkh and Pyodide's standard library; it does not automatically install arbitrary third-party Python packages. The browser's virtual filesystem is temporary, and very large programs can still exhaust browser memory. Displayed output is capped to keep verbose programs responsive.

Normal execution happens on the visitor's device, without a Balkh execution server. Pyodide can access browser networking, so programs can make their own requests. The playground is a coding tool rather than a security boundary for untrusted Python.

## 🧪 Tests

From `playground/`, after building:

```bash
npx playwright install chromium
npm test
```

On Windows, tests use installed Microsoft Edge by default. Set `BALKH_BROWSER=chromium` to use Playwright's Chromium instead, or set another installed Playwright channel. On Linux, tests use Playwright Chromium. Tests serve the site under `/balkh/` to check project-site paths and run real Pyodide with network access, including Unicode output, localized diagnostics, input, translation, Stop and recovery, and responsive layout.

The Python bridge is also covered by the repository's regular suite:

```bash
python -m pip install -e ".[test]"
python -m pytest
```

Run those commands from the repository root. Python is needed for these tests, while site building itself uses Node.js.

## 🚢 GitHub Pages Deployment

The repository includes [the Playground workflow](../.github/workflows/playground.yml). To publish:

1. In this GitHub repository, open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.
2. Commit and push these changes to `main`. The workflow tests the interpreter, builds the playground, runs real browser tests, and deploys the generated `playground/dist/` artifact.
3. Open the URL reported by the successful deployment. For this repository it is **https://najeeb-karimi.github.io/balkh/**.

Later pushes affecting the interpreter, examples, playground, shared highlighting assets, or relevant tests rebuild and redeploy the site. Pull requests run checks without deploying. You can also run **Actions → Playground → Run workflow** on `main`. No separate repository, custom server, deployment token, or PyPI release is needed.

## ⚖️ License

The playground is covered by the repository's [MIT License](../LICENSE). Builds include `THIRD-PARTY-LICENSES.txt` for bundled editor, tokenizer, and font components. The bundled [Vazirmatn fonts](assets/fonts/vazirmatn/README.md) retain their SIL Open Font License 1.1. Pyodide is loaded separately from its CDN and retains its own licenses.
