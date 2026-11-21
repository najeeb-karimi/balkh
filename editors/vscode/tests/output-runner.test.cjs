const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createOutputRunner } = require('../output-runner.cjs');

function fixture() {
  const calls = [];
  const contexts = [];
  const messages = [];
  let created = 0;
  const channel = {
    text: '', shown: false, disposed: false,
    clear() { this.text = ''; }, show() { this.shown = true; },
    append(text) { this.text += text; }, appendLine(text) { this.text += text + '\n'; },
    dispose() { this.disposed = true; },
  };
  const vscode = {
    window: {
      createOutputChannel(name) { assert.equal(name, 'Balkh'); created++; return channel; },
      showInformationMessage(message) { messages.push(message); },
    },
    commands: { executeCommand: async (...args) => contexts.push(args) },
  };
  const spawn = (...args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { queueMicrotask(() => child.emit('close', null, 'SIGTERM')); return true; };
    calls.push({ args, child });
    return child;
  };
  const runner = createOutputRunner(vscode, spawn);
  const command = { python: '/python with spaces/python', args: ['-u', '-m', 'balkh.cli', '/tmp/سلام $(echo nope).blk'], cwd: '/tmp', env: { PYTHONIOENCODING: 'utf-8' } };
  return { runner, command, calls, contexts, messages, channel, created: () => created };
}

test('Output streams split UTF-8 stdout and stderr without changing logical text', async () => {
  const f = fixture();
  const execution = f.runner.run(f.command);
  const { args, child } = f.calls[0];
  assert.equal(args[0], f.command.python);
  assert.deepEqual(args[1], f.command.args);
  assert.equal(args[2].shell, false);
  assert.equal(args[2].windowsHide, true);
  assert.deepEqual(args[2].stdio, ['ignore', 'pipe', 'pipe']);
  assert.equal(args[2].env.PYTHONIOENCODING, 'utf-8');
  const text = Buffer.from('سلام بلخ 😀\n', 'utf8');
  for (const byte of text) child.stdout.write(Buffer.from([byte]));
  child.stderr.write('خطا\n');
  child.emit('close', 0, null);
  assert.equal((await execution.finished).exitCode, 0);
  assert.ok(f.channel.text.includes('سلام بلخ 😀\nخطا\n'));
  assert.ok(!f.channel.text.includes('\uFFFD'));
  assert.match(f.channel.text, /exited with code 0/);
  assert.equal(f.channel.shown, true);
  assert.equal(f.contexts.at(-1)[2], false);
});

test('Stop terminates the running process and allows another run in the same channel', async () => {
  const f = fixture();
  const first = f.runner.run(f.command);
  assert.equal(f.runner.run(f.command), undefined);
  assert.equal(f.messages.length, 1);
  f.runner.stop();
  assert.equal((await first.finished).stopped, true);
  assert.match(f.channel.text, /\[Stopped\]/);
  const next = f.runner.run(f.command);
  f.calls[1].child.stderr.write('runtime error\n');
  f.calls[1].child.emit('close', 1, null);
  assert.equal((await next.finished).exitCode, 1);
  assert.equal(f.created(), 1);
  assert.ok(!f.channel.text.includes('[Stopped]'));
});

test('missing executables report an actionable error and finish only once', async () => {
  const f = fixture();
  const execution = f.runner.run(f.command);
  f.calls[0].child.emit('error', new Error('spawn ENOENT'));
  f.calls[0].child.emit('close', -2, null);
  assert.equal((await execution.finished).error, 'spawn ENOENT');
  assert.match(f.channel.text, /balkh.pythonPath/);
  assert.ok(!f.channel.text.includes('[Done]'));
});

test('disposing the runner stops execution and releases its Output channel', async () => {
  const f = fixture();
  const execution = f.runner.run(f.command);
  f.runner.dispose();
  assert.equal((await execution.finished).stopped, true);
  assert.equal(f.channel.disposed, true);
  assert.equal(f.runner.run(f.command), undefined);
});
