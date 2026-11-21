const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const repo = path.resolve(root, '..');
const dist = path.join(root, 'dist');

async function build() {
  // Only generated assets live here; never copy the checkout or virtualenv.
  if (path.dirname(dist) !== root || path.basename(dist) !== 'dist') throw new Error('Invalid build output directory.');
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  const options = {
    bundle: true, minify: true, target: 'es2022', legalComments: 'eof',
    loader: { '.ttf': 'file' }, logLevel: 'info',
  };
  await Promise.all([
    esbuild.build({ ...options, entryPoints: [path.join(root, 'app.js')], outfile: path.join(dist, 'app.js'), format: 'iife' }),
    esbuild.build({ ...options, entryPoints: [require.resolve('monaco-editor/editor/editor.worker.js')], outfile: path.join(dist, 'editor.worker.js'), format: 'iife' }),
  ]);
  for (const name of ['index.html', 'style.css', 'worker.js', 'runner.py']) {
    fs.copyFileSync(path.join(root, name), path.join(dist, name));
  }
  fs.copyFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'), path.join(dist, 'onig.wasm'));

  // Bundle the actual interpreter sources, including optional localized modules.
  const files = [];
  function copyPython(directory, relative = '') {
    for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.posix.join(relative, item.name);
      if (item.isDirectory() && item.name !== '__pycache__') copyPython(path.join(directory, item.name), name);
      else if (item.isFile() && item.name.endsWith('.py')) {
        const target = path.join(dist, 'balkh', name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(directory, item.name), target);
        files.push(name);
      }
    }
  }
  copyPython(path.join(repo, 'balkh'));
  fs.writeFileSync(path.join(dist, 'balkh/manifest.json'), JSON.stringify(files));
  const names = { salam: 'Hello, Balkh · سلام بلخ', stdlib: 'Math & dates · ریاضی و زمان', bazi: 'Guessing game · بازی' };
  const examples = Object.entries(names).map(([id, name]) => ({
    id, name, source: fs.readFileSync(path.join(repo, 'examples', `${id}.blk`), 'utf8'),
  }));
  fs.writeFileSync(path.join(dist, 'examples.json'), JSON.stringify(examples));
  fs.copyFileSync(path.join(repo, 'LICENSE'), path.join(dist, 'LICENSE'));
  const licenses = ['monaco-editor/LICENSE', 'monaco-editor/ThirdPartyNotices.txt', 'vscode-textmate/LICENSE.md', 'vscode-oniguruma/LICENSE.txt', 'vscode-oniguruma/NOTICES.txt', 'dompurify/LICENSE'];
  fs.writeFileSync(path.join(dist, 'THIRD-PARTY-LICENSES.txt'), licenses.map((name) => `${name}\n${fs.readFileSync(path.join(root, 'node_modules', name), 'utf8')}`).join('\n\n'));
  fs.writeFileSync(path.join(dist, '.nojekyll'), '');
}

build().catch((error) => { console.error(error); process.exitCode = 1; });
