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
import { createScrollbars } from './scrollbars.js';

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

// Monaco keeps its own layout and hit testing intact. RTL chrome is rendered
// beside the editor and synchronized through public viewport/scroll APIs.
function directionalChrome(editor, container, host, gutter) {
  let rtl = false;
  let frame = 0;
  let dragAnchor = null;
  const numberRows = new Map();
  const listeners = new AbortController();
  const { signal } = listeners;
  const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
  const scrollbars = createScrollbars(container, {
    read() {
      const { height, contentWidth } = editor.getLayoutInfo();
      return {
        vertical: { viewport: height, content: editor.getScrollHeight(), position: editor.getScrollTop() },
        horizontal: { viewport: contentWidth, content: editor.getScrollWidth(), position: editor.getScrollLeft() },
      };
    },
    scrollTo(axis, position) {
      if (axis === 'vertical') editor.setScrollTop(position, monaco.editor.ScrollType.Immediate);
      else editor.setScrollLeft(position, monaco.editor.ScrollType.Immediate);
    },
    onWheel: forwardWheel,
  });
  function lineAt(y) {
    const bounds = host.getBoundingClientRect();
    const x = bounds.left + editor.getLayoutInfo().contentLeft + 5;
    return editor.getTargetAtClientPoint(x, Math.max(bounds.top + 1, Math.min(bounds.bottom - 1, y)))?.position?.lineNumber;
  }
  function render() {
    cancelAnimationFrame(frame);
    frame = 0;
    scrollbars.update();
    if (!rtl) return;
    editor.render();
    const model = editor.getModel();
    const font = editor.getOption(monaco.editor.EditorOption.fontInfo);
    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
    const width = Math.ceil(Math.max(3, String(model.getLineCount()).length) * font.maxDigitWidth + 16);
    const value = `${width}px`;
    if (container.style.getPropertyValue('--editor-gutter-width') !== value) {
      container.style.setProperty('--editor-gutter-width', value);
      editor.layout();
    }
    gutter.style.font = `${font.fontSize}px/${lineHeight}px ${font.fontFamily}`;
    const visible = new Set();
    for (const range of editor.getVisibleRanges()) {
      for (let line = range.startLineNumber; line <= range.endLineNumber; line++) visible.add(line);
    }
    // getVisibleRanges excludes partial rows. Hit-test the two viewport edges
    // to include those without inventing numbers for folded/hidden lines.
    const bounds = host.getBoundingClientRect();
    for (const y of [bounds.top + 1, bounds.bottom - 1]) {
      const line = lineAt(y);
      if (line) visible.add(line);
    }
    const retained = new Set();
    for (const line of [...visible].sort((a, b) => a - b)) {
      const top = editor.getTopForLineNumber(line) - editor.getScrollTop();
      if (top + lineHeight <= 0 || top >= editor.getLayoutInfo().height) continue;
      let row = numberRows.get(line);
      if (!row) {
        row = document.createElement('div');
        row.className = 'editor-side-line-number';
        row.dataset.line = String(line);
        row.textContent = String(line);
        numberRows.set(line, row);
        gutter.append(row);
      }
      retained.add(line);
      row.classList.toggle('active', line === editor.getPosition()?.lineNumber);
      row.style.top = `${top}px`;
      row.style.height = `${lineHeight}px`;
    }
    for (const [line, row] of numberRows) {
      if (!retained.has(line)) { row.remove(); numberRows.delete(line); }
    }
  }
  function selectLines(anchor, target) {
    const model = editor.getModel();
    const end = line => line < model.getLineCount() ? [line + 1, 1] : [line, model.getLineMaxColumn(line)];
    const from = target < anchor ? end(anchor) : [anchor, 1];
    const to = target < anchor ? [target, 1] : end(target);
    editor.setSelection(new monaco.Selection(...from, ...to));
  }
  function forwardWheel(event) {
    if (event.ctrlKey) return;
    // Use the same wheel normalization, accumulated destination and animation
    // over the code, numbers and scrollbar. Thumb dragging stays immediate.
    const forwarded = new WheelEvent('wheel', event);
    editor.getDomNode().dispatchEvent(forwarded);
    if (forwarded.defaultPrevented) event.preventDefault();
  }
  gutter.addEventListener('wheel', forwardWheel, { passive: false, signal });
  gutter.addEventListener('pointerdown', event => {
    const line = Number(event.target.dataset.line);
    if (event.button !== 0 || !line) return;
    event.preventDefault();
    dragAnchor = event.shiftKey ? editor.getSelection().selectionStartLineNumber : line;
    gutter.setPointerCapture(event.pointerId);
    editor.focus();
    selectLines(dragAnchor, line);
  }, { signal });
  gutter.addEventListener('pointermove', event => {
    if (dragAnchor === null) return;
    const bounds = host.getBoundingClientRect();
    if (event.clientY < bounds.top || event.clientY > bounds.bottom) {
      const step = editor.getOption(monaco.editor.EditorOption.lineHeight);
      editor.setScrollTop(editor.getScrollTop() + (event.clientY < bounds.top ? -step : step));
      editor.render();
    }
    const line = lineAt(event.clientY);
    if (line) selectLines(dragAnchor, line);
  }, { signal });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) gutter.addEventListener(type, () => { dragAnchor = null; }, { signal });
  const subscriptions = [
    // Move the numbers in the same frame as Monaco's text. Scheduling another
    // animation frame here makes the gutter visibly trail smooth scrolling.
    editor.onDidScrollChange(render), editor.onDidLayoutChange(schedule),
    editor.onDidChangeModelContent(schedule), editor.onDidChangeCursorPosition(schedule),
    editor.onDidChangeHiddenAreas(schedule), editor.onDidContentSizeChange(schedule),
    editor.onDidChangeConfiguration(schedule),
  ];
  editor.onDidDispose(() => {
    cancelAnimationFrame(frame);
    listeners.abort();
    scrollbars.dispose();
    for (const subscription of subscriptions) subscription.dispose();
  });
  return {
    setDirection(value) {
      rtl = value;
      const scrollTop = editor.getScrollTop();
      container.dataset.editorDirection = rtl ? 'rtl' : 'ltr';
      gutter.hidden = !rtl;
      editor.updateOptions({
        lineNumbers: rtl ? 'off' : 'on',
      });
      editor.layout();
      editor.setScrollTop(scrollTop);
      schedule();
    },
  };
}

