const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createOutputRunner } = require('../output-runner.cjs');

const repository = path.resolve(__dirname, '../../..');
const environmentPython = path.join(repository, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.BALKH_PYTHON || (existsSync(environmentPython) ? environmentPython : process.platform === 'win32' ? 'python' : 'python3');

async function program(t, source, onPrompt = () => {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'balkh-vscode-input-'));
  const filename = path.join(directory, 'سلام $(echo nope).blk');
  await fs.writeFile(filename, source, 'utf8');
  const prompts = [];
  const channel = {
    text: '', clear() { this.text = ''; }, show() {}, dispose() {},
    append(text) { this.text += text; }, appendLine(text) { this.text += text + '\n'; },
  };
  const vscode = {
    commands: { executeCommand() {} },
    ThemeIcon: class { constructor(id) { this.id = id; } },
    window: {
      createOutputChannel() { return channel; },
      createInputBox() {
        const events = new EventEmitter();
        const subscribe = type => callback => {
          events.on(type, callback);
          return { dispose: () => events.off(type, callback) };
        };
        const box = {
          value: '', disposed: false,
          onDidAccept: subscribe('accept'), onDidHide: subscribe('hide'), onDidTriggerButton: subscribe('button'),
          show() { prompts.push(box); queueMicrotask(() => onPrompt(box, prompts.length - 1)); },
          dispose() { this.disposed = true; events.emit('hide'); },
          answer(value) { this.value = value; events.emit('accept'); },
          end() { events.emit('button', this.buttons[0]); },
        };
        return box;
      },
    },
  };
  const runner = createOutputRunner(vscode);
  t.after(async () => {
    runner.dispose();
    // Validate the resolved target before recursively removing a Windows fixture.
    if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('balkh-vscode-input-')) throw new Error('Unexpected fixture path');
    await fs.rm(directory, { recursive: true, force: true });
  });
  const command = {
    python, args: ['-u', path.resolve(__dirname, '../input_bridge.py'), filename],
    cwd: repository, env: { PYTHONIOENCODING: 'utf-8' },
  };
  return { runner, command, channel, prompts, filename };
}

test('real Python resumes native and localized input without replaying code or leaking protocol frames', { timeout: 30000 }, async t => {
  const answers = ['  زرغونه 😀  ', '', 'سلام😀', 'rest', null];
  const f = await program(t, [
    'import sys',
    'print("EXECUTED_ONCE", flush=True)',
    'def ask():',
    '    return ورودی("نام: ")',
    'name = ask()',
    'empty = ننوت("تش: ")',
    'print(repr(name), repr(empty))',
    'print(repr(sys.stdin.read(2)))',
    'print(repr(sys.stdin.readline()))',
    'print(repr(sys.stdin.read()))',
    'print(repr(sys.stdin.readline()))', '',
  ].join('\n'), (box, index) => {
    assert.ok(index < answers.length, 'EOF must persist without reopening input');
    if (answers[index] === null) box.end(); else box.answer(answers[index]);
  });
  const result = await f.runner.run(f.command).finished;
  assert.equal(result.exitCode, 0, f.channel.text);
  assert.equal(f.prompts.length, answers.length);
  assert.equal(f.prompts[0].prompt, 'نام: ');
  assert.equal(f.prompts[1].prompt, 'تش: ', 'A previous prompt must not leak into the next one');
  assert.ok(f.prompts.every(box => box.disposed));
  assert.equal(f.channel.text.match(/EXECUTED_ONCE/g).length, 1);
  assert.match(f.channel.text, /'  زرغونه 😀  ' ''/);
  assert.match(f.channel.text, /'سل'\r?\n'ام😀\\n'/);
  assert.match(f.channel.text, /'rest\\n'\r?\n''/);
  assert.doesNotMatch(f.channel.text, /BALKH_INPUT|\x1e|\x1f/);
});

test('EOF from the native input box retains Balkh diagnostics and the original source line', { timeout: 30000 }, async t => {
  const f = await program(t, '# original first line\ninput("End? ")\n', box => box.end());
  const result = await f.runner.run(f.command).finished;
  assert.equal(result.exitCode, 1);
  assert.match(f.channel.text, /EOFError/);
  assert.match(f.channel.text, /خط ۲/);
  assert.match(f.channel.text, /input\("End\? "\)/);
  assert.doesNotMatch(f.channel.text, /input_bridge\.py|BALKH_INPUT/);
});

test('Stop kills real Python while waiting, disposes its input box and permits a clean next run', { timeout: 30000 }, async t => {
  let opened;
  const waiting = new Promise(resolve => { opened = resolve; });
  let answer = false;
  const f = await program(t, 'print(input("Waiting: "))\n', box => {
    if (answer) box.answer('fresh answer'); else opened(box);
  });
  const first = f.runner.run(f.command);
  const old = await waiting;
  f.runner.stop();
  assert.equal((await first.finished).stopped, true);
  assert.equal(old.disposed, true);
  answer = true;
  const next = f.runner.run(f.command);
  old.answer('stale answer');
  assert.equal((await next.finished).exitCode, 0, f.channel.text);
  assert.match(f.channel.text, /fresh answer\r?\nfresh answer/);
  assert.doesNotMatch(f.channel.text, /stale answer|BALKH_INPUT/);
});

test('ordinary CLI and VS Code terminal commands keep native interactive stdin', { timeout: 30000 }, async t => {
  const f = await program(t, 'name = ورودی("نام: ")\nplace = ننوت("ځای: ")\nempty = input("Empty: ")\nprint(name, place, repr(empty))\n');
  const child = spawn(python, ['-u', '-m', 'balkh.cli', f.filename], {
    cwd: repository, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, shell: false, windowsHide: true,
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let stdout = '', stderr = '', index = 0;
  const prompts = ['نام: ', 'ځای: ', 'Empty: '];
  const answers = ['بلخ 😀', 'افغانستان', ''];
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', text => {
    stdout += text;
    while (index < prompts.length && stdout.includes(prompts[index])) {
      child.stdin.write(answers[index++] + '\n');
      if (index === prompts.length) child.stdin.end();
    }
  });
  child.stderr.on('data', text => { stderr += text; });
  const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  assert.equal(exitCode, 0, stderr);
  assert.equal(index, 3, 'Answers should be sent only after each real prompt appears');
  assert.match(stdout, /بلخ 😀 افغانستان ''/);
  assert.equal(stderr, '');
});
