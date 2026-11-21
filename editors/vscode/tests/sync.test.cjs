const { test } = require('node:test');
const assert = require('node:assert/strict');
const { replacement, SyncState } = require('../sync.cjs');

test('minimal replacements round-trip Unicode, CRLF, insertions, and deletions', () => {
  const values = ['', 'سلام', 'چاپ("سلام")\r\n', '\r\n', '\n', 'a😀b', 'a😁b', '😀', 'a\rb', '\r', 'x\r\ny', 'x\rZ\ny'];
  for (const before of values) for (const after of values) {
    const edit = replacement(before, after);
    assert.equal(before.slice(0, edit.start) + edit.text + before.slice(edit.end), after);
    assert.ok(!/[\uDC00-\uDFFF]/.test(before[edit.start] || ''), 'start splits a surrogate pair');
    assert.ok(!/[\uDC00-\uDFFF]/.test(before[edit.end] || ''), 'end splits a surrogate pair');
    assert.ok(!(before[edit.start - 1] === '\r' && before[edit.start] === '\n'), 'start splits CRLF');
    assert.ok(!(before[edit.end - 1] === '\r' && before[edit.end] === '\n'), 'end splits CRLF');
  }
});

test('rapid edits are queued and save waits for the final acknowledgement', () => {
  const sent = [];
  const state = new SyncState((message) => sent.push(message));
  state.initialize('سلام', 1);
  state.change('سلام!');
  state.change('سلام!!');
  state.save();
  assert.equal(sent.length, 1);
  state.receive({ type: 'ack', id: sent[0].id, text: 'سلام!', version: 2 });
  assert.equal(sent.length, 2);
  assert.equal(sent[1].text, 'سلام!!');
  assert.equal(sent[1].version, 2);
  state.receive({ type: 'ack', id: sent[1].id, text: 'سلام!!', version: 3 });
  assert.deepEqual(sent[2], { type: 'save' });
  assert.equal(state.base, state.local);
});

test('external updates preserve pending edits until the user resolves a conflict', () => {
  for (const keepLocal of [true, false]) {
    const sent = [];
    const state = new SyncState((message) => sent.push(message));
    state.initialize('original', 1);
    state.change('my edits');
    state.receive({ type: 'conflict', text: 'external edits', version: 3 });
    state.receive({ type: 'ack', id: 1, text: 'stale acknowledgement', version: 2 });
    assert.equal(state.local, 'my edits');
    assert.equal(state.base, 'external edits');
    assert.equal(state.conflict, true);
    state.resolve(keepLocal);
    assert.equal(state.conflict, false);
    assert.equal(state.local, keepLocal ? 'my edits' : 'external edits');
    assert.equal(sent.length, keepLocal ? 2 : 1);
    if (keepLocal) assert.equal(sent[1].version, 3);
  }
});

test('undo and clean external updates replace the local state without echoing edits', () => {
  const state = new SyncState(() => assert.fail('external change echoed'));
  state.initialize('before', 1);
  state.receive({ type: 'update', text: 'after', version: 2 });
  assert.equal(state.local, 'after');
  assert.equal(state.version, 2);
  state.receive({ type: 'update', text: 'before', version: 3 });
  assert.equal(state.local, 'before');
});

test('unexpected acknowledged content preserves local edits as a conflict', () => {
  const state = new SyncState(() => {});
  state.initialize('before', 1);
  state.change('my edit');
  state.receive({ type: 'ack', id: 1, text: 'concurrent edit', version: 3 });
  assert.equal(state.conflict, true);
  assert.equal(state.local, 'my edit');
});
