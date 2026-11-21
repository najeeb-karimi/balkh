const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vscode = require('vscode');

async function run() {
  const testRoot = path.resolve(__dirname, '../../../.venv/rtl-integration');
  await fs.mkdir(testRoot, { recursive: true });
  try {
    const uri = vscode.Uri.file(path.join(testRoot, 'editing.blk'));
    const source = 'تابع سلام():\r\n    چاپ("دنیا")\r\n';
    await vscode.workspace.fs.writeFile(uri, Buffer.from(source));
    const document = await vscode.workspace.openTextDocument(uri);
    assert.equal(document.languageId, 'balkh');
    await vscode.commands.executeCommand('vscode.openWith', uri, 'balkh.rtlEditor');
    assert.ok(vscode.extensions.getExtension('balkh.balkh-language').isActive);
    const edit = new vscode.WorkspaceEdit();
    const offset = document.getText().indexOf('دنیا');
    edit.replace(uri, new vscode.Range(document.positionAt(offset), document.positionAt(offset + 4)), 'بلخ');
    assert.ok(await vscode.workspace.applyEdit(edit));
    assert.equal(document.getText(), source.replace('دنیا', 'بلخ'));
    await vscode.commands.executeCommand('undo');
    assert.equal(document.getText(), source, 'custom editor undo did not reach the document');
    await vscode.commands.executeCommand('redo');
    assert.equal(document.getText(), source.replace('دنیا', 'بلخ'));
    assert.ok(await document.save());
    assert.equal(Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8'), document.getText());
    const marker = uri.fsPath.replace(/\.blk$/, '.ran');
    await fs.rm(marker, { force: true });
    const program = 'from pathlib import Path\nچاپ("سلام از Run")\nPath(__file__).with_suffix(".ran").write_text("saved-before-run", encoding="utf-8")\n';
    const pending = new vscode.WorkspaceEdit();
    pending.replace(uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), program);
    assert.ok(await vscode.workspace.applyEdit(pending));
    const output = await vscode.commands.executeCommand('balkh.runFile', uri);
    assert.ok(output?.finished, 'Run must default to the Output runner');
    assert.equal((await output.finished).exitCode, 0, 'Output run failed');
    assert.equal(await fs.readFile(marker, 'utf8'), 'saved-before-run');
    assert.equal(document.isDirty, false, 'Output run must save the current document');
    await fs.rm(marker, { force: true });
    const configuration = vscode.workspace.getConfiguration('balkh', uri);
    const previousTerminal = configuration.inspect('runInTerminal').globalValue;
    await configuration.update('runInTerminal', true, vscode.ConfigurationTarget.Global);
    let taskListener;
    let taskTimer;
    const ended = new Promise((resolve, reject) => {
      taskTimer = setTimeout(() => reject(new Error('Balkh run task did not finish')), 30000);
      taskListener = vscode.tasks.onDidEndTaskProcess((event) => {
        if (event.execution.task.source === 'Balkh') resolve(event.exitCode);
      });
    });
    try {
      const execution = await vscode.commands.executeCommand('balkh.runFile', uri);
      assert.ok(execution, 'Run did not create a task');
      assert.equal(await ended, 0, 'Balkh process failed');
      assert.equal(await fs.readFile(marker, 'utf8'), 'saved-before-run');
      assert.equal(document.isDirty, false, 'Run must save the current document');
    } finally {
      clearTimeout(taskTimer); taskListener.dispose();
      await configuration.update('runInTerminal', previousTerminal, vscode.ConfigurationTarget.Global);
    }
    const sleepy = new vscode.WorkspaceEdit();
    sleepy.insert(uri, document.positionAt(document.getText().length), '\nimport time\ntime.sleep(30)\n');
    assert.ok(await vscode.workspace.applyEdit(sleepy));
    const stoppable = await vscode.commands.executeCommand('balkh.runFile', uri);
    assert.ok(stoppable?.finished);
    await vscode.commands.executeCommand('balkh.stopRun');
    assert.equal((await stoppable.finished).stopped, true, 'Stop must terminate the Output process');
    await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
    assert.equal(vscode.window.activeTextEditor.document.uri.toString(), uri.toString());
    await fs.writeFile(path.join(testRoot, 'result.json'), JSON.stringify({ passed: true, vscode: vscode.version, run: 'Output and terminal exited 0; Output Stop terminated its process' }));
  } catch (error) {
    await fs.writeFile(path.join(testRoot, 'result.json'), JSON.stringify({ passed: false, error: error.stack }));
    throw error;
  } finally {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  }
}
module.exports = { run };
