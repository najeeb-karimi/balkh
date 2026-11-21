const vscode = require('vscode');
const { randomBytes } = require('node:crypto');
const { replacement } = require('./sync.cjs');
const { runDocument } = require('./runner.cjs');
const { createOutputRunner } = require('./output-runner.cjs');

function activate(context) {
  const editors = new Map();
  const output = createOutputRunner(vscode);
  context.subscriptions.push(output, vscode.commands.registerCommand('balkh.stopRun', () => output.stop()));
  context.subscriptions.push(vscode.commands.registerCommand('balkh.runFile', async (uri) => {
    try {
      uri ||= vscode.window.tabGroups.activeTabGroup.activeTab?.input?.uri || vscode.window.activeTextEditor?.document.uri;
      const document = uri ? await vscode.workspace.openTextDocument(uri) : null;
      const editor = document && editors.get(document.uri.toString());
      if (editor && !await editor.flush()) {
        vscode.window.showErrorMessage('Balkh could not synchronize the RTL editor. Resolve any pending changes or conflicts before running.');
        return;
      }
      return await runDocument(vscode, document, process.platform, output);
    } catch (error) { vscode.window.showErrorMessage(`Could not run Balkh: ${error.message}`); }
  }));
  context.subscriptions.push(vscode.window.registerCustomEditorProvider('balkh.rtlEditor', {
    async resolveCustomTextEditor(document, panel) {
      const webview = panel.webview;
      const assets = vscode.Uri.joinPath(context.extensionUri, 'dist');
      webview.options = { enableScripts: true, localResourceRoots: [assets] };
      const uri = (name) => webview.asWebviewUri(vscode.Uri.joinPath(assets, name)).toString();
      const nonce = randomBytes(18).toString('base64');
      let applying = false;
      let disposed = false;
      let queue = Promise.resolve();
      let ready = false;
      let flushId = 0;
      const flushes = new Map();
      const editor = {
        flush: () => new Promise((resolve) => {
          const id = ++flushId;
          const finish = (success) => { clearTimeout(timer); flushes.delete(id); resolve(success); };
          const timer = setTimeout(() => finish(false), 10000);
          flushes.set(id, finish);
          if (ready) webview.postMessage({ type: 'flush', id });
        }),
      };
      editors.set(document.uri.toString(), editor);
      const snapshot = (type, extra = {}) => {
        if (!disposed) webview.postMessage({ type, text: document.getText(), version: document.version, ...extra });
      };
      const options = () => {
        const config = vscode.workspace.getConfiguration('editor', document);
        return {
          fontFamily: config.get('fontFamily'), fontSize: config.get('fontSize'),
          tabSize: config.get('tabSize'), insertSpaces: config.get('insertSpaces'),
          wordWrap: config.get('wordWrap'), renderWhitespace: config.get('renderWhitespace'),
          readOnly: vscode.workspace.fs.isWritableFileSystem(document.uri.scheme) === false,
        };
      };
      const receive = webview.onDidReceiveMessage((message) => {
        queue = queue.then(async () => {
          if (disposed || !message || typeof message !== 'object') return;
          if (message.type === 'ready') {
            ready = true;
            snapshot('init', { options: options() });
            for (const id of flushes.keys()) webview.postMessage({ type: 'flush', id });
          }
          else if (message.type === 'edit' && typeof message.text === 'string' && Number.isInteger(message.id)) {
            if (message.version !== document.version) return snapshot('conflict');
            const change = replacement(document.getText(), message.text);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, new vscode.Range(document.positionAt(change.start), document.positionAt(change.end)), change.text);
            applying = true;
            let accepted;
            try { accepted = await vscode.workspace.applyEdit(edit); }
            finally { applying = false; }
            snapshot(accepted ? 'ack' : 'conflict', { id: message.id });
          } else if (message.type === 'save') await document.save();
          else if (message.type === 'flushed') flushes.get(message.id)?.(true);
          else if (message.type === 'run') await runDocument(vscode, document, process.platform, output);
          else if (message.type === 'command' && ['undo', 'redo'].includes(message.command)) {
            await vscode.commands.executeCommand(message.command);
          } else if (message.type === 'reopen') {
            await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
          }
        }).catch((error) => {
          snapshot('conflict');
          vscode.window.showErrorMessage(`Balkh RTL Editor: ${error.message}`);
        });
      });
      const changes = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === document.uri.toString() && event.contentChanges.length && !applying) snapshot('update');
      });
      const settings = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('editor', document)) webview.postMessage({ type: 'options', options: options() });
      });
      panel.onDidDispose(() => {
        disposed = true;
        editors.delete(document.uri.toString());
        for (const finish of flushes.values()) finish(false);
        flushes.clear();
        receive.dispose(); changes.dispose(); settings.dispose();
      });
      webview.html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}' 'wasm-unsafe-eval'; connect-src ${webview.cspSource}; worker-src blob:;">
<link rel="stylesheet" href="${uri('editor.css')}">
<link rel="stylesheet" href="${uri('webview.css')}">
<title>Balkh RTL Editor</title></head><body>
<header><span>Balkh · RTL</span><button id="run" type="button">Run Balkh File</button><button id="direction" type="button">Switch to LTR</button><button id="standard" type="button">Open Standard Editor</button><span id="status" role="status">Loading editor…</span></header>
<section id="conflict" hidden role="alert">The file changed elsewhere. Choose which changes to use.
<button id="keep-local" type="button">Use My Edits</button><button id="use-file" type="button">Use File Changes</button></section>
<main id="editor" aria-label="Balkh source editor"></main>
<script nonce="${nonce}" src="${uri('editor.js')}" data-worker="${uri('worker.js')}" data-wasm="${uri('onig.wasm')}"></script>
</body></html>`;
    },
  }, { supportsMultipleEditorsPerDocument: false, webviewOptions: { retainContextWhenHidden: true } }));
}

module.exports = { activate };
