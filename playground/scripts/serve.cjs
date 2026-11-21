const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.py': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.ttf': 'font/ttf' };
const port = Number(process.env.PORT || 4173);
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Run npm run build first.');
http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.writeHead(302, { Location: '/balkh/' }); return res.end(); }
    if (!url.pathname.startsWith('/balkh/')) { res.writeHead(404); return res.end(); }
    const relative = decodeURIComponent(url.pathname.slice('/balkh/'.length)) || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404); res.end();
  }
}).listen(port, '127.0.0.1', () => console.log(`Balkh playground: http://127.0.0.1:${port}/balkh/`));
