# 🌐 Balkh Playground

A static, browser-based Balkh editor for GitHub Pages. Python runs in a [module Web Worker](https://pyodide.org/en/stable/usage/webworker.html) through [Pyodide](https://pyodide.org/), using the same `balkh/` package as the command-line interpreter.

## ✨ Features

- English, Dari, and Pashto interface languages, with a header language button, RTL controls, and a remembered preference. English is the default.
- Self-hosted Vazirmatn for Dari/Pashto interface text, including the trilingual headline and language menu.
- Monaco editor with Dari, Pashto, and mixed Python syntax highlighting, native numerals, right-aligned indentation, and an RTL/LTR toggle. RTL puts line numbers on the right and the scrollbar on the left; LTR reverses them.
- Block auto-indent in both the Monaco editor and the basic editor.
- Run and Stop controls, keyboard execution, RTL output, and Dari or Pashto diagnostics with original source locations.
- `.blk` downloads, repository examples, and a locally saved source draft.
- Interactive input in Results, with support for repeated prompts, empty answers, Unicode text, and end-of-input.
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

The build copies the current interpreter sources, examples, and licenses into ignored `playground/dist/`, and bundles the editor and tokenizer. It reuses the VS Code extension's generated grammar, language configuration, and token classification. After changing keyword mappings or block rules, run `python editors/vscode/scripts/generate-grammar.py` from the repository root.

## 🧭 Using the Playground

Use the language button in the header to choose **English**, **دری**, or **پښتو**. It updates the interface immediately and remembers the choice in this browser. The headline always welcomes visitors in all three languages; its supporting sentence follows the interface language. Interface language, source direction, and the error-message language are independent; switching the interface preserves code, output, input, and running programs.

Press **Enter** after a complete single-line block header ending in `:` to indent the next line. Both editors use the same rules for functions (including `def`, `تابع`, and `فنکشن`), classes, conditionals, loops, exception handling, context managers, and Python's `match` and `case` blocks.

Choose an example or write code, then select **Run** in the source toolbar alongside **Stop**, **RTL/LTR**, and **Download**. **Ctrl+Enter** (or **Cmd+Enter** on macOS) also runs the program. Use **Ctrl+Shift+Enter** (or **Cmd+Shift+Enter** on macOS) to stop it. Results shows program output and interactive prompts. The diagnostics selector changes error explanations, and both Dari and Pashto keywords work regardless of that setting.

Double-click the filename to rename your draft. You can also tap it on a touchscreen or focus it and press **Enter**. Edit the name beside the fixed `.blk` suffix, then press **Enter** to save or **Esc** to cancel. The name stays with the draft and its downloads. It can be up to 32 characters long, including the extension.

Use **Fullscreen** in the source toolbar to expand the editor to fill the browser tab. The browser tabs and address bar stay visible. **Ctrl+J**, **Ctrl+\`**, or the **Results** button below the editor opens or collapses the bottom panel. Drag the divider above Results to resize it, or focus the divider and press **↑** or **↓**. Running code opens Results, and a waiting input prompt brings it back. If your browser reserves **Ctrl+J** for downloads, use **Ctrl+\`** or the button. Choose **Exit fullscreen** or press **Esc** to return to the regular layout.

Select **Maximize** in the Results header to give the panel the whole workspace. Select **Restore** or press **Esc** to return to the previous split.

When a program calls `input()`, `ورودی`, or `ننوت`, its prompt appears in **Results** with an answer field. Type one answer and press Enter or **Send**. Execution resumes from that point and the answer remains in the transcript. Empty answers are supported. The guessing game asks for one guess at a time and responds before asking again.

**End input** sends EOF: `input()` raises `EOFError`, while `sys.stdin` readers can finish normally. EOF lasts for the rest of that run. **Stop** also works while a program is waiting for an answer. A new run starts with fresh input, and UI-language changes preserve an answer being typed. Answers are not written to browser storage. The CLI keeps native Python stdin; the [VS Code extension](../editors/vscode/README.md) offers a right-aligned Balkh Output panel with native input boxes, plus optional terminal mode.

Each execution starts with fresh program variables and a fresh input stream. The worker's imported modules and virtual filesystem remain until the runtime is restarted. **Stop** terminates the Python worker and creates a new runtime, so it works even for an infinite loop without cross-origin isolation or special GitHub Pages headers. The loading message reappears while the new worker initializes. Restarting clears the worker's virtual filesystem and module state while preserving the editor draft.

Your source draft is stored in this browser's local storage when available. Download important programs as `.blk` files; browser storage may be cleared. Program input and runtime files are not saved with the source draft.

## 📦 Browser Limits

The page starts loading the pinned **Pyodide 314.0.8** runtime from jsDelivr before you select **Run**. In a cold Chrome test, Pyodide and its Python standard library transferred **6.24 MB** and totaled **13.53 MB** after HTTP decompression. The editor and fonts load separately.

Later visits and worker restarts can reuse the browser's HTTP cache. After pressing **Stop** in the same test, Chrome reused all five Pyodide files from cache. Offline availability depends on which files the browser has cached. An internet connection is required whenever the runtime needs to be fetched. Load failures display a retry control.

Interactive input uses [JavaScript Promise Integration in Pyodide](https://blog.pyodide.org/posts/jspi/) to suspend synchronous Python while it waits for an answer. The worker checks for `WebAssembly.Suspending` and `WebAssembly.promising`. Current Chrome, Edge, and Firefox support these APIs. Browsers without them can still run programs that do not request interactive input. [Firefox JSPI release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/153)

Python's browser runtime differs from a desktop installation: subprocesses, ordinary OS sockets, and native desktop libraries are unavailable. This playground includes Balkh and Pyodide's standard library; it does not automatically install arbitrary third-party Python packages. The browser's virtual filesystem is temporary, and very large programs can still exhaust browser memory. Displayed output is capped to keep verbose programs responsive.

Normal execution happens on the visitor's device, without a Balkh execution server. Pyodide can access browser networking, so programs can make their own requests. The playground is a coding tool rather than a security boundary for untrusted Python.

## 🧪 Tests

From `playground/`, after building:

```bash
npx playwright install chromium
npm test
```

On Windows, tests use installed Microsoft Edge by default. Set `BALKH_BROWSER=chromium` to use Playwright's Chromium instead, or set another installed Playwright channel. On Linux, tests use Playwright Chromium. Tests serve the site under `/balkh/` and run real Pyodide with network access. Coverage includes Unicode output, localized diagnostics, interactive input, Stop and recovery, fullscreen Results, filename editing, and block auto-indent in both editors.

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
