const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const shared = { bundle: true, minify: true, target: 'chrome132', logLevel: 'info', legalComments: 'eof', loader: { '.ttf': 'file' } };
Promise.all([
  esbuild.build({ ...shared, entryPoints: [path.join(root, 'src/editor.js')], outfile: path.join(dist, 'editor.js'), format: 'iife' }),
  esbuild.build({ ...shared, entryPoints: [path.join(root, 'node_modules/monaco-editor/esm/vs/editor/editor.worker.js')], outfile: path.join(dist, 'worker.js'), format: 'iife' }),
]).then(() => {
  fs.copyFileSync(path.resolve(root, '../../assets/balkh-logo.png'), path.join(dist, 'balkh-logo.png'));
  fs.copyFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'), path.join(dist, 'onig.wasm'));
  fs.copyFileSync(path.join(root, 'src/webview.css'), path.join(dist, 'webview.css'));
  for (const name of ['output.js', 'output.css']) fs.copyFileSync(path.join(root, 'src', name), path.join(dist, name));
  const licenses = ['monaco-editor/LICENSE', 'monaco-editor/ThirdPartyNotices.txt', 'vscode-textmate/LICENSE.md', 'vscode-oniguruma/LICENSE.txt', 'vscode-oniguruma/NOTICES.txt', 'dompurify/LICENSE'];
  fs.writeFileSync(path.join(dist, 'THIRD-PARTY-LICENSES.txt'), licenses.map((name) => {
    return `${name}\n${fs.readFileSync(path.join(root, 'node_modules', name), 'utf8')}`;
  }).join('\n\n'));
}).catch((error) => { console.error(error); process.exitCode = 1; });
