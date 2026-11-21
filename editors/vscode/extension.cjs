const vscode = require('vscode');
const { randomBytes } = require('node:crypto');
const { replacement } = require('./sync.cjs');

function activate(context) {
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
          if (message.type === 'ready') snapshot('init', { options: options() });
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
        receive.dispose(); changes.dispose(); settings.dispose();
      });
      webview.html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}' 'wasm-unsafe-eval'; connect-src ${webview.cspSource}; worker-src blob:;">
<link rel="stylesheet" href="${uri('editor.css')}">
<link rel="stylesheet" href="${uri('webview.css')}">
<title>Balkh RTL Editor</title></head><body>
<header><span>Balkh · RTL</span><button id="direction" type="button">Switch to LTR</button><button id="standard" type="button">Open Standard Editor</button><span id="status" role="status">Loading editor…</span></header>
<section id="conflict" hidden role="alert">The file changed elsewhere. Choose which changes to use.
<button id="keep-local" type="button">Use My Edits</button><button id="use-file" type="button">Use File Changes</button></section>
<main id="editor" aria-label="Balkh source editor"></main>
<script nonce="${nonce}" src="${uri('editor.js')}" data-worker="${uri('worker.js')}" data-wasm="${uri('onig.wasm')}"></script>
</body></html>`;
    },
  }, { supportsMultipleEditorsPerDocument: false, webviewOptions: { retainContextWhenHidden: true } }));
}

module.exports = { activate };
