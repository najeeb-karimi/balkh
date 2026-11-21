// A single replacement preserves unchanged text and uses VS Code/Monaco UTF-16 offsets.
function replacement(before, after) {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  // Never split surrogate pairs or CRLF line endings.
  if (start && (/[\uDC00-\uDFFF]/.test(before[start] || after[start] || '') ||
      (before[start - 1] === '\r' && before[start] === '\n'))) start--;
  let end = before.length;
  let nextEnd = after.length;
  while (end > start && nextEnd > start && before[end - 1] === after[nextEnd - 1]) {
    end--;
    nextEnd--;
  }
  if (end < before.length && (/[\uDC00-\uDFFF]/.test(before[end]) ||
      (before[end - 1] === '\r' && before[end] === '\n'))) {
    end++;
    nextEnd++;
  }
  return { start, end, text: after.slice(start, nextEnd) };
}

// Only one edit is in flight. New keystrokes stay local until the host acknowledges it.
class SyncState {
  constructor(send) {
    this.send = send;
    this.base = '';
    this.local = '';
    this.version = 0;
    this.pending = null;
    this.sequence = 0;
    this.conflict = false;
    this.saveRequested = false;
  }
  initialize(text, version) {
    this.base = this.local = text;
    this.version = version;
  }
  change(text) { this.local = text; this.flush(); }
  flush() {
    if (this.pending || this.conflict) return;
    if (this.local !== this.base) {
      this.pending = { id: ++this.sequence, text: this.local };
      this.send({ type: 'edit', id: this.pending.id, version: this.version, text: this.local });
    } else if (this.saveRequested) {
      this.saveRequested = false;
      this.send({ type: 'save' });
    }
  }
  receive(message) {
    if (message.type === 'ack' && this.pending?.id === message.id) {
      const sent = this.pending.text;
      this.pending = null;
      this.base = message.text;
      this.version = message.version;
      if (this.base !== sent) this.conflict = true;
      this.flush();
    } else if (message.type === 'update' || message.type === 'conflict') {
      const dirty = this.pending || this.local !== this.base;
      this.base = message.text;
      this.version = message.version;
      this.pending = null;
      if (dirty && this.local !== this.base) this.conflict = true;
      else this.local = this.base;
    }
  }
  resolve(keepLocal) {
    if (!keepLocal) this.local = this.base;
    this.conflict = false;
    this.flush();
  }
  save() { this.saveRequested = true; this.flush(); }
}

module.exports = { replacement, SyncState };
