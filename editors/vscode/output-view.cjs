const { randomBytes } = require('node:crypto');

const LIMIT = 1_000_000;

function createOutputView(vscode, context) {
  let view;
  let ready = false;
  let disposed = false;
  let transcript = '';
  let truncated = false;
  let pending = '';
  let removed = 0;
  let reset = true;
  let timer;
  let active = false;
  let direction = context.workspaceState.get('outputDirection', 'rtl') === 'ltr' ? 'ltr' : 'rtl';
  let native;
  const mirror = () => native ||= vscode.window.createOutputChannel('Balkh');
  const send = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!ready || disposed) return;
    view.webview.postMessage({
      type: reset ? 'snapshot' : 'append', text: reset ? transcript : pending,
      trim: reset ? 0 : removed, truncated, running: active, direction,
    });
    pending = ''; removed = 0; reset = false;
  };
  const schedule = () => { if (ready && !timer) timer = setTimeout(send, 40); };
  const append = text => {
    if (disposed || !text) return;
    mirror().append(text);
    transcript += text;
    if (transcript.length > LIMIT) {
      let cut = transcript.length - LIMIT;
      // Never start the retained transcript halfway through a Unicode character.
      if (/[\uDC00-\uDFFF]/.test(transcript[cut])) cut++;
      transcript = transcript.slice(cut);
      removed += cut;
      truncated = true;
    }
    if (!reset) {
      pending += text;
      if (pending.length > LIMIT) { reset = true; pending = ''; }
    }
    schedule();
  };
  const registration = vscode.window.registerWebviewViewProvider('balkh.output', {
    resolveWebviewView(resolved) {
      view = resolved;
      ready = false;
      reset = true;
      pending = ''; removed = 0;
      const assets = vscode.Uri.joinPath(context.extensionUri, 'dist');
      const uri = name => view.webview.asWebviewUri(vscode.Uri.joinPath(assets, name)).toString();
      view.webview.options = { enableScripts: true, localResourceRoots: [assets] };
      const receive = view.webview.onDidReceiveMessage(message => {
        if (disposed || view !== resolved || !message || typeof message !== 'object') return;
        if (message.type === 'ready') { ready = true; reset = true; send(); }
        else if (message.type === 'direction' && ['rtl', 'ltr'].includes(message.value)) {
          direction = message.value;
          void context.workspaceState.update('outputDirection', direction);
          schedule();
        } else if (message.type === 'clear') output.clear();
        else if (message.type === 'copy') void vscode.env.clipboard.writeText(transcript);
        else if (message.type === 'stop') void vscode.commands.executeCommand('balkh.stopRun');
      });
      resolved.onDidDispose(() => {
        receive.dispose();
        if (view === resolved) { view = undefined; ready = false; }
      });
      const nonce = randomBytes(18).toString('base64');
      view.webview.html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${uri('output.css')}"><title>Balkh Output</title></head>
<body><header aria-label="Output controls">
<button id="direction" type="button" aria-label="Switch to LTR">RTL</button>
<button id="copy" type="button">Copy</button><button id="clear" type="button">Clear</button>
<button id="stop" type="button" disabled>Stop</button>
<span id="notice" role="status" hidden>Earlier output omitted. Full transcript: Output → Balkh.</span>
</header><main id="scroll" dir="rtl" tabindex="0" aria-label="Balkh program output">
<p id="empty">Run a Balkh file to see its output.</p><pre id="output" role="log" aria-live="polite" aria-relevant="additions text"></pre>
</main><script nonce="${nonce}" src="${uri('output.js')}"></script></body></html>`;
    },
  });
  const output = {
    append,
    appendLine(text) { append(text + '\n'); },
    clear() {
      if (disposed) return;
      mirror().clear();
      transcript = ''; truncated = false; pending = ''; removed = 0; reset = true;
      schedule();
    },
    show(preserveFocus = true) {
      if (disposed) return;
      if (view) view.show(preserveFocus);
      else void Promise.resolve(vscode.commands.executeCommand('balkh.output.focus', { preserveFocus }))
        .catch(() => { if (!disposed) mirror().show(preserveFocus); });
    },
    setRunning(value) { if (!disposed) { active = value; schedule(); } },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      registration.dispose(); native?.dispose();
    },
  };
  return output;
}

module.exports = { createOutputView, LIMIT };