export async function createEditor(container, { source, rtl, ariaLabel, onChange, onRun }) {
  await setupLanguage();
  monaco.editor.defineTheme('balkh-playground', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'keyword', foreground: 'C6A8F0' },
      { token: 'string', foreground: 'A9D59B' },
      { token: 'number', foreground: 'F4C582' },
      { token: 'comment', foreground: '72869E', fontStyle: 'italic' },
      { token: 'function', foreground: 'F3D798' },
      { token: 'predefined', foreground: 'F48FB1' },
      { token: 'type', foreground: 'F48FB1' },
      { token: 'constant', foreground: 'E8AD98' },
    ],
    colors: {
      'editor.background': '#111d2e', 'editor.foreground': '#dbe5ef', 'editorLineNumber.foreground': '#50657f',
      'editorLineNumber.activeForeground': '#a4bacf', 'editorCursor.foreground': '#f06292',
      'editor.selectionBackground': '#f0629259', 'editor.inactiveSelectionBackground': '#f0629233',
      'editor.selectionHighlightBackground': '#f48fb126', 'selection.background': '#f0629259',
      'editor.lineHighlightBackground': '#16243a',
      'focusBorder': '#f48fb1',
      'editorIndentGuide.background1': '#25354a', 'editorIndentGuide.activeBackground1': '#4a6079',
    },
  });
  container.replaceChildren();
  const host = document.createElement('div');
  host.className = 'editor-host';
  const gutter = document.createElement('div');
  gutter.className = 'editor-side-gutter';
  gutter.setAttribute('aria-hidden', 'true');
  container.append(host, gutter);
  const model = monaco.editor.createModel(source, 'balkh');
  const editor = monaco.editor.create(host, {
    model, theme: 'balkh-playground', automaticLayout: true, fontSize: 16, lineHeight: 29,
    fontFamily: '"Cascadia Code", "Noto Sans Mono", Consolas, Tahoma, monospace',
    padding: { top: 17, bottom: 20 }, tabSize: 4, insertSpaces: true,
    minimap: { enabled: false }, scrollBeyondLastLine: false, renderLineHighlight: 'line',
    lineNumbersMinChars: 3, folding: true, glyphMargin: false,
    unicodeHighlight: { ambiguousCharacters: false, nonBasicASCII: false, invisibleCharacters: false },
    ariaLabel, accessibilitySupport: 'auto',
    // Keep the RTL line origin inside the viewport. With unwrapped long lines,
    // Monaco anchors every RTL line to its wider horizontal content canvas.
    wordWrap: 'on', wrappingIndent: 'same',
    overviewRulerLanes: 0, hideCursorInOverviewRuler: true,
    scrollbar: { vertical: 'hidden', horizontal: 'hidden', verticalScrollbarSize: 0, horizontalScrollbarSize: 0, useShadows: false },
  });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const updateMotion = () => editor.updateOptions({ smoothScrolling: !reducedMotion.matches });
  updateMotion();
  reducedMotion.addEventListener('change', updateMotion);
  editor.onDidDispose(() => reducedMotion.removeEventListener('change', updateMotion));
  const chrome = directionalChrome(editor, container, host, gutter);
  chrome.setDirection(rtl);
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
    setAriaLabel: value => editor.updateOptions({ ariaLabel: value }),
    setValue(value) {
      // Opening an example must remain undoable so it cannot erase a draft.
      editor.pushUndoStop();
      editor.executeEdits('balkh-example', [{ range: model.getFullModelRange(), text: value }]);
      editor.pushUndoStop();
    },
    setDirection(value) { rtl = value; chrome.setDirection(rtl); align(); },
    focus: () => editor.focus(),
  };
}
