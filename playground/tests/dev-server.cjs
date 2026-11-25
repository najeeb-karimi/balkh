const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

const playground = path.resolve(__dirname, '..');
const repo = path.dirname(playground);

async function until(check, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the development server.');
}

test('development rebuilds reload the browser, preserve drafts, and recover from errors', { timeout: 120000 }, async () => {
  // Exercise actual file watching in an isolated checkout, never edit user files.
  const fixtures = path.join(playground, '.dev/tests');
  await fs.mkdir(fixtures, { recursive: true });
  const fixture = await fs.mkdtemp(path.join(fixtures, 'repo-'));
  const project = path.join(fixture, 'playground');
  const modules = path.join(project, 'node_modules');
  let child;
  let browser;
  let logs = '';
  try {
    for (const name of ['balkh', 'examples', 'LICENSE', 'editors/vscode/syntaxes', 'editors/vscode/language-configuration.json', 'editors/vscode/src/tokens.cjs']) {
      await fs.cp(path.join(repo, name), path.join(fixture, name), { recursive: true, filter: (file) => !file.includes('__pycache__') });
    }
    for (const name of ['scripts', 'assets', 'app.js', 'editor.js', 'scrollbars.js', 'i18n.js', 'index.html', 'style.css', 'worker.js', 'runner.py']) {
      await fs.cp(path.join(playground, name), path.join(project, name), { recursive: true });
    }
    await fs.symlink(path.join(playground, 'node_modules'), modules, 'junction');
    child = spawn(process.execPath, [path.join(project, 'scripts/dev.cjs')], {
      cwd: project, env: { ...process.env, PORT: '0' }, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (data) => { logs += data.toString(); });
    child.stderr.on('data', (data) => { logs += data.toString(); });
    child.on('error', (error) => { logs += error.stack; });
    await until(() => /http:\/\/127\.0\.0\.1:\d+\/balkh\//.test(logs) || child.exitCode !== null);
    assert.equal(child.exitCode, null, logs);
    const url = logs.match(/http:\/\/127\.0\.0\.1:\d+\/balkh\//)[0];
    const channel = process.env.PLAYWRIGHT_CHANNEL || process.env.BALKH_BROWSER || (process.platform === 'win32' ? 'msedge' : undefined);
    browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
    const context = await browser.newContext();
    // Runtime behavior is covered by browser.cjs; this test isolates dev reloads.
    await context.route('**/onig.wasm', (route) => route.abort('failed'));
    await context.route('**/worker.js', (route) => route.abort('failed'));
    const page = await context.newPage();
    let navigations = 0;
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations++; });
    await page.goto(url);
    await page.locator('.editor-fallback').fill('# draft kept across reloads');
    await page.waitForFunction(() => localStorage.getItem('balkh.playground.v1')?.includes('draft kept across reloads'));

    const html = path.join(project, 'index.html');
    const originalHtml = await fs.readFile(html, 'utf8');
    await fs.writeFile(html + '.tmp', originalHtml.replace('</body>', '<!--DEV_RELOAD_MARKER--></body>'));
    await fs.rename(html + '.tmp', html);
    await page.waitForFunction(() => document.documentElement.outerHTML.includes('DEV_RELOAD_MARKER'));
    await page.locator('.editor-fallback').waitFor();
    assert.equal(await page.locator('.editor-fallback').inputValue(), '# draft kept across reloads');

    const css = path.join(project, 'style.css');
    await fs.appendFile(css, '\n:root { --dev-test: rebuilt; }\n');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--dev-test').trim() === 'rebuilt');

    const font = path.join(project, 'assets/fonts/vazirmatn/Vazirmatn-Regular.woff2');
    const fontResponse = await fetch(new URL('assets/fonts/vazirmatn/Vazirmatn-Regular.woff2', url));
    assert.equal(fontResponse.status, 200);
    assert.equal(fontResponse.headers.get('content-type'), 'font/woff2');
    assert.equal(Buffer.from(await fontResponse.arrayBuffer()).subarray(0, 4).toString(), 'wOF2');
    const beforeFont = navigations;
    await fs.writeFile(font, await fs.readFile(font));
    await until(() => navigations > beforeFont);
    await page.locator('.editor-fallback').waitFor();
    assert.equal(await page.locator('.editor-fallback').inputValue(), '# draft kept across reloads');

    const script = path.join(project, 'app.js');
    const originalScript = await fs.readFile(script, 'utf8');
    const lastBundle = await (await fetch(new URL('app.js', url))).text();
    const beforeFailure = navigations;
    await fs.appendFile(script, '\nfunction {\n');
    await until(() => /build failed/i.test(logs));
    assert.equal(await (await fetch(url)).status, 200);
    assert.equal(await (await fetch(new URL('app.js', url))).text(), lastBundle,
      'An invalid edit must keep the last successful bundle available');
    assert.equal(navigations, beforeFailure, 'A failed build must not reload the page');

    await fs.writeFile(script, originalScript);
    await until(() => navigations > beforeFailure);
    await page.locator('.editor-fallback').waitFor();
    assert.equal(await page.locator('.editor-fallback').inputValue(), '# draft kept across reloads');

    const example = path.join(fixture, 'examples/salam.blk');
    await fs.appendFile(example, '\n# DEV_EXAMPLE_MARKER\n');
    await until(async () => (await (await fetch(new URL('examples.json', url))).text()).includes('DEV_EXAMPLE_MARKER'));
    const interpreter = path.join(fixture, 'balkh/__init__.py');
    await fs.appendFile(interpreter, '\n# DEV_PYTHON_MARKER\n');
    await until(async () => (await (await fetch(new URL('balkh/__init__.py', url))).text()).includes('DEV_PYTHON_MARKER'));
    assert.equal((await fs.readFile(path.join(playground, 'dist/index.html'), 'utf8')).includes('__dev/client.js'), false,
      'Development reload code must not be injected into the production artifact');
  } catch (error) {
    error.message += `\nDevelopment server output:\n${logs}`;
    throw error;
  } finally {
    await browser?.close();
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    // Remove the junction itself before recursively removing the fixture.
    await fs.unlink(modules).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    if (path.dirname(fixture) !== fixtures) throw new Error('Unexpected fixture cleanup path.');
    await fs.rm(fixture, { recursive: true, force: true });
  }
});
