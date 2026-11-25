# ◆ Balkh Language for VS Code

<p align="center">
  <img src="../../assets/balkh-wordmark.png" alt="Balkh wordmark (بلخ)" width="220">
</p>

Syntax highlighting and basic editing support for Balkh (`.blk`), including Dari, Pashto, and mixed Python programs. Open a `.blk` file and select **Balkh** as its language mode if it is not selected automatically.

## ✨ Features

- Highlight all current Dari/Pashto keyword and builtin aliases, together with English Python keywords and the corresponding builtins.
- Recognize ASCII (`0123`), Persian/Pashto (`۰۱۲۳`), and Arabic-Indic (`٠١٢٣`) numeric literals, including decimals, exponents, and digit separators.
- Color comments and ordinary, raw, bytes, Unicode, and triple-quoted strings. Highlight expressions within f-strings, including nested braces and format expressions.
- Distinguish complete Unicode identifiers from keywords embedded inside longer words.
- Color function/class definitions and provide `#` comment toggling, bracket/quote pairing, native word selection, block indentation, and indentation-based folding.
- Edit right-aligned source with the optional **Balkh RTL Editor**, including indentation from the right, syntax highlighting, find/replace, and an RTL/LTR toggle.
- Run saved `.blk` programs in a right-aligned **Balkh Output** panel with **Run Balkh File**, from the editor's Run menu, the RTL editor's toolbar, the Command Palette, or the file's Explorer context menu. Answer interactive input in native VS Code input boxes while keeping RTL output.

<div dir="rtl" align="right">

```balkh
از balkh.stdlib وارد ریاضی

تابع سلام(نام):
    که نام:
        چاپول("سلام", نام)
    وگرنه:
        چاپ("سلام بلخ")

سلام("افغانستان")
چاپ(ریاضی.جذر(۸۱))
```

</div>

