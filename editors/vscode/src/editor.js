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
import '../node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css';
import { Registry, INITIAL } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import grammarDefinition from '../syntaxes/balkh.tmLanguage.json';
import configuration from '../language-configuration.json';
import { replacement, SyncState } from '../sync.cjs';
import { tokenClass } from './tokens.cjs';

const api = acquireVsCodeApi();
const assets = document.currentScript.dataset;
const status = document.getElementById('status');
const conflict = document.getElementById('conflict');
const direction = document.getElementById('direction');
let editor;
let model;
let updating = false;
let rtl = api.getState()?.rtl !== false;
let documentReadOnly = false;
const deferred = [];
const sync = new SyncState((message) => api.postMessage(message));
let workerUrl;
self.MonacoEnvironment = {
  getWorker() {
    workerUrl ||= URL.createObjectURL(new Blob([
      `importScripts(${JSON.stringify(assets.worker)});`,
    ], { type: 'application/javascript' }));
    return new Worker(workerUrl);
  },
};

class TokenState {
  constructor(stack = INITIAL) { this.stack = stack; }
  clone() { return new TokenState(this.stack); }
  equals(other) { return other instanceof TokenState && this.stack.equals(other.stack); }
}

async function setupLanguage() {
  const response = await fetch(assets.wasm);
  if (!response.ok) throw new Error('Could not load the syntax tokenizer.');
  await loadWASM(await response.arrayBuffer());
  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns) => new OnigScanner(patterns),
      createOnigString: (value) => new OnigString(value),
    }),
    loadGrammar: async (scope) => scope === 'source.balkh' ? grammarDefinition : null,
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
      return {
        tokens: result.tokens.map((token) => ({ startIndex: token.startIndex, scopes: tokenClass(token.scopes) })),
        endState: new TokenState(result.ruleStack),
      };
    },
  });
}

function updateTheme() {
  const dark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');
  const highContrast = document.body.classList.contains('vscode-high-contrast') || document.body.classList.contains('vscode-high-contrast-light');
  const css = getComputedStyle(document.body);
  const colors = {};
  for (const [key, variable] of Object.entries({
    'editor.background': '--vscode-editor-background',
    'editor.foreground': '--vscode-editor-foreground',
    'editorLineNumber.foreground': '--vscode-editorLineNumber-foreground',
    'editorCursor.foreground': '--vscode-editorCursor-foreground',
    'editor.selectionBackground': '--vscode-editor-selectionBackground',
  })) {
    const value = css.getPropertyValue(variable).trim();
    if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) colors[key] = value;
  }
  monaco.editor.defineTheme('balkh', {
    base: highContrast ? (dark ? 'hc-black' : 'hc-light') : (dark ? 'vs-dark' : 'vs'),
    inherit: true,
    rules: [
      { token: 'function', foreground: dark ? 'DCDCAA' : '795E26' },
      { token: 'type', foreground: dark ? '4EC9B0' : '267F99' },
      { token: 'predefined', foreground: dark ? 'DCDCAA' : '795E26' },
      { token: 'constant', foreground: dark ? '569CD6' : '0000FF' },
    ],
    colors,
  });
  monaco.editor.setTheme('balkh');
}

let decorations;
function alignLines() {
  decorations.set([{
    range: model.getFullModelRange(),
    options: {
      description: 'Balkh line direction', isWholeLine: true,
      textDirection: rtl ? monaco.editor.TextDirection.RTL : monaco.editor.TextDirection.LTR,
      stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
    },
  }]);
  direction.textContent = rtl ? 'Switch to LTR' : 'Switch to RTL';
  document.querySelector('header > span').textContent = `Balkh · ${rtl ? 'RTL' : 'LTR'}`;
}

function displayState() {
  conflict.hidden = !sync.conflict;
  editor.updateOptions({ readOnly: documentReadOnly || sync.conflict });
  status.textContent = sync.conflict ? 'Resolve changes to continue editing.' : '';
  if (!sync.pending && !sync.conflict && sync.local === sync.base) {
    while (deferred.length) deferred.shift()();
  }
}

function applyText(text) {
  const before = model.getValue();
  if (before === text) return;
  const change = replacement(before, text);
  const start = model.getPositionAt(change.start);
  const end = model.getPositionAt(change.end);
  updating = true;
  try {
    model.applyEdits([{ range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column), text: change.text }]);
  } finally { updating = false; }
  alignLines();
}

function hostCommand(command) {
  deferred.push(() => api.postMessage({ type: 'command', command }));
  displayState();
}

async function start() {
  await setupLanguage();
  updateTheme();
  new MutationObserver(updateTheme).observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-vscode-theme-id'] });
  window.addEventListener('message', ({ data: message }) => {
    if (message.type === 'init' && !editor) {
      sync.initialize(message.text, message.version);
      documentReadOnly = message.options.readOnly;
      model = monaco.editor.createModel(message.text, 'balkh');
      editor = monaco.editor.create(document.getElementById('editor'), {
        ...message.options, model, theme: 'balkh', automaticLayout: true,
        minimap: { enabled: false }, scrollBeyondLastLine: false,
        unicodeHighlight: { ambiguousCharacters: false, nonBasicASCII: false },
        ariaLabel: 'Balkh source editor', accessibilitySupport: 'auto',
      });
      decorations = editor.createDecorationsCollection();
      alignLines();
      model.onDidChangeContent(() => {
        alignLines();
        if (!updating) sync.change(model.getValue());
        displayState();
      });
      editor.addAction({ id: 'undo', label: 'Undo', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ], run: () => hostCommand('undo') });
      editor.addAction({ id: 'redo', label: 'Redo', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ], run: () => hostCommand('redo') });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => sync.save());
      // Monaco normalizes mixed line endings. Sync that explicitly before the first keystroke.
      if (model.getValue() !== sync.local) sync.change(model.getValue());
      displayState();
      editor.focus();
    } else if (editor && ['ack', 'update', 'conflict'].includes(message.type)) {
      sync.receive(message);
      if (!sync.conflict && !sync.pending) applyText(sync.local);
      displayState();
    } else if (editor && message.type === 'options') {
      documentReadOnly = message.options.readOnly;
      editor.updateOptions(message.options);
      displayState();
    } else if (editor && message.type === 'flush') {
      deferred.push(() => api.postMessage({ type: 'flushed', id: message.id }));
      displayState();
    }
  });
  direction.addEventListener('click', () => {
    if (!editor) return;
    rtl = !rtl;
    api.setState({ rtl });
    alignLines();
    editor.focus();
  });
  document.getElementById('standard').addEventListener('click', () => {
    deferred.push(() => api.postMessage({ type: 'reopen' }));
    if (editor) displayState();
    else api.postMessage({ type: 'reopen' });
  });
  document.getElementById('run').addEventListener('click', () => {
    if (!editor) return;
    deferred.push(() => api.postMessage({ type: 'run' }));
    displayState();
  });
  for (const [id, keepLocal] of [['keep-local', true], ['use-file', false]]) {
    document.getElementById(id).addEventListener('click', () => {
      sync.resolve(keepLocal);
      applyText(sync.local);
      displayState();
      editor.focus();
    });
  }
  api.postMessage({ type: 'ready' });
}

start().catch((error) => {
  status.textContent = `Could not load the RTL editor: ${error.message}. Use Reopen Editor With… → Text Editor to return.`;
  console.error(error);
});

