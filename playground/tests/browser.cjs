const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const dist = path.resolve(__dirname, '../dist');
const repository = path.resolve(__dirname, '../..');
const prefix = '/balkh/';
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};
let server;
let browser;
let baseUrl;

before(async () => {
  await fs.access(path.join(dist, 'index.html'));
  server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    if (!url.pathname.startsWith(prefix)) {
      response.writeHead(404).end();
      return;
    }
    let file;
    try {
      const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
      file = path.resolve(dist, relative);
      if (!file.startsWith(dist + path.sep)) throw new Error('Invalid asset path');
      const contents = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream' });
      response.end(contents);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}${prefix}`;
  const channel = process.env.PLAYWRIGHT_CHANNEL || process.env.BALKH_BROWSER || (process.platform === 'win32' ? 'msedge' : undefined);
  // Exercise native scrollbar dragging too; Playwright hides browser bars by default.
  browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], ...(channel ? { channel } : {}) });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function ready(page) {
  await page.locator('#run').waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('#run').disabled || !document.querySelector('#retry').hidden, null, { timeout: 120000 });
  assert.equal(await page.locator('#run').isEnabled(), true,
    `Python did not become ready: ${await page.locator('#runtime-status').textContent()}\n${await page.locator('#output').textContent()}`);
}

async function source(page, text) {
  // Monaco keeps partially clipped lines in its virtual DOM after scrolling.
  // Click inside the visible editor viewport, rather than its first DOM line.
  await page.locator('#editor .monaco-editor').click({ position: { x: 100, y: 75 } });
  await page.keyboard.press('ControlOrMeta+a');
  // A program is pasted as one edit; insertText simulates IME typing, which
  // intentionally invokes Monaco's automatic closing quotes and indentation.
  await page.evaluate((value) => window.balkhTestEditor.trigger('browser-test', 'paste', { text: value }), text);
  assert.equal((await page.evaluate(() => window.balkhTestEditor.getValue())).replace(/\r\n/g, '\n'), text.replace(/\r\n/g, '\n'));
}

async function chooseExample(page, id) {
  await page.locator('#examples').click();
  await page.locator(`#examples-menu [data-example="${id}"]`).click();
}

async function editorContext(options = {}) {
  const context = await browser.newContext(options);
  await context.addInitScript(() => {
    document.addEventListener('balkh-editor-ready', (event) => { window.balkhTestEditor = event.detail; });
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url, options) {
        super(url, options);
        if (options?.type === 'module') {
          window.balkhOutputMessages = 0;
          window.balkhInputMessages = [];
          window.balkhRuntimeWorker = this;
          this.addEventListener('message', ({ data }) => {
            if (data.type === 'output') window.balkhOutputMessages++;
            if (data.type === 'input') window.balkhInputMessages.push(data);
          });
        }
      }
    };
  });
  return context;
}

async function run(page, expected) {
  await page.locator('#run').click();
  await ready(page);
  const output = await page.locator('#output').innerText();
  if (expected) assert.ok(output.includes(expected), `Expected output containing ${JSON.stringify(expected)}; received ${JSON.stringify(output)}`);
  return output;
}

