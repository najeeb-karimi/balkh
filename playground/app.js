import { createEditor } from './editor.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'balkh.playground.v1';
const MAX_OUTPUT = 200_000;
const fallbackSource = '# سلام به بلخ!\nچاپ("سلام دنیا!")\nچاپول("سلام نړۍ!")\n';
let saved;
try {
  const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (value && value.version === 1 && typeof value.source === 'string') saved = value;
} catch { /* Private browsing, unavailable storage, and old data must not block editing. */ }
let source = saved?.source ?? fallbackSource;
let rtl = saved?.rtl !== false;
let filename = typeof saved?.filename === 'string' && /^[\w.-]+\.blk$/.test(saved.filename) ? saved.filename : 'salam.blk';
let editor;
let samples = [];
let worker;
let generation = 0;
let sequence = 0;
let active = null;
let ready = false;
let loadingTimer;
let saveTimer;
let outputLength = 0;
let outputTruncated = false;
let pythonSource = null;
let selectedView = 'output';
let replacingSource = false;
let userEdited = false;
if (saved?.language === 'pashto') $('language').value = 'pashto';

function saveNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, source, rtl, language: $('language').value, filename }));
    $('save-status').textContent = 'Saved in this browser';
  } catch { $('save-status').textContent = 'Local saving unavailable · download to keep your code'; }
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}

function sourceChanged(value) {
  source = value;
  if (!replacingSource) {
    userEdited = true;
    filename = 'program.blk';
    $('examples').value = '';
    $('file-name').textContent = filename;
  }
  if (pythonSource !== source) {
    pythonSource = null;
    if (selectedView === 'python') $('python').textContent = 'Source changed. Select Python preview again to refresh.';
  }
  $('save-status').textContent = 'Saving…';
  persist();
}

function syncControls() {
  $('run').disabled = !ready || !!active || !editor;
  $('stop').disabled = !active;
  $('download').disabled = !editor;
  $('direction').disabled = !editor;
  $('examples').disabled = !editor || samples.length === 0;
  $('language').disabled = !!active;
  $('python-tab').setAttribute('aria-disabled', String(!ready || !!active || !editor));
  $('run').innerHTML = active?.type === 'run' ? '<span aria-hidden="true">▶</span> Running…' : '<span aria-hidden="true">▶</span> Run code';
}

function runtimeStatus(text, state) {
  $('runtime-status').textContent = text;
  $('runtime-dot').className = `runtime-dot ${state || ''}`;
}

function clearOutput() {
  $('output').replaceChildren();
  outputLength = 0;
  outputTruncated = false;
  $('output').hidden = true;
  $('output-placeholder').hidden = false;
}

function appendOutput(text, stream = 'stdout') {
  if (typeof text !== 'string' || !text || outputTruncated) return;
  $('output').hidden = false;
  $('output-placeholder').hidden = true;
  const available = MAX_OUTPUT - outputLength;
  const slice = text.slice(0, available);
  outputLength += slice.length;
  const last = $('output').lastElementChild;
  if (last && last.className === stream) last.append(document.createTextNode(slice));
  else {
    const span = document.createElement('span');
    span.className = stream === 'stderr' ? 'stderr' : 'stdout';
    span.textContent = slice;
    $('output').append(span);
  }
  if (text.length > available) {
    outputTruncated = true;
    $('output').append(document.createTextNode('\n[Output limit reached. Stop the program if it keeps running.]\n'));
  }
  // Keep the view at the latest output unless the reader has scrolled upward.
  const panel = $('output-panel');
  if (panel.scrollHeight - panel.clientHeight - panel.scrollTop < 100 + text.length / 20) panel.scrollTop = panel.scrollHeight;
}

function failRuntime(message) {
  clearTimeout(loadingTimer);
  generation++;
  worker?.terminate();
  worker = null;
  ready = false;
  active = null;
  runtimeStatus('Python could not start', 'error');
  $('runtime-note').textContent = 'Check your connection and retry. Your source is kept here.';
  $('retry').hidden = false;
  $('run-status').textContent = 'Runtime unavailable';
  appendOutput(`${message}\n`, 'stderr');
  syncControls();
}

