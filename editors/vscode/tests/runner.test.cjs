const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runDocument } = require('../runner.cjs');

function fixture({ pythonPath = '', available = [], folder = true, saved = true, trusted = true, runInTerminal = true } = {}) {
  const tasks = [];
  const errors = [];
  const uri = (value) => ({ path: value, fsPath: value, scheme: 'file', toString: () => `file://${value}` });
  const workspace = { uri: uri('/workspace with spaces') };
  const document = {
    uri: uri('/workspace with spaces/سلام $(echo nope).blk'), saves: 0,
    save: async () => { document.saves++; return saved; },
  };
  const vscode = {
    Uri: { joinPath: (base, ...parts) => uri([base.path, ...parts].join('/')) },
    FileType: { File: 1 },
    TaskScope: { Global: 1 }, TaskRevealKind: { Always: 1 }, TaskPanelKind: { Shared: 1 },
    ProcessExecution: class { constructor(process, args, options) { Object.assign(this, { process, args, options }); } },
    Task: class { constructor(definition, scope, name, source, execution) { Object.assign(this, { definition, scope, name, source, execution }); } },
    tasks: { executeTask: async (task) => { tasks.push(task); return { task }; } },
    window: { showErrorMessage: (message) => errors.push(message) },
    workspace: {
      isTrusted: trusted,
      getWorkspaceFolder: () => folder ? workspace : null,
      getConfiguration: () => ({ get: (key) => ({ pythonPath, runInTerminal })[key] }),
      fs: { stat: async (candidate) => {
        if (!available.includes(candidate.path)) throw new Error('not found');
        return { type: 1 };
      } },
    },
  };
  return { vscode, document, tasks, errors };
}

test('runner saves and executes with the workspace Python using literal arguments', async () => {
  const f = fixture({ available: ['/workspace with spaces/.venv/Scripts/python.exe'] });
  await runDocument(f.vscode, f.document, 'win32');
  assert.equal(f.document.saves, 1);
  const task = f.tasks[0];
  assert.equal(task.execution.process, '/workspace with spaces/.venv/Scripts/python.exe');
  assert.deepEqual(task.execution.args, ['-u', '-m', 'balkh.cli', f.document.uri.fsPath]);
  assert.equal(task.execution.options.cwd, '/workspace with spaces');
  assert.equal(task.execution.options.env.PYTHONIOENCODING, 'utf-8');
  assert.equal(task.presentationOptions.focus, true);
});

test('configured Python takes precedence over workspace environments', async () => {
  const f = fixture({ pythonPath: '/my python/python', available: ['/workspace with spaces/.venv/bin/python'] });
  await runDocument(f.vscode, f.document, 'linux');
  assert.equal(f.tasks[0].execution.process, '/my python/python');
});

test('runner detects Unix venv and falls back to the platform Python on PATH', async () => {
  const f = fixture({ available: ['/workspace with spaces/venv/bin/python'] });
  await runDocument(f.vscode, f.document, 'linux');
  assert.equal(f.tasks[0].execution.process, '/workspace with spaces/venv/bin/python');
  for (const [platform, command] of [['linux', 'python3'], ['win32', 'python']]) {
    const fallback = fixture();
    await runDocument(fallback.vscode, fallback.document, platform);
    assert.equal(fallback.tasks[0].execution.process, command);
  }
});

test('standalone files run from their own directory', async () => {
  const f = fixture({ folder: false });
  await runDocument(f.vscode, f.document, 'linux');
  assert.equal(f.tasks[0].scope, f.vscode.TaskScope.Global);
  assert.equal(f.tasks[0].execution.options.cwd, '/workspace with spaces');
});

test('default Output mode keeps the interpreter, Unicode environment, and literal file path', async () => {
  const f = fixture({ runInTerminal: false });
  let command;
  const execution = { finished: Promise.resolve({ exitCode: 0 }) };
  const result = await runDocument(f.vscode, f.document, 'win32', { run: (options) => { command = options; return execution; } });
  assert.equal(result, execution);
  assert.equal(f.tasks.length, 0);
  assert.equal(f.document.saves, 1);
  assert.equal(command.python, 'python');
  assert.equal(command.args[1], require('node:path').resolve(__dirname, '../input_bridge.py'));
  assert.equal(command.args.at(-1), f.document.uri.fsPath);
  assert.equal(command.env.PYTHONIOENCODING, 'utf-8');
});

test('failed saves, untrusted workspaces, unsaved files, and non-Balkh resources never execute', async () => {
  const cases = [
    [fixture({ saved: false }), () => {}],
    [fixture({ trusted: false }), () => {}],
    [fixture(), (f) => { f.document.isUntitled = true; }],
    [fixture(), (f) => { f.document.uri.path = '/file.py'; }],
    [fixture(), (f) => { f.document.uri.scheme = 'git'; }],
    [fixture(), (f) => { f.document = null; }],
  ];
  for (const [f, setup] of cases) {
    setup(f);
    await runDocument(f.vscode, f.document);
    assert.equal(f.tasks.length, 0);
    assert.equal(f.errors.length, 1);
  }
});