test('the GitHub Pages build runs real Balkh through Pyodide', { timeout: 420000 }, async (t) => {
  const context = await editorContext({ viewport: { width: 1365, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await page.goto(baseUrl);
    await ready(page);

    await t.test('default program renders RTL highlighting, executes Unicode, and downloads the current source', async () => {
      await page.locator('#editor .view-line[dir="rtl"]').first().waitFor();
      const bounds = await page.locator('#editor .view-line').first().evaluate((line) => {
        const range = document.createRange();
        range.selectNodeContents(line);
        return { textRight: range.getBoundingClientRect().right, editorRight: document.querySelector('#editor').getBoundingClientRect().right };
      });
      assert.ok(bounds.textRight <= bounds.editorRight + 1, `RTL source is clipped past the editor's right edge: ${JSON.stringify(bounds)}`);
      const colors = await page.locator('#editor .view-line span[class^="mtk"]').evaluateAll((spans) => [...new Set(spans.map((span) => getComputedStyle(span).color))]);
      assert.ok(colors.length >= 3, `Expected several syntax token colors, found ${colors}`);
      const output = await run(page, 'سلام احمد');
      assert.match(output, /سلام زرغونه/);
      assert.match(output, /Hello Sara/);
      assert.equal(await page.locator('#output').evaluate((element) => getComputedStyle(element).direction), 'rtl');
      if (process.env.BALKH_SCREENSHOT) await page.screenshot({ path: process.env.BALKH_SCREENSHOT, fullPage: true });

      const savedSource = `# بلخ — پښتو 😀\n# ${'پښتو '.repeat(60)}\nچاپ("سلام دنیا")\n`;
      await source(page, savedSource);
      const downloading = page.waitForEvent('download');
      await page.locator('#download').click();
      const download = await downloading;
      assert.match(download.suggestedFilename(), /\.blk$/);
      assert.equal((await fs.readFile(await download.path(), 'utf8')).replace(/\r\n/g, '\n'), savedSource);

      await chooseExample(page, 'salam');
      await page.locator('#editor .monaco-editor').click({ position: { x: 100, y: 75 } });
      await page.keyboard.press('ControlOrMeta+z');
      assert.equal((await page.evaluate(() => window.balkhTestEditor.getValue())).replace(/\r\n/g, '\n'), savedSource,
        'Switching examples must preserve the draft in undo history');
    });

    await t.test('preview does not execute code, stdin preserves Unicode lines, and the bundled standard library works', async () => {
      await source(page, 'چاپ("PREVIEW_MUST_NOT_RUN")\n');
      await page.locator('#python-tab').click();
      await ready(page);
      assert.match(await page.locator('#python').innerText(), /print\("PREVIEW_MUST_NOT_RUN"\)/);
      assert.doesNotMatch(await page.locator('#output').innerText(), /PREVIEW_MUST_NOT_RUN/);

      await source(page, 'چاپ("PREVIEW_EDIT")\n');
      await source(page, 'چاپ("PREVIEW_MUST_NOT_RUN")\n');
      await page.locator('#python-tab').click();
      await ready(page);
      assert.match(await page.locator('#python').innerText(), /print\("PREVIEW_MUST_NOT_RUN"\)/);

      await source(page, 'نام = ورودی("نام: ")\nژبه = ننوت("ژبه: ")\nچاپ(نام + " / " + ژبه)\n');
      await page.locator('#run').click();
      await page.locator('#input-form').waitFor();
      await page.locator('#stdin').fill('زرغونه');
      await page.locator('#stdin').press('Enter');
      await page.waitForFunction(() => !document.querySelector('#input-form').hidden && document.querySelector('#output').textContent.includes('ژبه: '));
      await page.locator('#stdin').fill('پښتو');
      await page.locator('#stdin').press('Enter');
      await ready(page);
      assert.match(await page.locator('#output').textContent(), /زرغونه \/ پښتو/);

      await source(page, await fs.readFile(path.join(repository, 'examples/stdlib.blk'), 'utf8'));
      const output = await run(page, '2024-02-29');
      assert.match(output, /9\.0/);
      assert.match(output, /بلخ/);
      assert.match(output, /سبا:/);

      // Pyodide ships Python 3.14, whose template literal tokens differ from strings.
      await source(page, 'value = t"۱۲۳ {عدد(۲) + ۳}"\nچاپ(value.strings[0], value.interpolations[0].value)\n');
      assert.match(await run(page), /۱۲۳  5/);

      await source(page, [
        'from __future__ import annotations',
        'import __main__, pickle',
        'from dataclasses import dataclass, InitVar',
        'message = "Balkh"',
        'assert __main__.message == message',
        '@dataclass',
        'class Sample:',
        '    value: int',
        '    temporary: InitVar[int] = 1',
        'sample = Sample(3)',
        'assert repr(sample) == "Sample(value=3)"',
        'assert pickle.loads(pickle.dumps(sample)).value == 3',
        'print("MODULE_FEATURES_OK")', '',
      ].join('\n'));
      await run(page, 'MODULE_FEATURES_OK');
    });

    await t.test('interactive input preserves execution, Unicode, EOF and Stop across interface languages', { timeout: 180000 }, async () => {
      await source(page, [
        'print("EXECUTED_ONCE", flush=True)',
        'def ask():',
        '    return input("Name: ")',
        'name = ask()',
        'place = ننوت("ځای: ")',
        'empty = ورودی("Empty: ")',
        'print(name + " / " + place + " / " + repr(empty))', '',
      ].join('\n'));
      await page.locator('#run').click();
      await page.locator('#input-form').waitFor();
      assert.match(await page.locator('#output').textContent(), /EXECUTED_ONCE\nName: /);
      assert.equal(await page.locator('#run').isDisabled(), true);
      assert.equal(await page.locator('#stop').isEnabled(), true);
      assert.equal(await page.locator('#stdin').evaluate(input => input === document.activeElement), true);
      await page.locator('#stdin').fill('زرغونه 😀');
      const waiting = await page.evaluate(() => window.balkhInputMessages.at(-1));
      await page.evaluate(request => window.balkhRuntimeWorker.postMessage({ type: 'input-response', id: request.id, requestId: request.requestId + 100, value: 'stale', eof: false }), waiting);
      for (const [language, tag] of [['dari', 'fa-AF'], ['pashto', 'ps-AF']]) {
        await page.locator('#ui-language-toggle').click();
        await page.locator(`[data-ui-language="${language}"]`).click();
        assert.equal(await page.locator('html').getAttribute('lang'), tag);
        assert.equal(await page.locator('#stdin').inputValue(), 'زرغونه 😀');
        assert.equal(await page.locator('#input-form').isVisible(), true);
        for (const width of [390, 320]) {
          await page.setViewportSize({ width, height: 844 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          const input = await page.locator('#stdin').boundingBox();
          assert.ok(input.x >= 0 && input.x + input.width <= width);
        }
      }
      await page.setViewportSize({ width: 1365, height: 900 });
      await page.locator('#stdin').press('Enter');
      await page.waitForFunction(() => !document.querySelector('#input-form').hidden && document.querySelector('#output').textContent.includes('ځای: '));
      await page.locator('#stdin').fill('بلخ');
      await page.locator('#input-form button[type="submit"]').click();
      await page.waitForFunction(() => !document.querySelector('#input-form').hidden && document.querySelector('#output').textContent.includes('Empty: '));
      await page.locator('#stdin').press('Enter');
      await ready(page);
      const transcript = await page.locator('#output').textContent();
      assert.match(transcript, /زرغونه 😀 \/ بلخ \/ ''/);
      assert.equal(transcript.match(/EXECUTED_ONCE/g).length, 1, 'Answering must resume the same execution rather than rerun side effects');
      assert.equal(await page.locator('#output .stdin').count(), 3, 'Answers, including an empty line, stay in the transcript');
      assert.equal(await page.locator('#input-form').isVisible(), false);
      await page.locator('#ui-language-toggle').click();
      await page.locator('[data-ui-language="en"]').click();

      await source(page, 'input("End? ")\n');
      await page.locator('#run').click();
      await page.locator('#input-form').waitFor();
      await page.locator('#input-eof').click();
      await ready(page);
      assert.match(await page.locator('#output').textContent(), /EOFError/);

      // Plain stdin readers use the same line prompts and retain EOF thereafter.
      await source(page, 'import sys\nprint(repr(sys.stdin.read(2)))\nprint(repr(sys.stdin.readline()))\nprint(repr(sys.stdin.read()))\nprint(repr(sys.stdin.readline()))\n');
      await page.locator('#run').click();
      await page.locator('#input-form').waitFor();
      await page.locator('#stdin').fill('سلام😀');
      await page.locator('#stdin').press('Enter');
      await page.waitForFunction(() => !document.querySelector('#input-form').hidden && document.querySelector('#output').textContent.includes("'ام😀\\n'"));
      await page.locator('#input-eof').click();
      await ready(page);
      assert.match(await page.locator('#output').textContent(), /'سل'\n'ام😀\\n'\n''\n''/);

      await source(page, 'print(input("Stop here: "))\n');
      await page.locator('#run').click();
      await page.locator('#input-form').waitFor();
      const stoppedRequest = await page.evaluate(() => window.balkhInputMessages.at(-1));
      await page.locator('#stdin').fill('discard this');
      await page.locator('#stop').click();
      assert.equal(await page.locator('#input-form').isVisible(), false);
      await ready(page);
      await page.locator('#run').click();
      await page.locator('#input-form').waitFor();
      assert.equal(await page.locator('#stdin').inputValue(), '');
      await page.evaluate(request => window.balkhRuntimeWorker.postMessage({ ...request, type: 'input-response', value: 'stale', eof: false }), stoppedRequest);
      await page.locator('#stdin').fill('fresh answer');
      await page.locator('#stdin').press('Enter');
      await ready(page);
      assert.match(await page.locator('#output').textContent(), /fresh answer\nfresh answer/);
      assert.doesNotMatch(await page.locator('#output').textContent(), /stale|discard this/);

      await chooseExample(page, 'bazi');
      await page.locator('#run').click();
      for (let guess = 1; guess <= 10; guess++) {
        await page.locator('#input-form').waitFor();
        const requests = await page.evaluate(() => window.balkhInputMessages.length);
        await page.locator('#stdin').fill(String(guess));
        await page.locator('#stdin').press('Enter');
        await page.waitForFunction(before => !document.querySelector('#run').disabled || window.balkhInputMessages.length > before, requests);
        if (await page.locator('#run').isEnabled()) break;
      }
      await ready(page);
      assert.match(await page.locator('#output').textContent(), /🎉/);
      assert.equal(await page.locator('#input-form').isVisible(), false);
    });

    await t.test('verbose output stays bounded and is delivered in batches', async () => {
      await source(page, 'for _ in range(50001):\n    print("x")\n');
      await page.evaluate(() => { window.balkhOutputMessages = 0; });
      const output = await run(page);
      assert.ok(output.startsWith('x\nx\n'));
      assert.ok(output.includes('[Output truncated at 100,000 characters.]'));
      assert.ok(output.length < 101000, `Output grew beyond the display budget: ${output.length}`);
      const messages = await page.evaluate(() => window.balkhOutputMessages);
      assert.ok(messages < 1000, `Verbose output flooded the UI with ${messages} messages`);
    });

    await t.test('localized diagnostics retain native line numbers and each run has a fresh namespace', async () => {
      await source(page, '# original line one\nچاپ(۱ / ۰)\n');
      await page.locator('#language').selectOption('dari');
      const dari = await run(page, 'ZeroDivisionError');
      assert.match(dari, /خطای اجرا/);
      assert.match(dari, /خط ۲/);
      assert.match(dari, /چاپ\(۱ \/ ۰\)/);
      await page.locator('#language').selectOption('pashto');
      const pashto = await run(page, 'ZeroDivisionError');
      assert.match(pashto, /د اجرا تېروتنه/);
      assert.match(pashto, /کرښه ۲/);

      await source(page, 'previous_run_only = ۴۲\n');
      await run(page);
      await source(page, 'چاپ(previous_run_only)\n');
      const fresh = await run(page, 'NameError');
      assert.match(fresh, /previous_run_only/);
    });

    await t.test('Stop recovers from infinite execution, Unicode drafts survive reload, and the mobile page fits', { timeout: 180000 }, async () => {
      await source(page, 'چاپ("STARTED_BEFORE_LOOP", end="", flush=درست)\nتاوقتی درست:\n    خالی\n');
      await page.locator('#run').click();
      await page.waitForFunction(() => !document.querySelector('#stop').disabled);
      await page.waitForFunction(() => document.querySelector('#output').textContent.includes('STARTED_BEFORE_LOOP'));
      await page.locator('#stop').click();
      await ready(page);
      const draft = '# مسوده 😀\nچاپول("بیا سلام")\n';
      await source(page, draft);
      await run(page, 'بیا سلام');
      await page.waitForFunction(() => Object.values(localStorage).some((value) => value.includes('بیا سلام')));
      await page.reload();
      await ready(page);
      await run(page, 'بیا سلام');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(200);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'The mobile page overflows horizontally');
      const screenshot = process.env.BALKH_SCREENSHOT;
      if (screenshot) {
        const parsed = path.parse(screenshot);
        await page.screenshot({ path: path.join(parsed.dir, `${parsed.name}-mobile${parsed.ext}`), fullPage: true });
      }
      await page.setViewportSize({ width: 320, height: 760 });
      const selectBounds = await page.locator('#examples').evaluate((select) => ({
        right: select.getBoundingClientRect().right,
        panelRight: select.closest('.source-panel').getBoundingClientRect().right,
      }));
      assert.ok(selectBounds.right <= selectBounds.panelRight, 'The example selector is clipped on narrow phones');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'The narrow phone page overflows horizontally');
    });
    assert.deepEqual(pageErrors, []);
  } finally {
    await context.close();
  }
});

test('browsers without Promise Integration still run code and explain interactive input limits', { timeout: 180000 }, async () => {
  const context = await editorContext();
  await context.route('**/worker.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: 'delete WebAssembly.Suspending; delete WebAssembly.promising;\n' + await response.text() });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(baseUrl);
    await ready(page);
    assert.match(await page.locator('#runtime-note').textContent(), /Interactive input is unavailable/);
    await source(page, 'print("NO_INPUT_STILL_WORKS")\n');
    await run(page, 'NO_INPUT_STILL_WORKS');
    await source(page, 'input("Name: ")\n');
    await run(page, 'Interactive input is unavailable');
    assert.equal(await page.locator('#input-form').isVisible(), false);
    await page.locator('#python-tab').click();
    await ready(page);
    assert.match(await page.locator('#python').textContent(), /input\("Name: "\)/);
    await source(page, 'print("RECOVERED")\n');
    await run(page, 'RECOVERED');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('a failed runtime download can be retried without losing the draft', { timeout: 180000 }, async () => {
  const context = await editorContext();
  const page = await context.newPage();
  let failed = false;
  await context.route(/pyodide(?:\.asm)?\.(?:m?js|wasm)(?:\?.*)?$/, async (route) => {
    if (!failed) {
      failed = true;
      await route.abort('failed');
    } else await route.continue();
  });
  try {
    await page.goto(baseUrl);
    await page.locator('#retry').waitFor({ state: 'visible', timeout: 120000 });
    const draft = 'چاپ("پس از تلاش دوباره")\n';
    await source(page, draft);
    await page.locator('#retry').click();
    await ready(page);
    assert.equal(failed, true, 'The test did not intercept a real Pyodide runtime request');
    await run(page, 'پس از تلاش دوباره');
  } finally {
    await context.close();
  }
});

test('examples wait for a slow editor to initialize', { timeout: 60000 }, async () => {
  const context = await editorContext();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await context.route('**/onig.wasm', async (route) => { await held; await route.continue(); });
  await context.route('**/worker.js', (route) => route.abort('failed'));
  const page = await context.newPage();
  try {
    await page.goto(baseUrl);
    await page.waitForFunction(() => document.querySelectorAll('#examples-menu [data-example]').length > 0);
    assert.equal(await page.locator('#examples').isDisabled(), true,
      'The example selector must wait until the editor can apply its selection');
    release();
    await page.waitForFunction(() => !!window.balkhTestEditor);
    await chooseExample(page, 'stdlib');
    assert.equal(await page.evaluate(() => window.balkhTestEditor.getValue()),
      (await fs.readFile(path.join(repository, 'examples/stdlib.blk'), 'utf8')).replace(/\r\n/g, '\n'));
  } finally {
    release();
    await context.close();
  }
});

test('large saved drafts survive reload in the fallback editor', { timeout: 60000 }, async () => {
  const context = await browser.newContext();
  await context.route('**/onig.wasm', (route) => route.abort('failed'));
  await context.route('**/worker.js', (route) => route.abort('failed'));
  const draft = '#' + 'x'.repeat(1_000_001);
  await context.addInitScript((source) => {
    if (!localStorage.getItem('balkh.playground.v1')) {
      localStorage.setItem('balkh.playground.v1', JSON.stringify({ version: 1, source, filename: 'program.blk' }));
    }
  }, draft);
  const page = await context.newPage();
  try {
    await page.goto(baseUrl);
    await page.locator('.editor-fallback').waitFor();
    assert.equal(await page.locator('.editor-fallback').inputValue(), draft);
    await page.reload();
    await page.locator('.editor-fallback').waitFor();
    assert.equal(await page.locator('.editor-fallback').inputValue(), draft);
  } finally {
    await context.close();
  }
});

test('interface languages preserve running code, output, diagnostics, and saved preferences', { timeout: 180000 }, async () => {
  const context = await editorContext({ locale: 'fa-AF', viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const choose = async language => {
    await page.locator('#ui-language-toggle').click();
    await page.locator(`[data-ui-language="${language}"]`).click();
  };
  try {
    await page.goto(baseUrl);
    await ready(page);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'English is the default regardless of browser locale');
    await page.evaluate(() => document.fonts.ready);
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const platformFonts = async selector => {
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      return (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
    };
    for (const language of ['fa-AF', 'ps-AF']) {
      const fonts = await platformFonts(`.hero-line[lang="${language}"]`);
      assert.ok(fonts.some(font => /^Vazirmatn(?: |$)/.test(font.familyName) && font.isCustomFont && font.glyphCount > 0),
        `${language} must render with the bundled Vazirmatn font: ${JSON.stringify(fonts)}`);
    }
    assert.ok((await platformFonts('.hero-line[lang="en"]')).every(font => !font.familyName.startsWith('Vazirmatn')), 'Latin keeps its existing font stack');
    const fontLicense = await context.request.get(new URL('assets/fonts/vazirmatn/OFL.txt', baseUrl).href);
    assert.equal(fontLicense.ok(), true);
    assert.match(await fontLicense.text(), /SIL OPEN FONT LICENSE Version 1\.1/);
    const headline = await page.locator('#page-title').textContent();
    const description = await page.locator('.intro-copy').textContent();
    const draft = 'چاپ("UI_LANGUAGE_OUTPUT 😀")\n';
    await source(page, draft);
    await page.locator('#language').selectOption('pashto');
    await page.locator('#direction').click();
    const output = await run(page, 'UI_LANGUAGE_OUTPUT 😀');
    await page.locator('#python-tab').click();
    await ready(page);
    const python = await page.locator('#python').textContent();

    for (const [language, tag, label] of [['dari', 'fa-AF', 'اجرای کود'], ['pashto', 'ps-AF', 'کوډ چلول']]) {
      await choose(language);
      assert.equal(await page.locator('html').getAttribute('lang'), tag);
      assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
      assert.equal(await page.locator('#run-label').textContent(), label);
      await page.evaluate(() => document.fonts.ready);
      assert.ok((await platformFonts('#run-label')).some(font => /^Vazirmatn(?: |$)/.test(font.familyName) && font.isCustomFont && font.glyphCount > 0), 'Localized controls render with Vazirmatn');
      assert.equal(await page.locator('#language').inputValue(), 'pashto');
      assert.equal(await page.locator('#direction').getAttribute('aria-pressed'), 'false');
      assert.equal((await page.evaluate(() => window.balkhTestEditor.getValue())).replace(/\r\n/g, '\n'), draft);
      assert.equal(await page.locator('#python').textContent(), python, 'Changing UI language must preserve generated Python');
      assert.equal(await page.locator('#python').getAttribute('dir'), 'ltr');
      assert.equal(await page.locator('#output').innerText(), output);
      assert.equal(await page.locator('#page-title').textContent(), headline);
      assert.notEqual(await page.locator('.intro-copy').textContent(), description);
      assert.notEqual(await page.locator('#run-status').textContent(), 'Python preview updated');
      const bounds = await page.evaluate(() => ({ source: document.querySelector('.source-panel').getBoundingClientRect().x, results: document.querySelector('.result-panel').getBoundingClientRect().x }));
      assert.ok(bounds.source > bounds.results, 'Source stays on the right in RTL interface mode');
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const line of await page.locator('.hero-line').all()) assert.ok(await line.isVisible());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${language} overflows at ${width}px`);
        await page.locator('#ui-language-toggle').click();
        const menu = await page.locator('#ui-language-menu').boundingBox();
        assert.ok(menu.x >= 0 && menu.x + menu.width <= width, 'The language menu stays inside the phone viewport');
        await page.keyboard.press('Escape');
      }
      await page.setViewportSize({ width: 1365, height: 900 });
    }
    await page.reload();
    await ready(page);
    assert.equal(await page.locator('html').getAttribute('lang'), 'ps-AF');
    assert.equal(await page.locator('#language').inputValue(), 'pashto');
    assert.equal(await page.locator('#direction').getAttribute('aria-pressed'), 'false');
    assert.equal((await page.evaluate(() => window.balkhTestEditor.getValue())).replace(/\r\n/g, '\n'), draft);
    await run(page, 'UI_LANGUAGE_OUTPUT 😀');

    await source(page, 'print("LANGUAGE_SWITCH_RUNNING", flush=True)\nwhile True:\n    pass\n');
    await page.locator('#run').click();
    await page.waitForFunction(() => document.querySelector('#output').textContent.includes('LANGUAGE_SWITCH_RUNNING'));
    await choose('dari');
    assert.equal(await page.locator('#run-label').textContent(), 'در حال اجرا…');
    assert.equal(await page.locator('#stop').isEnabled(), true);
    assert.match(await page.locator('#output').textContent(), /LANGUAGE_SWITCH_RUNNING/);
    await page.locator('#stop').click();
    await ready(page);
    assert.match(await page.locator('#output').textContent(), /برنامه متوقف شد/);

    await page.locator('#ui-language-toggle').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#ui-language-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#ui-language-toggle').evaluate(el => el === document.activeElement), true);
    await page.reload();
    await ready(page);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('language selection works with blocked storage and the basic editor', { timeout: 60000 }, async () => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
    Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  });
  await context.route('**/onig.wasm', route => route.abort('failed'));
  await context.route('**/worker.js', route => route.abort('failed'));
  const page = await context.newPage();
  try {
    await page.goto(baseUrl);
    await page.locator('.editor-fallback').waitFor();
    await page.locator('#ui-language-toggle').click();
    await page.locator('[data-ui-language="dari"]').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'fa-AF');
    assert.equal(await page.locator('.editor-fallback').getAttribute('aria-label'), 'ویرایشگر کود بلخ');
    await page.locator('.editor-fallback').fill('# keep my draft');
    await page.waitForFunction(() => document.querySelector('#save-status').dataset.i18n === 'saveUnavailable');
    assert.doesNotMatch(await page.locator('#save-status').textContent(), /Local saving/);
    await page.locator('#ui-language-toggle').click();
    await page.locator('[data-ui-language="pashto"]').click();
    assert.equal(await page.locator('.editor-fallback').inputValue(), '# keep my draft');
    assert.equal(await page.locator('#retry').textContent(), 'بیا هڅه');
    await page.reload();
    await page.locator('.editor-fallback').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'Without storage, the next visit defaults to English');
  } finally { await context.close(); }
});

test('program picker supports keyboard selection, localization and narrow screens', { timeout: 60000 }, async () => {
  const context = await editorContext({ viewport: { width: 1365, height: 900 }, reducedMotion: 'no-preference' });
  await context.route('**/worker.js', route => route.abort('failed'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(baseUrl);
    await page.waitForFunction(() => !document.querySelector('#examples').disabled);
    const trigger = page.locator('#examples');
    const menu = page.locator('#examples-menu');
    assert.equal(await trigger.locator('.icon use').first().getAttribute('href'), '#icon-code');
    await trigger.focus();
    await page.keyboard.press('Enter');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator(':focus').getAttribute('data-example'), 'salam');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#examples .disclosure-icon')).transform.startsWith('matrix(-1,'));
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#file-name').textContent(), 'bazi.blk');
    assert.equal(await page.locator('#example-name').textContent(), 'Guessing game');
    assert.equal(await menu.isVisible(), false);
    assert.equal(await trigger.evaluate(button => button === document.activeElement), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator(':focus').getAttribute('data-example'), 'bazi');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator(':focus').getAttribute('data-example'), 'stdlib');
    await page.keyboard.press('Escape');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#file-name').textContent(), 'bazi.blk', 'Browsing and cancelling must not change the program');
    await trigger.click();
    await page.keyboard.press('Tab');
    assert.equal(await menu.isVisible(), false, 'Tab should leave and close the picker');
    await trigger.click();
    await page.locator('#source-title').click();
    assert.equal(await menu.isVisible(), false, 'Clicking outside should close the picker');
    const program = await page.evaluate(() => window.balkhTestEditor.getValue());
    for (const [language, label] of [['dari', 'بازی حدس عدد'], ['pashto', 'د شمېرې اټکل لوبه'], ['en', 'Guessing game']]) {
      await page.locator('#ui-language-toggle').click();
      await page.locator(`[data-ui-language="${language}"]`).click();
      assert.equal(await page.locator('#example-name').textContent(), label);
      assert.equal(await page.evaluate(() => window.balkhTestEditor.getValue()), program);
      for (const width of [1365, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await trigger.click();
        const bounds = await menu.boundingBox();
        const panel = await page.locator('.source-panel').boundingBox();
        assert.ok(bounds.x >= panel.x && bounds.x + bounds.width <= panel.x + panel.width, `${language} picker is clipped at ${width}px`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.locator('[data-example="bazi"]').click();
        assert.equal(await menu.isVisible(), false);
        assert.equal(await page.locator('[data-example="bazi"]').getAttribute('aria-selected'), 'true');
      }
    }
    await source(page, 'print("my draft")');
    assert.equal(await page.locator('#example-name').textContent(), 'Your program');
    assert.equal(await menu.locator('[aria-selected="true"]').count(), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await trigger.locator('.disclosure-icon').evaluate(icon => getComputedStyle(icon).transitionDuration), '0s');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('editor scrolling stays smooth and synchronized across the code, gutter and scrollbar', { timeout: 60000 }, async () => {
  const context = await editorContext({ viewport: { width: 1365, height: 900 }, reducedMotion: 'no-preference' });
  await context.addInitScript(() => {
    localStorage.setItem('balkh.playground.v1', JSON.stringify({
      version: 1, source: Array.from({ length: 300 }, (_, i) => `print(${i})`).join('\n'), rtl: true, filename: 'scroll.blk',
    }));
  });
  await context.route('**/worker.js', route => route.abort('failed'));
  const page = await context.newPage();
  try {
    await page.goto(baseUrl);
    await page.locator('.editor-side-line-number').first().waitFor();
    await page.evaluate(() => {
      window.scrollTrace = [];
      window.balkhTestEditor.onDidScrollChange(event => {
        const row = document.querySelector('.editor-side-line-number');
        const hostTop = document.querySelector('.editor-host').getBoundingClientRect().top;
        if (event.scrollTopChanged) window.scrollTrace.push({
          top: event.scrollTop, bar: document.querySelector('.editor-side-scroll').scrollTop,
          gutterDrift: row ? row.getBoundingClientRect().top - hostTop
            - window.balkhTestEditor.getTopForLineNumber(Number(row.dataset.line)) + event.scrollTop : null,
        });
      });
    });
    const wheel = async (selector, delta, count = 1) => {
      await page.evaluate(() => { window.scrollTrace = []; });
      await page.locator(selector).hover();
      for (let i = 0; i < count; i++) await page.mouse.wheel(0, delta);
      // Let the last wheel animation and any delayed native scroll events settle.
      await page.waitForTimeout(350);
      return page.evaluate(() => window.scrollTrace);
    };
    const monotonic = (trace, direction, rtl) => {
      assert.ok(trace.length > 2, 'A wheel step should animate rather than jump');
      for (let i = 0; i < trace.length; i++) {
        if (rtl) {
          assert.ok(Math.abs(trace[i].bar - trace[i].top) < 1, 'The native thumb must follow every editor scroll frame');
          assert.ok(trace[i].gutterDrift !== null && Math.abs(trace[i].gutterDrift) < 1, 'Line numbers must move with the text, without a frame of lag');
        }
        if (i) assert.ok((trace[i].top - trace[i - 1].top) * direction >= 0, 'Scrolling must not vibrate backwards');
      }
    };
    for (const selector of ['.editor-host', '.editor-side-gutter', '.editor-side-scroll']) {
      await page.evaluate(() => window.balkhTestEditor.setScrollTop(500));
      const down = await wheel(selector, 120, 4);
      monotonic(down, 1, true);
      assert.ok(down.at(-1).top >= 690, 'Successive wheel steps must accumulate without losing momentum');
      const up = await wheel(selector, -120, 4);
      monotonic(up, -1, true);
      assert.ok(Math.abs(up.at(-1).top - 500) < 2, 'Opposite wheel steps must cover the same distance');
    }
    await page.locator('#direction').click();
    monotonic(await wheel('.editor-host', 120, 4), 1, false);
    await page.locator('#direction').click();
    // Honour the OS preference, including changes while the page is open.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const immediate = await wheel('.editor-side-gutter', 120);
    assert.equal(immediate.length, 1, 'Reduced motion should disable scroll animation');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    monotonic(await wheel('.editor-side-gutter', 120), 1, true);
  } finally { await context.close(); }
});

test('editor direction swaps line numbers and scrollbar while preserving editing, folding, and scrolling', { timeout: 60000 }, async () => {
  const draft = [
    '# Directional editor chrome', '# ' + 'بیا سلام '.repeat(16),
    'def example():', '    for i in range(3):', '        print(i)', '',
    ...Array.from({ length: 150 }, (_, index) => `print(${index})`), '',
  ].join('\n');
  const context = await editorContext({ viewport: { width: 1365, height: 900 } });
  await context.addInitScript(source => {
    localStorage.setItem('balkh.playground.v1', JSON.stringify({ version: 1, source, rtl: true, filename: 'program.blk' }));
  }, draft);
  await context.route('**/worker.js', route => route.abort('failed'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(baseUrl);
    await page.locator('.editor-side-line-number').first().waitFor();
    const chrome = async rtl => {
      const gutter = await page.locator(rtl ? '.editor-side-gutter' : '.monaco-editor .margin').boundingBox();
      const bar = await page.locator(rtl ? '.editor-side-scroll' : '.monaco-editor .scrollbar.vertical').boundingBox();
      assert.ok(rtl ? bar.x + bar.width <= gutter.x : gutter.x + gutter.width <= bar.x, 'Line numbers and scrollbar must occupy opposite sides');
      assert.equal(await page.locator('#editor').getAttribute('data-editor-direction'), rtl ? 'rtl' : 'ltr');
      assert.equal((await page.evaluate(() => window.balkhTestEditor.getValue())).replace(/\r\n/g, '\n'), draft);
    };
    const aligned = async () => {
      await page.waitForFunction(() => {
        const editor = window.balkhTestEditor;
        const top = document.querySelector('.editor-host').getBoundingClientRect().top;
        const rows = [...document.querySelectorAll('.editor-side-line-number')];
        return rows.length && rows.every(row => Math.abs(row.getBoundingClientRect().top - top - editor.getTopForLineNumber(Number(row.dataset.line)) + editor.getScrollTop()) < 1);
      });
    };
    await chrome(true);
    await aligned();
    await page.locator('.editor-host').hover();
    await page.mouse.wheel(0, 340);
    await page.waitForFunction(() => window.balkhTestEditor.getScrollTop() > 0);
    await aligned();
    await page.waitForFunction(() => Math.abs(document.querySelector('.editor-side-scroll').scrollTop - window.balkhTestEditor.getScrollTop()) < 1);

    // Drag the actual browser scrollbar, rather than simulating a scroll event.
    await page.evaluate(() => window.balkhTestEditor.setScrollTop(0));
    await page.waitForFunction(() => document.querySelector('.editor-side-scroll').scrollTop === 0);
    await page.locator('.editor-side-scroll').hover();
    const track = await page.locator('.editor-side-scroll').boundingBox();
    const scrollHeight = await page.evaluate(() => window.balkhTestEditor.getScrollHeight());
    const thumb = Math.max(28, track.height * track.height / scrollHeight);
    await page.mouse.move(track.x + 4, track.y + thumb / 2);
    await page.mouse.down();
    await page.mouse.move(track.x + 4, track.y + 180, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction(() => window.balkhTestEditor.getScrollTop() > 400);
    await aligned();

    await page.evaluate(() => { window.balkhTestEditor.setScrollTop(0); window.balkhTestEditor.render(); });
    await page.locator('.editor-side-line-number[data-line="3"]').waitFor();
    await page.locator('.editor-side-line-number[data-line="3"]').click();
    const selection = await page.evaluate(() => window.balkhTestEditor.getSelection());
    assert.equal(selection.startLineNumber, 3);
    assert.equal(selection.endLineNumber, 4);
    assert.equal(selection.startColumn, 1);
    assert.equal(selection.endColumn, 1);

    const previousTop = await page.evaluate(() => window.balkhTestEditor.getTopForLineNumber(7));
    await page.evaluate(async () => {
      window.balkhTestEditor.setPosition({ lineNumber: 3, column: 1 });
      await window.balkhTestEditor.getAction('editor.fold').run();
    });
    await page.waitForFunction(before => window.balkhTestEditor.getTopForLineNumber(7) < before, previousTop);
    await aligned();
    assert.equal(await page.locator('.editor-side-line-number[data-line="4"]').count(), 0, 'Folded lines must not have phantom numbers');
    await page.evaluate(() => window.balkhTestEditor.getAction('editor.unfoldAll').run());
    await page.locator('.editor-side-line-number[data-line="4"]').waitFor();

    // A real click and keyboard edit must still hit the native text coordinates.
    const point = await page.evaluate(() => {
      const editor = window.balkhTestEditor;
      const p = editor.getScrolledVisiblePosition({ lineNumber: 3, column: 1 });
      const box = editor.getDomNode().getBoundingClientRect();
      return { x: box.left + p.left, y: box.top + p.top + p.height / 2 };
    });
    await page.mouse.click(point.x, point.y);
    await page.keyboard.insertText('#');
    assert.ok((await page.evaluate(() => window.balkhTestEditor.getModel().getLineContent(3))).includes('#'));
    await page.keyboard.press('ControlOrMeta+z');
    await chrome(true);

    const cursor = await page.evaluate(() => window.balkhTestEditor.getSelection());
    await page.locator('#direction').click();
    await page.locator('.monaco-editor .line-numbers').first().waitFor();
    await chrome(false);
    assert.deepEqual(await page.evaluate(() => window.balkhTestEditor.getSelection()), cursor);
    await page.locator('#ui-language-toggle').click();
    await page.locator('[data-ui-language="pashto"]').click();
    await chrome(false);
    await page.locator('#direction').click();
    await page.locator('.editor-side-line-number').first().waitFor();
    await chrome(true);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await aligned();
      await chrome(true);
      const range = await page.locator('.editor-host .view-line').first().evaluate(line => {
        const range = document.createRange();
        range.selectNodeContents(line);
        return { right: range.getBoundingClientRect().right, gutter: document.querySelector('.editor-side-gutter').getBoundingClientRect().left };
      });
      assert.ok(range.right <= range.gutter + 1, 'Wrapped RTL source must stop before the right-hand gutter');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
