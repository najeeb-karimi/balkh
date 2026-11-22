const path = require('node:path');
const { createOutputRunner } = require('./output-runner.cjs');

async function runDocument(vscode, document, platform = process.platform, output = createOutputRunner(vscode)) {
  if (!vscode.workspace.isTrusted) {
    vscode.window.showErrorMessage('Trust this workspace before running Balkh programs.');
    return;
  }
  if (!document || document.isUntitled || !document.uri.path.endsWith('.blk')) {
    vscode.window.showErrorMessage('Open or save a .blk file before running a Balkh program.');
    return;
  }
  if (!['file', 'vscode-remote'].includes(document.uri.scheme)) {
    vscode.window.showErrorMessage('Run Balkh File requires a file on the local or remote workspace filesystem.');
    return;
  }
  if (!await document.save()) {
    vscode.window.showErrorMessage('The Balkh file could not be saved. Resolve the save issue before running it.');
    return;
  }
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  const cwd = folder?.uri.fsPath || path.dirname(document.uri.fsPath);
  const config = vscode.workspace.getConfiguration('balkh', document);
  let python = config.get('pythonPath', '').trim();
  if (!python && folder) {
    for (const name of ['.venv', 'venv']) {
      const candidate = vscode.Uri.joinPath(folder.uri, name, platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
      try {
        const stat = await vscode.workspace.fs.stat(candidate);
        if (stat.type & vscode.FileType.File) { python = candidate.fsPath; break; }
      } catch { /* Try the next environment, then PATH. */ }
    }
  }
  python ||= platform === 'win32' ? 'python' : 'python3';
  const args = ['-u', '-m', 'balkh.cli', document.uri.fsPath];
  const options = { cwd, env: { PYTHONIOENCODING: 'utf-8' } };
  if (!config.get('runInTerminal', false)) {
    return output.run({ python, args: ['-u', path.join(__dirname, 'input_bridge.py'), document.uri.fsPath], ...options });
  }
  const execution = new vscode.ProcessExecution(python, args, options);
  const task = new vscode.Task({ type: 'balkh', file: document.uri.toString() },
    folder || vscode.TaskScope.Global, `Run ${path.basename(document.uri.fsPath)}`, 'Balkh', execution, []);
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always, panel: vscode.TaskPanelKind.Shared, focus: true,
    showReuseMessage: false, clear: true,
  };
  return vscode.tasks.executeTask(task);
}

module.exports = { runDocument };
