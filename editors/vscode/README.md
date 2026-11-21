# 🎨 Balkh Language for VS Code

Syntax highlighting and basic editing support for Balkh (`.blk`), including Dari, Pashto, and mixed Python programs. Open a `.blk` file and select **Balkh** as its language mode if it is not selected automatically.

## ✨ Features

- Highlight all current Dari/Pashto keyword and builtin aliases, together with English Python keywords and the corresponding builtins.
- Recognize ASCII (`0123`), Persian/Pashto (`۰۱۲۳`), and Arabic-Indic (`٠١٢٣`) numeric literals, including decimals, exponents, and digit separators.
- Color comments and ordinary, raw, bytes, Unicode, and triple-quoted strings. Highlight expressions within f-strings, including nested braces and format expressions.
- Distinguish complete Unicode identifiers from keywords embedded inside longer words.
- Color function/class definitions and provide `#` comment toggling, bracket/quote pairing, native word selection, block indentation, and indentation-based folding.
- Edit right-aligned source with the optional **Balkh RTL Editor**, including indentation from the right, syntax highlighting, find/replace, and an RTL/LTR toggle.

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

The standard editor uses a declarative TextMate grammar. The optional RTL editor bundles Monaco, TextMate, and Oniguruma locally; it does not download scripts at runtime. Use the `balkh` command in a terminal to run programs.

## 📦 Build and Install Locally

The extension requires desktop VS Code 1.100 or newer. Installing an already-built VSIX does not require Python or Node.js; building it from source requires Python 3.8+, Node.js 20+, and npm. The commands below expect `python` on your terminal's PATH; activate your Python virtual environment first if needed.

From this repository's root:

```bash
cd editors/vscode
npm ci --ignore-scripts
npm test
npm run package
code --install-extension balkh-language-0.2.0.vsix
```

Alternatively, use **Extensions: Install from VSIX…** in VS Code and choose `editors/vscode/balkh-language-0.2.0.vsix` from the repository root. This file is created inside `editors/vscode/` by the `npm run package` command above; the filename includes the extension version (currently `0.2.0`).

The installable VSIX contains the grammar, language configuration, RTL editor and its bundled assets, manifest, documentation, and licenses; development dependencies and tests are excluded.

After installation, open one of the repository's `examples/*.blk` files. Colors follow your selected editor theme.

Install the extension in the VS Code profile you use for this project; using **Extensions: Install from VSIX…** in that window targets its current profile. The isolated integration-test command below uses a separate extensions directory and does not install the extension in your usual profile. After upgrading, run **Developer: Reload Window** if the new editor option or changes have not appeared.

## ▶️ Run a Balkh Program

The extension provides editing support. Install the Balkh interpreter separately and run programs in a terminal. From the repository root:

```bash
python -m pip install -e .
balkh examples/salam.blk
```

The RTL editor does not add a Run button or a debugger. The same `.blk` file can be run regardless of which editor or display direction you choose.

## ↔️ Right-to-Left Text

To edit a `.blk` file from the right:

1. Right-click its editor tab and choose **Reopen Editor With…**.
2. Select **Balkh RTL Editor**.
3. Use **Switch to LTR** for an English-heavy file, or **Open Standard Editor** to return to the usual editor.

The RTL editor uses the same grammar as standard highlighting, with right-aligned lines and indentation from the right. Direction changes affect the display only. Save with **Ctrl+S** (**Cmd+S** on macOS); undo and redo use VS Code's document history. Changes made elsewhere update the editor. If external changes overlap unacknowledged local edits, a prompt preserves your edits until you choose **Use My Edits** or **Use File Changes**.

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
| The RTL editor cannot load | Reopen with **Text Editor** to continue editing. Rebuild with `npm run package` and reinstall the generated VSIX; packaging includes the required JavaScript, CSS, font, and tokenizer assets. |
| The VSIX file is missing | Run `npm run package` inside `editors/vscode/`. The generated `balkh-language-0.2.0.vsix` is not tracked in Git. |
| `code` is not recognized in the terminal | Use **Extensions: Install from VSIX…** from VS Code's Command Palette and select the generated VSIX instead. |
| `balkh` is not recognized in the terminal | Activate the Python environment where you installed Balkh, or run the interpreter installation command above. |

## 🛠️ Development and Verification

Run the following commands inside `editors/vscode/`. The grammar and indentation patterns are generated from `balkh/keywords.py`. After changing the language aliases:

```bash
npm run generate
npm test
npm run build
```

Commit both the generator and generated JSON files. `npm run check` detects stale generated files, and packaging runs the tokenizer tests automatically. The main Python test suite also checks that the generated files match the language definitions.

The tests use `vscode-textmate` and Oniguruma, including multi-line tokenizer state. They cover every current alias, Unicode boundaries, numeric literals, protected string/comment contents, continuations, f-string expressions, editing configuration, repository examples, document synchronization, and conflict handling.

Run `npm run test:browser` to check the bundled RTL editor in a headless Microsoft Edge installation. Set `BALKH_BROWSER=chrome` to use an installed Google Chrome instead, or `BALKH_BROWSER=chromium` after installing Playwright's Chromium browser with `npx playwright install chromium`. For example, in PowerShell:

```powershell
$env:BALKH_BROWSER = "chrome"
npm run test:browser
```

The browser test verifies right alignment, nested indentation, highlighting, direction toggling, editing, save, undo/redo messages, and external-change conflicts. It is separate from `npm test` and the packaging checks.

For a development preview, run `npm run build` first, then launch VS Code with `--extensionDevelopmentPath` pointing to this directory. Rebuild after changes to `src/`, the grammar, or the language configuration so the RTL editor receives those changes. Repackage and reinstall the VSIX to update an installed copy. **Developer: Inspect Editor Tokens and Scopes** works in the standard editor; the root scope is `source.balkh`.

To verify native document save/undo/redo, run the integration test in an isolated profile. After building, use this PowerShell command from the repository root:

```powershell
code --extensionDevelopmentPath="$PWD/editors/vscode" `
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
