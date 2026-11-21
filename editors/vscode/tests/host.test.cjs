const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hostFixture } = require('./host-fixture.cjs');

test('webview uses local bundled assets and keeps source out of HTML', async () => {
  const source = '</script><script>alert("untrusted source")</script>';
  const host = await hostFixture(source);
  const html = host.panel.webview.html;
  assert.ok(!html.includes(source));
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(!html.includes("'unsafe-eval'"));
  assert.match(html, /data-wasm="http:\/\/127.0.0.1:8777\/dist\/onig.wasm"/);
  await host.receive({ type: 'ready' });
  assert.equal(host.sent[0].type, 'init');
  assert.equal(host.sent[0].text, source);
});

test('edits update the VS Code document, acknowledge versions, and save', async () => {
  const host = await hostFixture();
  await host.receive({ type: 'edit', version: 1, id: 1, text: 'چاپ("دنیا")\r\n' });
  assert.equal(host.document.text, 'چاپ("دنیا")\r\n');
  assert.equal(host.sent.length, 1, 'own changes are not echoed as external changes');
  assert.equal(host.sent[0].type, 'ack');
  assert.equal(host.sent[0].version, 2);
  await host.receive({ type: 'save' });
  assert.equal(host.document.saves, 1);
});

test('stale edits cannot overwrite externally changed documents', async () => {
  const host = await hostFixture();
  host.external('external');
  await host.receive({ type: 'edit', version: 1, id: 1, text: 'stale' });
  assert.equal(host.document.text, 'external');
  assert.equal(host.sent.at(-1).type, 'conflict');
  assert.equal(host.sent.at(-1).text, 'external');
});

test('webview command dispatch does not expose arbitrary VS Code commands', async () => {
  const host = await hostFixture();
  await host.receive({ type: 'command', command: 'undo' });
  await host.receive({ type: 'command', command: 'redo' });
  await host.receive({ type: 'command', command: 'arbitrary.command' });
  await host.receive({ type: 'reopen' });
  assert.deepEqual(host.commands.map((args) => args[0]), ['undo', 'redo', 'vscode.openWith']);
  assert.equal(host.commands.at(-1)[2], 'default');
});

test('settings update and panel disposal releases document listeners', async () => {
  const host = await hostFixture();
  host.settings();
  assert.equal(host.sent.at(-1).type, 'options');
  const count = host.sent.length;
  host.dispose();
  host.external('after disposal');
  assert.equal(host.sent.length, count);
});

test('RTL Run button saves the current document and launches a task', async () => {
  const host = await hostFixture();
  await host.receive({ type: 'run' });
  assert.equal(host.document.saves, 1);
  assert.equal(host.tasks.length, 1);
  assert.equal(host.tasks[0].execution.args.at(-1), host.document.uri.fsPath);
});

test('editor title and palette Run wait for pending RTL edits before saving', async () => {
  const host = await hostFixture();
  const run = host.runCommand();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(host.sent.length, 0, 'flush must wait until the webview is ready');
  await host.receive({ type: 'ready' });
  const request = host.sent.at(-1);
  assert.equal(request.type, 'flush');
  assert.equal(host.tasks.length, 0);
  await host.receive({ type: 'edit', version: 1, id: 1, text: 'چاپ("new")' });
  await host.receive({ type: 'flushed', id: request.id });
  await run;
  assert.equal(host.document.text, 'چاپ("new")');
  assert.equal(host.tasks.length, 1);
});

test('closing an RTL editor while it is flushing cancels Run', async () => {
  const host = await hostFixture();
  const run = host.runCommand();
  await new Promise((resolve) => setImmediate(resolve));
  host.dispose();
  await run;
  assert.equal(host.tasks.length, 0);
  assert.match(host.errors[0], /synchronize/);
});
