// Control records share stdout with the program. Keep normal text streaming,
// including incomplete lines and split UTF-8, while buffering only a frame.
function createInputParser(token, text, request) {
  const prefix = `\x1eBALKH_INPUT:${token}:`;
  let pending = '';
  return {
    push(chunk) {
      pending += chunk;
      while (pending) {
        const start = pending.indexOf(prefix);
        if (start === -1) {
          let keep = Math.min(pending.length, prefix.length - 1);
          while (keep && !prefix.startsWith(pending.slice(-keep))) keep--;
          text(pending.slice(0, pending.length - keep));
          pending = pending.slice(pending.length - keep);
          return;
        }
        if (start) { text(pending.slice(0, start)); pending = pending.slice(start); }
        const end = pending.indexOf('\x1f', prefix.length);
        if (end === -1 && pending.length <= 8192) return;
        if (end === -1) {
          text(pending.slice(0, prefix.length));
          pending = pending.slice(prefix.length);
          continue;
        }
        const record = pending.slice(0, end + 1);
        let message;
        if (record.length <= 8192) {
          try { message = JSON.parse(pending.slice(prefix.length, end)); } catch { /* Normal program text. */ }
        }
        pending = pending.slice(end + 1);
        if (message?.type === 'input' && Number.isSafeInteger(message.id) && message.id > 0 &&
            typeof message.prompt === 'string' && message.prompt.length <= 1024) request(message);
        else text(record);
      }
    },
    flush() {
      // A process stopped during a control write must not expose a partial frame.
      if (!pending.startsWith(prefix)) text(pending);
      pending = '';
    },
  };
}

module.exports = { createInputParser };
