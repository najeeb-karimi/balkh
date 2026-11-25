const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vscode = require('vscode');
const { createOutputRunner } = require('../output-runner.cjs');
const { runDocument } = require('../runner.cjs');

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
    await vscode.commands.executeCommand('balkh.output.focus');

    // Use real native input boxes and VS Code's own accept/cancel commands.
    // The wrapper only observes the boxes so this isolated test can type answers.
    const answers = ['زرغونه 😀', ''];
    const expectedPrompts = ['نام: ', 'تش: '];
    let boxes = 0;
    let cancel = false;
    let inputError;
    const timers = new Set();
    const interactive = createOutputRunner({ commands: vscode.commands, ThemeIcon: vscode.ThemeIcon, window: {
      createOutputChannel: (...args) => vscode.window.createOutputChannel(...args),
      showInformationMessage: (...args) => vscode.window.showInformationMessage(...args),
      createInputBox() {
        const box = vscode.window.createInputBox();
        const index = boxes++;
        const timer = setTimeout(async () => {
          timers.delete(timer);
          try {
            if (cancel) await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
            else {
              assert.equal(box.prompt, expectedPrompts[index]);
              box.value = answers[index];
              await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
            }
          } catch (error) { inputError = error; interactive.stop(); }
        }, 250);
        timers.add(timer);
        return box;
      },
    } });
    const replace = async text => {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text);
      assert.ok(await vscode.workspace.applyEdit(edit));
    };
    let watchdog;
    try {
      watchdog = setTimeout(() => { inputError = new Error('Native input integration timed out'); interactive.stop(); }, 30000);
      await replace('name = ورودی("نام: ")\nempty = ننوت("تش: ")\nfrom pathlib import Path\nPath(__file__).with_suffix(".input").write_text(repr((name, empty)), encoding="utf-8")\n');
      const native = await runDocument(vscode, document, process.platform, interactive);
      assert.equal((await native.finished).exitCode, 0, inputError?.stack);
      if (inputError) throw inputError;
      assert.equal(boxes, 2);
      assert.equal(await fs.readFile(uri.fsPath.replace(/\.blk$/, '.input'), 'utf8'), "('زرغونه 😀', '')");
      cancel = true;
      await replace('input("Cancel this prompt: ")\n');
      const cancellable = await runDocument(vscode, document, process.platform, interactive);
      assert.equal((await cancellable.finished).stopped, true, 'Escape must stop a pending native input request');
      if (inputError) throw inputError;
    } finally {
      clearTimeout(watchdog);
      for (const timer of timers) clearTimeout(timer);
      interactive.dispose();
      await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
      await replace(program);
    }
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
    const standardEditor = vscode.window.activeTextEditor;
    assert.equal(standardEditor.document.uri.toString(), uri.toString());
    for (const header of ['def greet():', 'تابع سلام():', 'فنکشن سلام():', 'ترڅو سم:', 'match value:', 'except* ValueError:']) {
      await replace(header);
      const end = document.positionAt(header.length);
      standardEditor.selection = new vscode.Selection(end, end);
      await vscode.commands.executeCommand('type', { text: '\n' });
      assert.equal(document.getText().replace(/\r\n/g, '\n'), `${header}\n    `, header);
    }
    assert.ok(await document.save());
    await fs.writeFile(path.join(testRoot, 'result.json'), JSON.stringify({ passed: true, vscode: vscode.version, run: 'Output and terminal exited 0; native input accepted Unicode and empty answers; cancellation and Stop terminated pending execution' }));
  } catch (error) {
    await fs.writeFile(path.join(testRoot, 'result.json'), JSON.stringify({ passed: false, error: error.stack }));
    throw error;
  } finally {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  }
}
module.exports = { run };