function startRuntime() {
  worker?.terminate();
  const current = ++generation;
  ready = false;
  active = null;
  $('retry').hidden = true;
  runtimeStatus('Loading the Python runtime…', 'loading');
  $('runtime-note').textContent = 'The first visit downloads Python. Your code stays in this browser.';
  syncControls();
  clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => { if (generation === current && !ready) failRuntime('Loading timed out. Python needs a working connection to its runtime CDN. Please retry.'); }, 120_000);
  try {
    worker = new Worker(new URL('./worker.js', document.baseURI), { type: 'module' });
    worker.onerror = event => {
      if (current !== generation) return;
      event.preventDefault();
      failRuntime(event.message || 'The Python worker stopped unexpectedly. Please retry.');
    };
    worker.onmessageerror = () => { if (current === generation) failRuntime('The Python worker returned an unreadable response. Please retry.'); };
    worker.onmessage = ({ data: message }) => {
      if (current !== generation || !message || typeof message !== 'object') return;
      if (message.type === 'ready') {
        clearTimeout(loadingTimer);
        ready = true;
        runtimeStatus('Python is ready', '');
        $('runtime-note').textContent = 'Your code runs locally. Each run starts with fresh variables.';
        syncControls();
        return;
      }
      if (message.type === 'error' && message.id == null) {
        failRuntime(message.message || 'The Python runtime could not be loaded. Please retry.');
        return;
      }
      if (!active || message.id !== active.id) return;
      if (message.type === 'output') appendOutput(message.text, message.stream);
      else if (message.type === 'result' || message.type === 'error') {
        const finished = active;
        active = null;
        if (typeof message.python === 'string') {
          $('python').textContent = finished.source === source ? message.python : 'Source changed. Select Python preview again to refresh.';
          pythonSource = finished.source === source ? source : null;
        }
        const success = message.type === 'result' && message.ok !== false;
        if (message.type === 'error') appendOutput(`${message.message || 'The request failed.'}\n`, 'stderr');
        if (finished.type === 'run' && outputLength === 0) appendOutput(success ? 'Program finished with no output.\n' : 'Program failed.\n', success ? 'stdout' : 'stderr');
        $('run-status').textContent = success ? (finished.type === 'run' ? 'Finished successfully' : 'Python preview updated') : (finished.type === 'run' ? 'Finished with an error' : 'Translation failed');
        $('result-label').textContent = success ? (finished.type === 'run' ? 'Run complete' : 'Translation complete') : 'Check the output';
        runtimeStatus('Python is ready', '');
        if (!success && finished.type === 'translate') selectView('output', false);
        syncControls();
      }
    };
    worker.postMessage({ type: 'init' });
  } catch (error) { failRuntime(error.message); }
}

function execute(type) {
  if (!ready || active || !editor) return;
  source = editor.getValue();
  active = { type, id: ++sequence, source };
  if (type === 'run') {
    selectView('output', false);
    clearOutput();
    $('run-status').textContent = 'Running…';
    $('result-label').textContent = 'Running your code';
  } else {
    $('python').textContent = 'Translating…';
    $('run-status').textContent = 'Translating…';
  }
  runtimeStatus(type === 'run' ? 'Running your program…' : 'Translating your source…', 'loading');
  syncControls();
  try { worker.postMessage({ type, id: active.id, source, language: $('language').value, stdin: $('stdin').value }); }
  catch (error) { failRuntime(error.message); }
}

function selectView(view, translate = true) {
  selectedView = view;
  for (const name of ['output', 'python']) {
    const selected = name === view;
    $(`${name}-tab`).setAttribute('aria-selected', String(selected));
    $(`${name}-tab`).tabIndex = selected ? 0 : -1;
    $(`${name}-panel`).hidden = !selected;
  }
  if (view === 'python' && translate && pythonSource !== source) execute('translate');
}

function stop() {
  if (!active) return;
  const type = active.type;
  // Terminating the dedicated worker also interrupts Python loops that never yield.
  generation++;
  worker?.terminate();
  worker = null;
  active = null;
  appendOutput(type === 'run' ? '\n[Program stopped.]\n' : '\n[Translation stopped.]\n', 'stderr');
  $('run-status').textContent = 'Stopped · starting a fresh Python session';
  $('result-label').textContent = 'Stopped';
  startRuntime();
}

