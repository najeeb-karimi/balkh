const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

async function hostFixture(initial = 'چاپ("سلام")\r\n', baseUrl = 'http://127.0.0.1:8777') {
  let provider;
  let receiver;
  let listener;
  let dispose;
  let settingListener;
  const sent = [];
  const commands = [];
  const errors = [];
  const handlers = new Map();
  const tasks = [];
  const context = { extensionUri: { path: '' }, subscriptions: [] };
  const uri = { scheme: 'file', path: '/example.blk', fsPath: '/example.blk', toString: () => 'file:///example.blk' };
  const document = {
    uri, version: 1, text: initial, saves: 0,
    getText() { return this.text; },
    positionAt(offset) { return offset; },
    async save() { this.saves++; return true; },
  };
  const panel = {
    webview: {
      cspSource: baseUrl,
      asWebviewUri: (value) => ({ toString: () => `${baseUrl}/${value.path}` }),
      onDidReceiveMessage: (fn) => { receiver = fn; return { dispose() { receiver = null; } }; },
      postMessage: (message) => { sent.push(message); return Promise.resolve(true); },
    },
    onDidDispose: (fn) => { dispose = fn; },
  };
  const vscode = {
    Uri: { joinPath: (base, ...parts) => ({ path: [base.path, ...parts].filter(Boolean).join('/') }) },
    Range: class { constructor(start, end) { this.start = start; this.end = end; } },
    WorkspaceEdit: class { replace(file, range, text) { this.range = range; this.text = text; this.file = file; } },
    window: {
      tabGroups: { activeTabGroup: { activeTab: { input: { uri } } } },
      registerCustomEditorProvider: (id, value) => { provider = value; return { dispose() {} }; },
      showErrorMessage: (message) => errors.push(message),
    },
    commands: {
      registerCommand: (name, fn) => { handlers.set(name, fn); return { dispose() {} }; },
      executeCommand: async (...args) => commands.push(args),
    },
    ProcessExecution: class { constructor(process, args, options) { Object.assign(this, { process, args, options }); } },
    Task: class { constructor(definition, scope, name, source, execution) { Object.assign(this, { definition, scope, name, source, execution }); } },
    TaskScope: { Global: 1 }, TaskRevealKind: { Always: 1 }, TaskPanelKind: { Shared: 1 },
    tasks: { executeTask: async (task) => { tasks.push(task); return { task }; } },
    workspace: {
      isTrusted: true,
      openTextDocument: async () => document,
      getWorkspaceFolder: () => null,
      fs: { isWritableFileSystem: () => true },
      getConfiguration: () => ({ get: (key, fallback) => ({ tabSize: 4, insertSpaces: true, fontSize: 14, wordWrap: 'off', renderWhitespace: 'none', runInTerminal: true })[key] ?? fallback }),
      onDidChangeTextDocument: (fn) => { listener = fn; return { dispose() { listener = null; } }; },
      onDidChangeConfiguration: (fn) => { settingListener = fn; return { dispose() { settingListener = null; } }; },
      applyEdit: async (edit) => {
        document.text = document.text.slice(0, edit.range.start) + edit.text + document.text.slice(edit.range.end);
        document.version++;
        listener?.({ document, contentChanges: [{}] });
        return true;
      },
    },
  };
  const module = { exports: {} };
  const code = fs.readFileSync(path.join(root, 'extension.cjs'), 'utf8');
  vm.runInNewContext(code, {
    module, process, setTimeout, clearTimeout,
    require: (name) => name === 'vscode' ? vscode : require(name.startsWith('./') ? path.join(root, name) : name),
  });
  module.exports.activate(context);
  await provider.resolveCustomTextEditor(document, panel);
  return {
    document, panel, sent, commands, errors, tasks,
    runCommand: () => handlers.get('balkh.runFile')(),
    async receive(message) { receiver?.(message); await new Promise((resolve) => setImmediate(resolve)); },
    external(text) { document.text = text; document.version++; listener?.({ document, contentChanges: [{}] }); },
    dispose() { dispose(); },
    settings() { settingListener?.({ affectsConfiguration: () => true }); },
  };
}
module.exports = { hostFixture };
