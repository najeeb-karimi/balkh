const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createOutputRunner } = require('../output-runner.cjs');

function fixture() {
  const calls = [];
  const contexts = [];
  const messages = [];
  const inputs = [];
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
      createInputBox() {
        const events = new EventEmitter();
        const subscribe = name => callback => {
          events.on(name, callback);
          return { dispose: () => events.off(name, callback) };
        };
        const box = {
          value: '', disposed: false,
          onDidAccept: subscribe('accept'), onDidHide: subscribe('hide'), onDidTriggerButton: subscribe('button'),
          show() { this.shown = true; },
          dispose() { this.disposed = true; events.emit('hide'); },
          accept(value) { this.value = value; events.emit('accept'); },
          hide() { events.emit('hide'); },
          button(index) { events.emit('button', this.buttons[index]); },
        };
        inputs.push(box);
        return box;
      },
    },
    ThemeIcon: class { constructor(id) { this.id = id; } },
    commands: { executeCommand: async (...args) => contexts.push(args) },
  };
  const spawn = (...args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.answers = [];
    child.stdin.on('data', line => child.answers.push(JSON.parse(line.toString('utf8'))));
    child.kill = () => { queueMicrotask(() => child.emit('close', null, 'SIGTERM')); return true; };
    calls.push({ args, child });
    return child;
  };
  const runner = createOutputRunner(vscode, spawn);
  const command = { python: '/python with spaces/python', args: ['-u', '-m', 'balkh.cli', '/tmp/سلام $(echo nope).blk'], cwd: '/tmp', env: { PYTHONIOENCODING: 'utf-8' } };
  return { runner, command, calls, contexts, messages, inputs, channel, created: () => created };
}

function request(f, id, prompt, split = false) {
  const { args, child } = f.calls.at(-1);
  const token = args[2].env.BALKH_INPUT_TOKEN;
  const frame = `\x1eBALKH_INPUT:${token}:${JSON.stringify({ type: 'input', id, prompt })}\x1f`;
  if (split) for (const byte of Buffer.from(frame)) child.stdout.write(Buffer.from([byte]));
  else child.stdout.write(frame);
}

test('Output streams split UTF-8 stdout and stderr without changing logical text', async () => {
  const f = fixture();
  const execution = f.runner.run(f.command);
  const { args, child } = f.calls[0];
  assert.equal(args[0], f.command.python);
  assert.deepEqual(args[1], f.command.args);
  assert.equal(args[2].shell, false);
  assert.equal(args[2].windowsHide, true);
  assert.deepEqual(args[2].stdio, ['pipe', 'pipe', 'pipe']);
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

test('native input prompts preserve Unicode, whitespace and empty answers, with explicit EOF', async () => {
  const f = fixture();
  const execution = f.runner.run(f.command);
  const { child } = f.calls[0];
  child.stdout.write('نام: ');
  assert.equal(f.inputs.length, 0, 'Ordinary output must not be mistaken for an input request');
  request(f, 1, 'نام: ', true);
  const first = f.inputs[0];
  assert.equal(first.prompt, 'نام: ');
  assert.equal(first.ignoreFocusOut, true);
  assert.equal(first.shown, true);
  first.accept('  زرغونه 😀  ');
  assert.equal(first.disposed, true);
  request(f, 2, 'تش: ');
  f.inputs[1].accept('');
  request(f, 3, 'EOF: ');
  f.inputs[2].button(0);
  assert.deepEqual(child.answers, [
    { id: 1, value: '  زرغونه 😀  ', eof: false },
    { id: 2, value: '', eof: false },
    { id: 3, value: '', eof: true },
  ]);
  assert.match(f.channel.text, /نام:   زرغونه 😀  \n/);
  assert.doesNotMatch(f.channel.text, /BALKH_INPUT|"eof"/);
  child.emit('close', 0, null);
  assert.equal((await execution.finished).exitCode, 0);
});

test('multiline answers are rejected without discarding the prompt', async () => {
  const f = fixture();
  const execution = f.runner.run(f.command);
  request(f, 1, 'Answer');
  f.inputs[0].accept('one\ntwo');
  assert.match(f.inputs[0].validationMessage, /one line/);
  assert.equal(f.inputs[0].disposed, false);
  assert.deepEqual(f.calls[0].child.answers, []);
  f.inputs[0].accept('one');
  assert.deepEqual(f.calls[0].child.answers, [{ id: 1, value: 'one', eof: false }]);
  f.calls[0].child.emit('close', 0, null);
  await execution.finished;
});

for (const action of ['escape', 'command', 'button', 'dispose']) {
  test(`${action} stops a pending prompt and ignores late answers`, async () => {
    const f = fixture();
    const execution = f.runner.run(f.command);
    request(f, 1, 'Waiting');
    const box = f.inputs[0];
    if (action === 'escape') box.hide();
    else if (action === 'command') f.runner.stop();
    else if (action === 'button') box.button(1);
    else f.runner.dispose();
    assert.equal((await execution.finished).stopped, true);
    assert.equal(box.disposed, true);
    box.accept('too late');
    assert.deepEqual(f.calls[0].child.answers, []);
    if (action !== 'dispose') {
      const next = f.runner.run(f.command);
      request(f, 1, 'New run');
      box.accept('still too late');
      assert.deepEqual(f.calls[1].child.answers, []);
      f.inputs[1].accept('fresh');
      assert.equal(f.calls[1].child.answers[0].value, 'fresh');
      f.calls[1].child.emit('close', 0, null);
      await next.finished;
    }
  });
}

test('program exit and stdin errors dispose pending prompts without leaking a run', async () => {
  const f = fixture();
  const first = f.runner.run(f.command);
  request(f, 1, 'Waiting');
  f.calls[0].child.emit('close', 7, null);
  assert.equal((await first.finished).exitCode, 7);
  assert.equal(f.inputs[0].disposed, true);
  f.inputs[0].accept('late');
  assert.deepEqual(f.calls[0].child.answers, []);
  const next = f.runner.run(f.command);
  request(f, 1, 'Waiting again');
  f.calls[1].child.stdin.emit('error', new Error('EPIPE'));
  assert.equal((await next.finished).error, 'EPIPE');
  assert.equal(f.inputs[1].disposed, true);
  assert.equal(f.contexts.at(-1)[2], false);
});

test('malformed and unrelated control-like output stays visible and never opens an input box', async () => {
  const f = fixture();
  const execution = f.runner.run(f.command);
  const { child, args } = f.calls[0];
  const token = args[2].env.BALKH_INPUT_TOKEN;
  const text = `before\x1eBALKH_INPUT:other:{"type":"input","id":1,"prompt":"no"}\x1f` +
    `\x1eBALKH_INPUT:${token}:not JSON\x1f` +
    `\x1eBALKH_INPUT:${token}:${'x'.repeat(9000)}\x1fafter`;
  for (let i = 0; i < text.length; i += 19) child.stdout.write(text.slice(i, i + 19));
  child.emit('close', 0, null);
  await execution.finished;
  assert.equal(f.inputs.length, 0);
  assert.ok(f.channel.text.includes(text));
});
