const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const { hostFixture } = require('./host-fixture.cjs');
const root = path.resolve(__dirname, '..');

test('RTL editor renders, highlights, edits, saves, undoes, and resolves external changes', { timeout: 90000 }, async () => {
  let html;
  const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.statusCode = 204; return res.end(); }
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(html); }
    const filename = path.basename(req.url);
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.ttf': 'font/ttf' };
    const file = path.join(root, 'dist', filename);
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const host = await hostFixture('', baseUrl);
    html = host.panel.webview.html;
    browser = await chromium.launch({ channel: process.env.BALKH_BROWSER || 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    const source = fs.readFileSync(path.resolve(root, '../../examples/salam.blk'), 'utf8');
    await page.addInitScript(({ source }) => {
      let stored = {};
      const host = window.testHost = { text: source, version: 1, saves: 0, commands: [], history: [source], redo: [], delay: 0 };
      const post = (data) => window.postMessage(data, '*');
      host.external = (text) => { host.text = text; post({ type: 'update', text, version: ++host.version }); };
      window.acquireVsCodeApi = () => ({
        getState: () => stored, setState: (value) => { stored = value; },
        postMessage: (message) => {
          if (message.type === 'ready') post({ type: 'init', text: host.text, version: host.version, options: { fontSize: 16, tabSize: 4, insertSpaces: true, wordWrap: 'off', readOnly: false } });
          else if (message.type === 'edit') setTimeout(() => {
            if (message.version !== host.version) return post({ type: 'conflict', text: host.text, version: host.version });
            host.text = message.text;
            host.history.push(host.text);
            host.redo = [];
            post({ type: 'ack', id: message.id, text: host.text, version: ++host.version });
          }, host.delay);
          else if (message.type === 'save') host.saves++;
          else if (message.type === 'command') {
            host.commands.push(message.command);
            if (message.command === 'undo' && host.history.length > 1) { host.redo.push(host.history.pop()); host.text = host.history.at(-1); }
            if (message.command === 'redo' && host.redo.length) { host.text = host.redo.pop(); host.history.push(host.text); }
            post({ type: 'update', text: host.text, version: ++host.version });
          }
        },
      });
    }, { source });
    await page.goto(baseUrl);
    await page.waitForSelector('.monaco-editor');
    await page.waitForFunction(() => document.getElementById('status').textContent === '');
    await page.waitForSelector('.view-line[dir="rtl"]');
    await page.waitForFunction(() => [...document.querySelectorAll('.view-line span')].some((span) => span.textContent === 'چاپ'));
    await page.evaluate(() => document.fonts.ready);
    const indentation = await page.locator('.view-line').evaluateAll((lines) => lines.slice(2, 5).map((line) => {
      const token = [...line.querySelectorAll('span span')].find((span) => span.textContent.trim());
      return line.getBoundingClientRect().right - token.getBoundingClientRect().right;
    }));
    assert.ok(indentation[1] > indentation[0] + 25, `first block is not indented from the right: ${indentation}`);
    assert.ok(indentation[2] > indentation[1] + 25, `nested block is not indented from the right: ${indentation}`);
    const layout = await page.locator('.view-line').first().evaluate((line) => {
      const content = line.firstElementChild.getBoundingClientRect();
      const row = line.getBoundingClientRect();
      return { direction: getComputedStyle(line).direction, rightGap: row.right - content.right };
    });
    assert.equal(layout.direction, 'rtl');
    assert.ok(Math.abs(layout.rightGap) < 30, `text is not right-aligned: ${layout.rightGap}`);
    const colors = await page.locator('.view-line span[class^="mtk"]').evaluateAll((spans) => [...new Set(spans.map((span) => getComputedStyle(span).color))]);
    assert.ok(colors.length >= 3, 'syntax highlighting is missing');
    assert.equal(await page.evaluate(() => window.testHost.text), source, 'opening a file changes its contents');
    const screenshot = process.env.BALKH_SCREENSHOT;
    if (screenshot) await page.screenshot({ path: screenshot });

    await page.getByRole('button', { name: 'Switch to LTR', exact: true }).click();
    await page.waitForSelector('.view-line[dir="ltr"]');
    await page.getByRole('button', { name: 'Switch to RTL', exact: true }).click();
    await page.waitForSelector('.view-line[dir="rtl"]');
    assert.equal(await page.evaluate(() => window.testHost.text), source, 'direction toggle edits source');

    const edited = 'چاپ("دنیا")\n# test 😀';
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText(edited);
    await page.keyboard.press('Control+s');
    await page.waitForFunction(() => window.testHost.saves === 1);
    assert.equal((await page.evaluate(() => window.testHost.text)).replace(/\r\n/g, '\n'), edited);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.testHost.commands.includes('undo'));
    await page.keyboard.press('Control+y');
    await page.waitForFunction(() => window.testHost.commands.includes('redo'));

    await page.evaluate(() => window.testHost.external('چاپ("بیرون")'));
    await page.waitForFunction(() => document.querySelector('.view-lines').textContent.includes('بیرون'));
    await page.evaluate(() => { window.testHost.delay = 150; });
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText(' # local');
    await page.evaluate(() => window.testHost.external('چاپ("external")'));
    await page.waitForSelector('#conflict:not([hidden])');
    await page.getByRole('button', { name: 'Use File Changes', exact: true }).click();
    await page.waitForSelector('#conflict[hidden]', { state: 'attached' });
    await page.waitForFunction(() => document.querySelector('.view-lines').textContent.includes('external'));
    assert.equal(await page.evaluate(() => window.testHost.text), 'چاپ("external")');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
