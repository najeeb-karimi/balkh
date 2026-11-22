const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createOutputView, LIMIT } = require('../output-view.cjs');

function fixture() {
  let provider;
  let receiver;
  let close;
  const messages = [];
  const commands = [];
  const copied = [];
  const saved = [];
  const native = {
    text: '', shown: false, disposed: false,
    append(text) { this.text += text; }, clear() { this.text = ''; },
    show() { this.shown = true; }, dispose() { this.disposed = true; },
  };
  const context = {
    extensionUri: { path: '/extension' },
    workspaceState: { get: (_key, fallback) => fallback, update: async (...args) => saved.push(args) },
  };
  const vscode = {
    Uri: { joinPath: (base, ...parts) => ({ path: [base.path, ...parts].join('/') }) },
    window: {
      createOutputChannel: () => native,
      registerWebviewViewProvider(id, value) { assert.equal(id, 'balkh.output'); provider = value; return { dispose() {} }; },
    },
    commands: { executeCommand: async (...args) => commands.push(args) },
    env: { clipboard: { writeText: async text => copied.push(text) } },
  };
  const output = createOutputView(vscode, context);
  const resolve = () => {
    const view = {
      shown: false,
      show() { this.shown = true; },
      onDidDispose(fn) { close = fn; },
      webview: {
        cspSource: 'https://assets.example',
        asWebviewUri: value => ({ toString: () => 'https://assets.example' + value.path }),
        onDidReceiveMessage(fn) { receiver = fn; return { dispose() {} }; },
        postMessage(message) { messages.push(message); return Promise.resolve(true); },
      },
    };
    provider.resolveWebviewView(view);
    return view;
  };
  return { output, native, resolve, messages, commands, copied, saved, receive: data => receiver(data), close: () => close() };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 60));

test('output survives delayed view creation, reload and clear; native mirror retains exact text', async t => {
  const f = fixture(); t.after(() => f.output.dispose());
  f.output.clear(); f.output.show(true);
  f.output.append('حدس شما: '); f.output.appendLine('۷'); f.output.setRunning(true);
  assert.deepEqual(f.commands[0], ['balkh.output.focus', { preserveFocus: true }]);
  const view = f.resolve();
  assert.match(view.webview.html, /default-src 'none'/);
  assert.doesNotMatch(view.webview.html, /حدس شما/);
  f.receive({ type: 'ready' });
  assert.deepEqual(f.messages.at(-1), { type: 'snapshot', text: 'حدس شما: ۷\n', trim: 0, truncated: false, running: true, direction: 'rtl' });
  f.output.append('سلام 😀'); await flush();
  assert.equal(f.messages.at(-1).type, 'append');
  assert.equal(f.messages.at(-1).text, 'سلام 😀');
  assert.equal(f.native.text, 'حدس شما: ۷\nسلام 😀');
  f.close(); f.output.appendLine('hidden'); f.resolve(); f.receive({ type: 'ready' });
  assert.equal(f.messages.at(-1).text, f.native.text);
  f.output.clear(); f.output.setRunning(false); await flush();
  assert.equal(f.messages.at(-1).type, 'snapshot');
  assert.equal(f.messages.at(-1).text, '');
  assert.equal(f.messages.at(-1).running, false);
});

test('bounded view trims Unicode safely while native Output keeps the full transcript', async t => {
  const f = fixture(); t.after(() => f.output.dispose());
  f.resolve(); f.receive({ type: 'ready' });
  const initial = '😀' + 'x'.repeat(LIMIT - 2);
  f.output.append(initial); await flush();
  f.output.append('y'); await flush();
  assert.equal(f.messages.at(-1).trim, 2, 'both UTF-16 halves must be removed');
  assert.equal(f.messages.at(-1).text, 'y');
  assert.equal(f.messages.at(-1).truncated, true);
  f.output.append('z'.repeat(LIMIT + 50)); await flush();
  assert.equal(f.messages.at(-1).type, 'snapshot');
  assert.equal(f.messages.at(-1).text, 'z'.repeat(LIMIT));
  assert.equal(f.native.text, initial + 'y' + 'z'.repeat(LIMIT + 50));
});

test('view actions allow only direction, copy, clear and Stop; disposal ends updates', async () => {
  const f = fixture();
  f.resolve(); f.receive({ type: 'ready' });
  const literal = '<img src=x onerror="alert(1)">\nچاپ';
  f.output.append(literal);
  f.receive({ type: 'direction', value: 'ltr' });
  f.receive({ type: 'direction', value: '<script>' });
  f.receive({ type: 'copy' });
  f.receive({ type: 'stop' });
  f.receive({ type: 'command', command: 'arbitrary.command' });
  await flush();
  assert.equal(f.messages.at(-1).direction, 'ltr');
  assert.deepEqual(f.saved, [['outputDirection', 'ltr']]);
  assert.deepEqual(f.copied, [literal]);
  assert.deepEqual(f.commands, [['balkh.stopRun']]);
  f.receive({ type: 'clear' }); await flush();
  assert.equal(f.native.text, '');
  f.output.dispose(); f.output.append('late'); f.output.show();
  assert.equal(f.native.text, '');
  assert.equal(f.native.disposed, true);
});