async function loadExamples() {
  try {
    const response = await fetch('./examples.json');
    if (!response.ok) throw new Error('Examples could not be loaded.');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('The examples list is invalid.');
    samples = data.filter(sample => sample && typeof sample.id === 'string' && typeof sample.name === 'string' && typeof sample.source === 'string');
    $('examples').replaceChildren(new Option('Your program', ''));
    for (const sample of samples) $('examples').append(new Option(sample.name, sample.id));
    const salam = samples.find(sample => sample.id === 'salam') || samples[0];
    if (!saved && !userEdited && salam) {
      source = salam.source;
      filename = `${salam.id.replace(/[^\w.-]/g, '_')}.blk`;
      if (editor) {
        replacingSource = true;
        editor.setValue(source);
        replacingSource = false;
      }
      $('examples').value = salam.id;
      $('file-name').textContent = filename;
      persist();
    } else {
      const matching = samples.find(sample => sample.source === source);
      if (matching) $('examples').value = matching.id;
    }
    syncControls();
  } catch {
    $('examples').replaceChildren(new Option('Examples unavailable', ''));
    $('examples').disabled = true;
  }
}

function createFallback() {
  const textarea = document.createElement('textarea');
  textarea.className = 'editor-fallback';
  textarea.setAttribute('aria-label', 'Balkh source editor');
  textarea.spellcheck = false;
  textarea.value = source;
  textarea.dir = rtl ? 'rtl' : 'ltr';
  textarea.addEventListener('input', () => sourceChanged(textarea.value));
  $('editor').replaceChildren(textarea);
  $('save-status').textContent = 'Basic editor · syntax highlighting unavailable';
  return { getValue: () => textarea.value, setValue: value => { textarea.value = value; sourceChanged(value); }, setDirection: value => { textarea.dir = value ? 'rtl' : 'ltr'; }, focus: () => textarea.focus() };
}

$('file-name').textContent = filename;
$('direction').textContent = rtl ? 'RTL ⇄' : 'LTR ⇄';
$('direction').setAttribute('aria-pressed', String(rtl));
$('run').addEventListener('click', () => execute('run'));
$('stop').addEventListener('click', stop);
$('retry').addEventListener('click', startRuntime);
$('clear-output').addEventListener('click', clearOutput);
$('output-tab').addEventListener('click', () => selectView('output'));
$('python-tab').addEventListener('click', () => selectView('python'));
for (const id of ['output-tab', 'python-tab']) $(id).addEventListener('keydown', event => {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const view = event.key === 'Home' ? 'output' : event.key === 'End' ? 'python' : selectedView === 'output' ? 'python' : 'output';
    selectView(view);
    $(`${view}-tab`).focus();
  }
});
$('direction').addEventListener('click', () => {
  rtl = !rtl;
  editor?.setDirection(rtl);
  $('direction').textContent = rtl ? 'RTL ⇄' : 'LTR ⇄';
  $('direction').setAttribute('aria-pressed', String(rtl));
  persist();
});
$('language').addEventListener('change', persist);
$('input-toggle').addEventListener('click', () => {
  const opening = $('input-panel').hidden;
  $('input-panel').hidden = !opening;
  $('input-toggle').setAttribute('aria-expanded', String(opening));
  if (opening) $('stdin').focus();
});
$('examples').addEventListener('change', () => {
  const sample = samples.find(item => item.id === $('examples').value);
  if (!sample || !editor) return;
  replacingSource = true;
  filename = `${sample.id.replace(/[^\w.-]/g, '_')}.blk`;
  editor.setValue(sample.source);
  replacingSource = false;
  source = sample.source;
  $('file-name').textContent = filename;
  persist();
});
$('download').addEventListener('click', () => {
  if (!editor) return;
  const url = URL.createObjectURL(new Blob([editor.getValue()], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    execute('run');
  }
});
window.addEventListener('pagehide', () => {
  saveNow();
  generation++;
  worker?.terminate();
  worker = null;
  ready = false;
  active = null;
  clearTimeout(loadingTimer);
  syncControls();
});
window.addEventListener('pageshow', event => { if (event.persisted) startRuntime(); });

loadExamples();
startRuntime();
createEditor($('editor'), { source, rtl, onChange: sourceChanged, onRun: () => execute('run') }).then(value => {
  editor = value;
  if (editor.getValue() !== source) { replacingSource = true; editor.setValue(source); replacingSource = false; }
  syncControls();
}).catch(error => {
  console.warn('The enhanced editor could not start; using the basic editor.', error);
  editor = createFallback();
  syncControls();
});
