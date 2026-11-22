const { spawn } = require('node:child_process');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { createInputParser } = require('./input-protocol.cjs');

function createOutputRunner(vscode, spawnProcess = spawn, createChannel = () => vscode.window.createOutputChannel('Balkh')) {
  let channel;
  let current;
  let disposed = false;
  const running = (value) => {
    channel?.setRunning?.(value);
    return vscode.commands.executeCommand('setContext', 'balkh.running', value);
  };
  return {
    run({ python, args, cwd, env }) {
      if (disposed) return;
      if (current) {
        vscode.window.showInformationMessage('A Balkh program is already running. Use Balkh: Stop Running Program first.');
        return;
      }
      channel ||= createChannel();
      channel.clear();
      channel.show(true);
      channel.appendLine(`[Running] ${path.basename(args.at(-1))}`);
      let resolve;
      const finished = new Promise((done) => { resolve = done; });
      let settled = false;
      let child;
      let stopped = false;
      let prompt;
      let lastRequest = 0;
      const closePrompt = () => {
        if (!prompt) return;
        const closing = prompt;
        prompt = undefined;
        for (const listener of closing.listeners) listener.dispose();
        closing.box.dispose();
      };
      const terminate = () => {
        if (settled) return;
        stopped = true;
        closePrompt();
        child?.kill();
      };
      const finish = (result) => {
        if (settled) return;
        settled = true;
        closePrompt();
        current = undefined;
        running(false);
        resolve(result);
      };
      const failed = (error) => {
        if (settled) return;
        if (!disposed) channel.appendLine(`\n[Error] ${error.message}\nCheck balkh.pythonPath and install Balkh in that Python environment.`);
        child?.kill();
        finish({ exitCode: null, error: error.message });
      };
      const requestInput = (request) => {
        if (disposed || settled || stopped || request.id <= lastRequest) return;
        if (prompt) { failed(new Error('The program requested input while another prompt was open.')); return; }
        lastRequest = request.id;
        try {
          const box = vscode.window.createInputBox();
          const end = { iconPath: new vscode.ThemeIcon('debug-disconnect'), tooltip: 'End input (EOF)' };
          const stop = { iconPath: new vscode.ThemeIcon('debug-stop'), tooltip: 'Stop running program' };
          const entry = { box, listeners: [] };
          prompt = entry;
          box.title = `Balkh · ${path.basename(args.at(-1))}`;
          box.prompt = request.prompt || 'Enter input for the running program.';
          box.placeholder = 'Type an answer, then press Enter';
          box.ignoreFocusOut = true;
          box.buttons = [end, stop];
          const respond = (value, eof) => {
            if (prompt !== entry || disposed || settled || stopped) return;
            if (/[\r\n]/.test(value)) { box.validationMessage = 'Enter one line at a time.'; return; }
            closePrompt();
            if (!eof) channel.append(value + '\n');
            child.stdin.write(JSON.stringify({ id: request.id, value, eof }) + '\n', 'utf8', (error) => {
              if (error && !settled && !stopped) failed(error);
            });
          };
          entry.listeners.push(
            box.onDidAccept(() => respond(box.value, false)),
            box.onDidHide(() => { if (prompt === entry) terminate(); }),
            box.onDidTriggerButton(button => { if (button === end) respond('', true); else if (button === stop) terminate(); }),
          );
          box.show();
        } catch (error) { failed(error); }
      };
      try {
        const token = randomBytes(24).toString('hex');
        const parser = createInputParser(token,
          text => { if (!disposed && !settled) channel.append(text); }, requestInput);
        child = spawnProcess(python, args, {
          cwd, env: { ...process.env, ...env, BALKH_INPUT_TOKEN: token },
          shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
        });
        current = { terminate };
        running(true);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', text => { if (!settled) parser.push(text); });
        child.stderr.on('data', text => { if (!disposed && !settled) channel.append(text); });
        child.stdin.on('error', error => { if (!settled && !stopped) failed(error); });
        child.once('error', failed);
        child.once('close', (exitCode, signal) => {
          if (settled) return;
          parser.flush();
          if (!disposed) channel.appendLine(stopped ? '\n[Stopped]' : `\n[Done] ${signal ? `terminated by ${signal}` : `exited with code ${exitCode}`}`);
          finish({ exitCode, signal, stopped });
        });
      } catch (error) { failed(error); }
      return {
        finished,
        terminate,
      };
    },
    stop() { current?.terminate(); },
    dispose() { disposed = true; current?.terminate(); channel?.dispose(); },
  };
}

module.exports = { createOutputRunner };
