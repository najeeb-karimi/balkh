const { spawn } = require('node:child_process');
const path = require('node:path');

function createOutputRunner(vscode, spawnProcess = spawn) {
  let channel;
  let current;
  let disposed = false;
  const running = (value) => vscode.commands.executeCommand('setContext', 'balkh.running', value);
  return {
    run({ python, args, cwd, env }) {
      if (disposed) return;
      if (current) {
        vscode.window.showInformationMessage('A Balkh program is already running. Use Balkh: Stop Running Program first.');
        return;
      }
      channel ||= vscode.window.createOutputChannel('Balkh');
      channel.clear();
      channel.show(true);
      channel.appendLine(`[Running] ${path.basename(args.at(-1))}`);
      let resolve;
      const finished = new Promise((done) => { resolve = done; });
      let settled = false;
      let child;
      let stopped = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        current = undefined;
        running(false);
        resolve(result);
      };
      const failed = (error) => {
        if (!disposed) channel.appendLine(`\n[Error] ${error.message}\nCheck balkh.pythonPath and install Balkh in that Python environment.`);
        finish({ exitCode: null, error: error.message });
      };
      try {
        child = spawnProcess(python, args, {
          cwd, env: { ...process.env, ...env },
          shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        });
        current = { terminate: () => { if (!settled) { stopped = true; child.kill(); } } };
        running(true);
        for (const stream of [child.stdout, child.stderr]) {
          stream.setEncoding('utf8');
          stream.on('data', (text) => { if (!disposed) channel.append(text); });
        }
        child.once('error', failed);
        child.once('close', (exitCode, signal) => {
          if (settled) return;
          if (!disposed) channel.appendLine(stopped ? '\n[Stopped]' : `\n[Done] ${signal ? `terminated by ${signal}` : `exited with code ${exitCode}`}`);
          finish({ exitCode, signal, stopped });
        });
      } catch (error) { failed(error); }
      return {
        finished,
        terminate() { if (!settled && child) { stopped = true; child.kill(); } },
      };
    },
    stop() { current?.terminate(); },
    dispose() { disposed = true; current?.terminate(); channel?.dispose(); },
  };
}

module.exports = { createOutputRunner };
