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
    await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
    assert.equal(vscode.window.activeTextEditor.document.uri.toString(), uri.toString());
    await fs.writeFile(path.join(testRoot, 'result.json'), JSON.stringify({ passed: true, vscode: vscode.version }));
  } catch (error) {
    await fs.writeFile(path.join(testRoot, 'result.json'), JSON.stringify({ passed: false, error: error.stack }));
    throw error;
  } finally {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  }
}
module.exports = { run };
