const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { build } = require('./build.cjs');
const { createServer } = require('./serve.cjs');

const root = path.resolve(__dirname, '..');
const repo = path.resolve(root, '..');
const slots = ['a', 'b'].map(name => path.join(root, '.dev', name, 'dist'));
const client = `(() => {
  const version = new URL(document.currentScript.src).searchParams.get('version');
  let events;
  function connect() {
    events = new EventSource('/balkh/__dev/events');
    events.addEventListener('build', event => {
      if (String(JSON.parse(event.data).version) !== version) {
        events.close();
        location.reload();
      }
    });
  }
  connect();
  addEventListener('pagehide', () => events.close());
  addEventListener('pageshow', event => { if (event.persisted) connect(); });
})();`;

async function startDev({ port = Number(process.env.PORT || 4173) } = {}) {
  let current = null;
  let version = 0;
  const session = randomUUID();
  const revision = () => `${session}:${version}`;
  let building = false;
  let pending = false;
  let closed = false;
  let timer;
  const clients = new Set();
  const watchers = [];
  const sendVersion = response => response.write(`event: build\ndata: ${JSON.stringify({ version: revision() })}\n\n`);
  const server = createServer({
    getRoot: () => current,
    transformHtml: html => html.replace('</body>', `<script src="/balkh/__dev/client.js?version=${encodeURIComponent(revision())}" defer></script>\n</body>`),
    handleRequest(req, res, url) {
      if (url.pathname === '/balkh/__dev/client.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(client);
        return true;
      }
      if (url.pathname === '/balkh/__dev/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        sendVersion(res);
        clients.add(res);
        res.on('close', () => clients.delete(res));
        return true;
      }
      return false;
    },
  });

  async function rebuild() {
    if (closed || building) return;
    building = true;
    pending = false;
    // A failed build only touches the inactive slot; readers keep the last good one.
    const outdir = current === slots[0] ? slots[1] : slots[0];
    try {
      await build({ outdir });
      if (closed) return;
      current = outdir;
      version += 1;
      console.log(`Playground build ${version} ready.`);
      for (const response of clients) sendVersion(response);
    } catch (error) {
      console.error('Playground build failed; waiting for another source change.', error);
    } finally {
      building = false;
      if (pending && !closed) schedule();
    }
  }

  function schedule() {
    if (closed) return;
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => { void rebuild(); }, 120);
  }

  function watch(directory, matches, recursive = false) {
    const watcher = fs.watch(directory, { recursive }, (_event, filename) => {
      if (filename === null || matches(String(filename).split(path.sep).join('/'))) schedule();
    });
    watcher.on('error', error => console.error(`Source watcher failed for ${directory}; restart npm run dev.`, error));
    watchers.push(watcher);
  }

  async function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
    for (const response of clients) response.end();
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    server.closeAllConnections();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }

  function shutdown() { void close(); }

  try {
    watch(root, name => ['app.js', 'editor.js', 'scrollbars.js', 'i18n.js', 'index.html', 'style.css', 'worker.js', 'runner.py'].includes(name));
    watch(path.join(root, 'assets/fonts/vazirmatn'), name => name.endsWith('.woff2') || ['OFL.txt', 'AUTHORS.txt'].includes(name));
    watch(path.join(repo, 'balkh'), name => !name.split('/').some(part => ['__pycache__', 'tests', 'node_modules', '.dev', 'dist'].includes(part)) && name.endsWith('.py'), true);
    watch(path.join(repo, 'examples'), name => name.endsWith('.blk'));
    watch(repo, name => name === 'LICENSE');
    watch(path.join(repo, 'editors/vscode'), name => name === 'language-configuration.json');
    watch(path.join(repo, 'editors/vscode/syntaxes'), name => name === 'balkh.tmLanguage.json');
    watch(path.join(repo, 'editors/vscode/src'), name => name === 'tokens.cjs');
    const scriptWatcher = fs.watch(__dirname, (_event, filename) => {
      if (filename === null || ['build.cjs', 'serve.cjs', 'dev.cjs'].includes(String(filename))) console.log('Development scripts changed; restart npm run dev to apply them.');
    });
    scriptWatcher.on('error', error => console.error('Development script watcher failed; restart npm run dev.', error));
    watchers.push(scriptWatcher);
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    await rebuild();
    if (closed) return { close, server };
    if (!current) throw new Error('Initial build failed. Fix the source and start npm run dev again.');
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    console.log(`Balkh playground dev: http://127.0.0.1:${server.address().port}/balkh/`);
    return { close, server };
  } catch (error) {
    await close();
    throw error;
  }
}

module.exports = { startDev };

if (require.main === module) startDev().catch(error => { console.error(error); process.exitCode = 1; });
