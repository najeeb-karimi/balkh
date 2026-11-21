import * as monaco from 'monaco-editor/editor/editor.api.js';
import 'monaco-editor/editor/contrib/find/browser/findController.js';
import 'monaco-editor/editor/contrib/comment/browser/comment.js';
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/editor/contrib/linesOperations/browser/linesOperations.js';
import 'monaco-editor/editor/contrib/wordOperations/browser/wordOperations.js';
import 'monaco-editor/editor/contrib/multicursor/browser/multicursor.js';
import 'monaco-editor/editor/contrib/indentation/browser/indentation.js';
import './node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css';
import { Registry, INITIAL } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import grammarDefinition from '../editors/vscode/syntaxes/balkh.tmLanguage.json';
import configuration from '../editors/vscode/language-configuration.json';
import { tokenClass } from '../editors/vscode/src/tokens.cjs';

self.MonacoEnvironment = { getWorker: () => new Worker(new URL('./editor.worker.js', document.baseURI)) };

class TokenState {
  constructor(stack = INITIAL) { this.stack = stack; }
  clone() { return new TokenState(this.stack); }
  equals(other) { return other instanceof TokenState && this.stack.equals(other.stack); }
}

async function setupLanguage() {
  const response = await fetch('./onig.wasm');
  if (!response.ok) throw new Error('Syntax highlighting could not be loaded.');
  await loadWASM(await response.arrayBuffer());
  const registry = new Registry({
    onigLib: Promise.resolve({ createOnigScanner: patterns => new OnigScanner(patterns), createOnigString: value => new OnigString(value) }),
    loadGrammar: async scope => scope === 'source.balkh' ? grammarDefinition : null,
  });
  const grammar = await registry.loadGrammar('source.balkh');
  monaco.languages.register({ id: 'balkh', extensions: ['.blk'] });
  monaco.languages.setLanguageConfiguration('balkh', {
    ...configuration,
    wordPattern: new RegExp(configuration.wordPattern),
    indentationRules: Object.fromEntries(Object.entries(configuration.indentationRules).map(([key, value]) => [key, new RegExp(value)])),
  });
  monaco.languages.setTokensProvider('balkh', {
    getInitialState: () => new TokenState(),
    tokenize(line, state) {
      const result = grammar.tokenizeLine(line, state.stack, 200);
      return { tokens: result.tokens.map(token => ({ startIndex: token.startIndex, scopes: tokenClass(token.scopes) })), endState: new TokenState(result.ruleStack) };
    },
  });
}

export async function createEditor(container, { source, rtl, onChange, onRun }) {
  await setupLanguage();
  monaco.editor.defineTheme('balkh-playground', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'keyword', foreground: 'C6A8F0' },
      { token: 'string', foreground: 'A9D59B' },
      { token: 'number', foreground: 'F4C582' },
      { token: 'comment', foreground: '72869E', fontStyle: 'italic' },
      { token: 'function', foreground: 'F3D798' },
      { token: 'predefined', foreground: '79DDC8' },
      { token: 'type', foreground: '79DDC8' },
      { token: 'constant', foreground: 'E8AD98' },
    ],
    colors: {
      'editor.background': '#111d2e', 'editor.foreground': '#dbe5ef', 'editorLineNumber.foreground': '#50657f',
      'editorLineNumber.activeForeground': '#a4bacf', 'editorCursor.foreground': '#79ddc8',
      'editor.selectionBackground': '#2e4a60', 'editor.lineHighlightBackground': '#16243a',
      'editorIndentGuide.background1': '#25354a', 'editorIndentGuide.activeBackground1': '#4a6079',
      'scrollbarSlider.background': '#53658144', 'scrollbarSlider.hoverBackground': '#53658177',
    },
  });
  container.replaceChildren();
  const model = monaco.editor.createModel(source, 'balkh');
  const editor = monaco.editor.create(container, {
    model, theme: 'balkh-playground', automaticLayout: true, fontSize: 16, lineHeight: 29,
    fontFamily: '"Cascadia Code", "Noto Sans Mono", Consolas, Tahoma, monospace',
    padding: { top: 17, bottom: 20 }, tabSize: 4, insertSpaces: true,
    minimap: { enabled: false }, scrollBeyondLastLine: false, renderLineHighlight: 'line',
    lineNumbersMinChars: 3, folding: true, glyphMargin: false,
    unicodeHighlight: { ambiguousCharacters: false, nonBasicASCII: false, invisibleCharacters: false },
    ariaLabel: 'Balkh source editor', accessibilitySupport: 'auto',
    // Keep the RTL line origin inside the viewport. With unwrapped long lines,
    // Monaco anchors every RTL line to its wider horizontal content canvas.
    wordWrap: 'on', wrappingIndent: 'same',
    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
  });
  const decorations = editor.createDecorationsCollection();
  const align = () => decorations.set([{ range: model.getFullModelRange(), options: {
    description: 'Balkh source direction', isWholeLine: true,
    textDirection: rtl ? monaco.editor.TextDirection.RTL : monaco.editor.TextDirection.LTR,
    stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
  } }]);
  align();
  model.onDidChangeContent(() => { align(); onChange(model.getValue()); });
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, onRun);
  // Ctrl+M is Monaco's standard way to let Tab move focus out of the editor.
  container.dispatchEvent(new CustomEvent('balkh-editor-ready', { bubbles: true, detail: editor }));
  return {
    getValue: () => model.getValue(),
    setValue(value) {
      // Opening an example must remain undoable so it cannot erase a draft.
      editor.pushUndoStop();
      editor.executeEdits('balkh-example', [{ range: model.getFullModelRange(), text: value }]);
      editor.pushUndoStop();
    },
    setDirection(value) { rtl = value; align(); },
    focus: () => editor.focus(),
  };
}