> If the code looks out of order in the Extensions view, [view the right-to-left example on GitHub](https://github.com/najeeb-karimi/balkh/blob/main/editors/vscode/README.md#-features).

The standard editor uses a declarative TextMate grammar. The optional RTL editor bundles Monaco, TextMate, and Oniguruma locally; it does not download scripts at runtime. Use the `balkh` command in a terminal to run programs.

## 📦 Build and Install Locally

The extension requires desktop VS Code 1.100 or newer. VS Code can install a built VSIX directly. To build it from source, use Python 3.8 or newer, Node.js 22 or newer, and npm. The build expects `python` on your terminal's PATH.

From this repository's root:

```bash
cd editors/vscode
npm ci --ignore-scripts
npm test
npm run package
code --install-extension balkh-language-0.5.0.vsix
```

Alternatively, use **Extensions: Install from VSIX…** in VS Code and choose `editors/vscode/balkh-language-0.5.0.vsix` from the repository root. This file is created inside `editors/vscode/` by the `npm run package` command above; the filename includes the extension version (currently `0.5.0`).

The installable VSIX contains the grammar, language configuration, RTL editor and its bundled assets, manifest, documentation, and licenses; development dependencies and tests are excluded.

After installation, open one of the repository's `examples/*.blk` files. Colors follow your selected editor theme.

Install the extension in the VS Code profile you use for this project. **Extensions: Install from VSIX…** targets the current window's profile. When reinstalling a rebuilt VSIX with the same version from the terminal, add `--force` to the install command. Run **Developer: Reload Window** to load the updated extension in an open window. The integration-test command below uses an isolated profile and extensions directory.

## ▶️ Run a Balkh Program

Install Balkh into the Python environment that will run your programs. From the repository root:

```bash
python -m pip install -e .
balkh examples/salam.blk
```

Open a `.blk` file and choose **Run Balkh File** from the editor's Run menu or **Balkh: Run Balkh File** from the Command Palette. The RTL editor also has a **Run Balkh File** button. The command waits for pending RTL edits, saves the file, and runs the whole program through the regular Balkh CLI. By default, stdout and errors stream as UTF-8 into the **Balkh Output** tab in the bottom panel, alongside the exit status. This dedicated view right-aligns text like the playground, including prompts without a newline; VS Code's standard Output channel does not expose text-alignment controls. English and mixed text keep their natural paragraph direction. Use the **RTL/LTR** button to switch alignment without changing the transcript. The choice is remembered for this workspace.

The panel also offers **Copy**, **Clear**, and **Stop**. New output follows the bottom while you are already there; scrolling up lets you read earlier output without being pulled back down. To keep verbose runs responsive, the view retains the latest one million UTF-16 code units and shows a notice when older output is omitted. The ordinary **Output → Balkh** channel mirrors the unmodified stream for inspection. Program output is always rendered as literal text. Use **Balkh: Stop Running Program** from the Command Palette or the editor's Stop icon to stop a run as well. Running requires a trusted workspace; this command does not provide a debugger.

When Python calls `input()`, `ورودی`, `ننوت`, or reads text from `sys.stdin`, a native VS Code input box shows the program's current prompt. Type one answer and press Enter. Empty answers, Unicode, whitespace, repeated prompts, and calls inside functions and loops are supported. Answers are echoed in Output; the program continues from the same read without restarting. No changes to the `.blk` file or the installed Balkh package are required.

The input box has **End input (EOF)** and **Stop running program** buttons. EOF lasts for the rest of that run: `input()` raises `EOFError`, while `sys.stdin` readers can finish normally. Escape cancels the run. The Stop command also closes a pending input box, and a new run starts with fresh input. Output itself remains read-only; type your answer in the input box.

Leave `balkh.runInTerminal` disabled (the default) to use these prompts. If you enabled it as a workaround for input in an older extension, set it back to `false` and reload VS Code after installing version `0.4.0` or newer. For programs that require raw/binary stdin, terminal control, or interactive subprocesses, enable terminal mode instead:

```json
{
    "balkh.runInTerminal": true
}
```

Terminal mode uses an interactive VS Code task terminal and native Python stdin; its RTL rendering still depends on VS Code's terminal support. Use the terminal's trash button to stop a terminal run.

The runner first uses `balkh.pythonPath`, if configured, then searches the file's workspace folder for `.venv` or `venv` (`Scripts/python.exe` on Windows, `bin/python` elsewhere). It falls back to `python` on Windows or `python3` elsewhere. The working directory is the workspace folder, or the file's directory when no workspace folder is open. To choose a different interpreter, set its executable path without shell quotes or extra arguments:

```json
{
    "balkh.pythonPath": "C:/path/to/your/venv/Scripts/python.exe"
}
```

**Code Runner compatibility:** Code Runner's **Run Code** is a separate command. This repository maps its `balkh` language and `.blk` extension to `python -X utf8 -u -m balkh.cli` in `.vscode/settings.json`, which fixes its “Code language not supported or defined” message. It uses the `python` command on PATH, rather than `balkh.pythonPath`. Outside this repository, add the same mappings to your workspace or user settings:

```json
{
    "code-runner.executorMap": {
        "balkh": "python -X utf8 -u -m balkh.cli"
    },
    "code-runner.executorMapByFileExtension": {
        ".blk": "python -X utf8 -u -m balkh.cli"
    }
}
```

Merge these entries into existing objects if they are already configured. Code Runner follows its own save/selection settings and is designed for the standard text editor. Its Output panel remains read-only and does not use Balkh's input boxes; use **Run Balkh File** for interactive programs with RTL output. To accept input with Code Runner, set `"code-runner.runInTerminal": true` and use its integrated terminal. The Balkh action detects workspace environments and does not require Code Runner.

## ↔️ Right-to-Left Text

To edit a `.blk` file from the right:

1. Right-click its editor tab and choose **Reopen Editor With…**.
2. Select **Balkh RTL Editor**.
3. Use **Switch to LTR** for an English-heavy file, or **Open Standard Editor** to return to the usual editor.

The RTL editor uses the same grammar as standard highlighting, with right-aligned lines and indentation from the right. Direction changes affect the display only. Save with **Ctrl+S** (**Cmd+S** on macOS); undo and redo use VS Code's document history. Changes made elsewhere update the editor. If external changes overlap unacknowledged local edits, a prompt preserves your edits until you choose **Use My Edits** or **Use File Changes**.

Both editors use the shared Balkh indentation rules when `editor.autoIndent` is set to `full`, the VS Code default. Press **Enter** after a complete single-line block header ending in `:` to indent its body, including after `def`, `تابع`, and `فنکشن`. The RTL editor follows your VS Code setting for `editor.autoIndent`. To set it just for Balkh, add this to your settings:

```json
{
    "[balkh]": {
        "editor.autoIndent": "full"
    }
}
```

The extension leaves the standard editor as its default, while this repository's `.vscode/settings.json` selects **Balkh RTL Editor** for `.blk` files. Install the extension to use that workspace override. To use RTL automatically in another project, open **Preferences: Open Workspace Settings (JSON)** and merge the following into your settings. Use **Preferences: Open User Settings (JSON)** instead to apply it across projects in your current profile. If `workbench.editorAssociations` already exists, add the `*.blk` entry to that object.

```json
{
    "workbench.editorAssociations": {
        "*.blk": "balkh.rtlEditor"
    }
}
```

This is a separate Monaco editor in a webview. It supports basic editing, highlighting, find/replace, comment toggling, bracket pairing, and folding. VS Code features supplied by other extensions, such as language servers and debugger decorations, are not automatically available inside it. Line numbers and editor controls retain their usual layout. Colors follow the light/dark/high-contrast theme category and editor background; custom TextMate color rules are not imported.

VS Code's standard editor does not expose RTL line alignment through its supported extension API. An upstream proposal to add [`editor.textDirection`](https://github.com/microsoft/vscode/pull/334358) is still open. This limitation was checked against VS Code 1.146.0; the separate RTL editor uses Monaco's line-direction decorations instead.

## 🔧 Troubleshooting

| Symptom | What to check |
| --- | --- |
| No highlighting in a `.blk` file | In the standard editor, click the language mode in the status bar and choose **Balkh**. In Extensions, confirm **Balkh Language** (`balkh.balkh-language`) is installed and enabled in the current profile and workspace. |
| **Balkh RTL Editor** is missing | Install version `0.2.0` or newer in the current profile, run **Developer: Reload Window**, then try **Reopen Editor With…** again. |
| Source is still left-aligned | The standard editor remains left-aligned. Select **Balkh RTL Editor**; if it is already open, use **Switch to RTL**. |
| Enter leaves the next line unindented | Set `editor.autoIndent` to `full` for Balkh and press Enter after a complete single-line block header ending in `:`. For the RTL editor, use the current VSIX build. |
| The RTL editor cannot load | Reopen with **Text Editor** to continue editing. Rebuild with `npm run package` and reinstall the generated VSIX; packaging includes the required JavaScript, CSS, font, and tokenizer assets. |
| The VSIX file is missing | Run `npm run package` inside `editors/vscode/`. The generated `balkh-language-0.5.0.vsix` is not tracked in Git. |
| `code` is not recognized in the terminal | Use **Extensions: Install from VSIX…** from VS Code's Command Palette and select the generated VSIX instead. |
| `balkh` is not recognized in the terminal | Activate the Python environment where you installed Balkh, or run the interpreter installation command above. |
| **Run Code** says “Code language not supported or defined” | This message comes from Code Runner. Add the mappings above, or choose **Run Balkh File** instead. |
| Run cannot find Python or reports `No module named balkh` | Set `balkh.pythonPath` to the correct Python executable and install Balkh with that interpreter's `-m pip install -e .` from the repository root. Code Runner uses its separate executor settings. |
| Dari/Pashto output is jumbled in the terminal | Disable `balkh.runInTerminal` to use the right-aligned **Balkh Output** view. |
| Output is still left-aligned | Install version `0.5.0` or newer, reload VS Code, and use **Run Balkh File**. Read the dedicated **Balkh Output** tab and select **RTL**; the standard **Output** tab and Code Runner retain VS Code's alignment. |
| Run Balkh File exits with `EOFError` before showing an input box | Install version `0.4.0` or newer and run **Developer: Reload Window**. Keep `balkh.runInTerminal` disabled to use native input boxes with Output. |
| Code Runner says “Cannot edit in read-only editor” | Use **Run Balkh File** and its input box, or enable `code-runner.runInTerminal` and type in the terminal. |

## 🛠️ Development and Verification

The generator uses `balkh/keywords.py` for English and localized spellings. After changing the aliases or block rules, run these commands inside `editors/vscode/`:

```bash
npm run generate
npm test
npm run build
```

Commit both the generator and generated JSON files. `npm run check` detects stale generated files, and packaging runs the tokenizer tests automatically. The main Python test suite also checks that the generated files match the language definitions.

The tests use `vscode-textmate` and Oniguruma, including multi-line tokenizer state. They cover every current alias, Unicode boundaries, numeric literals, protected string/comment contents, continuations, f-string expressions, editing configuration, repository examples, document synchronization, conflict handling, and runner behavior. Real Python subprocess tests also cover interactive Unicode/empty input, partial stdin reads, EOF, diagnostics, cancellation, stopping a pending read, and unchanged terminal stdin. Python must be available; tests use the repository's `.venv` when present, then `python`/`python3`, or the executable set in `BALKH_PYTHON`.

Run `npm run test:browser` to check the bundled RTL editor in a headless Microsoft Edge installation. Set `BALKH_BROWSER=chrome` to use an installed Google Chrome instead, or `BALKH_BROWSER=chromium` after installing Playwright's Chromium browser with `npx playwright install chromium`. For example, in PowerShell:

```powershell
$env:BALKH_BROWSER = "chrome"
npm run test:browser
```

The browser tests verify editor right alignment, auto-indent after English, Dari, and Pashto block headers, highlighting, direction toggling, editing, save, undo/redo messages, running after typing, and external-change conflicts. They also check right-aligned output prompts, literal mixed-language text, output direction toggling, scrolling, Copy, Clear, and Stop. Run them separately from `npm test` and the packaging checks.

For a development preview, run `npm run build` first, then launch VS Code with `--extensionDevelopmentPath` pointing to this directory. Rebuild after changes to `src/`, the grammar, or the language configuration so the RTL editor receives those changes. Repackage and reinstall the VSIX to update an installed copy. **Developer: Inspect Editor Tokens and Scopes** works in the standard editor; the root scope is `source.balkh`.

The isolated integration test covers block auto-indent in the standard editor, native document save/undo/redo, execution in Output and terminal modes, Unicode and empty input, cancellation, and Stop. Build the extension and install Balkh in the runner's Python environment, then run this PowerShell command from the repository root:

```powershell
code --wait . --extensionDevelopmentPath="$PWD/editors/vscode" `
    --extensionTestsPath="$PWD/editors/vscode/tests/vscode-integration.cjs" `
    --user-data-dir="$PWD/.vscode-test/rtl-user" `
    --extensions-dir="$PWD/.vscode-test/rtl-extensions" `
    --disable-extensions --skip-welcome --disable-workspace-trust
```

The test creates its fixture and `result.json` under `.venv/rtl-integration/` and closes its test editors when finished. Browser and integration checks were verified on Windows with Edge and VS Code 1.146.0; other platforms have not been verified.

## 📖 References

- [VS Code syntax highlighting guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)
- [VS Code language configuration guide](https://code.visualstudio.com/api/language-extensions/language-configuration-guide)
- [VS Code extension packaging guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
