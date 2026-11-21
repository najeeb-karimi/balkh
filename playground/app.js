import { createEditor } from './editor.js';
import { applyLanguage, setLiteralText, setText, t } from './i18n.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'balkh.playground.v1';
const UI_LANGUAGE_KEY = 'balkh.playground.ui-language';
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
let uiLanguage = 'en';
try { uiLanguage = localStorage.getItem(UI_LANGUAGE_KEY) || 'en'; } catch { /* English works without storage. */ }

function changeInterfaceLanguage(language) {
  uiLanguage = applyLanguage(language);
  editor?.setAriaLabel(t('sourceEditor'));
}

function closeLanguageMenu(returnFocus = false) {
  $('ui-language-menu').hidden = true;
  $('ui-language-toggle').setAttribute('aria-expanded', 'false');
  if (returnFocus) $('ui-language-toggle').focus();
}

$('ui-language-toggle').addEventListener('click', () => {
  const opening = $('ui-language-menu').hidden;
  $('ui-language-menu').hidden = !opening;
  $('ui-language-toggle').setAttribute('aria-expanded', String(opening));
  if (opening) $('ui-language-menu').querySelector('[aria-pressed="true"]').focus();
});
for (const button of document.querySelectorAll('[data-ui-language]')) button.addEventListener('click', () => {
  changeInterfaceLanguage(button.dataset.uiLanguage);
  try { localStorage.setItem(UI_LANGUAGE_KEY, uiLanguage); } catch { /* Still switch for this visit. */ }
  closeLanguageMenu(true);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.language-switcher')) closeLanguageMenu();
});
document.querySelector('.language-switcher').addEventListener('focusout', event => {
  if (!event.currentTarget.contains(event.relatedTarget)) closeLanguageMenu();
});
document.querySelector('.language-switcher').addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeLanguageMenu(true); event.preventDefault(); }
  if (!$('ui-language-menu').hidden && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const choices = [...document.querySelectorAll('[data-ui-language]')];
    const index = choices.indexOf(document.activeElement);
    choices[event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 :
      (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length].focus();
  }
});
changeInterfaceLanguage(uiLanguage);

function saveNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, source, rtl, language: $('language').value, filename }));
    setText('save-status', 'saved');
  } catch { setText('save-status', 'saveUnavailable'); }
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
    if (selectedView === 'python') setText('python', 'previewStale');
  }
  setText('save-status', 'saving');
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
  const running = active?.type === 'run';
  setText('run-label', running ? 'running' : 'run');
  $('run-icon').classList.toggle('is-spinning', running);
  $('run-icon').firstElementChild.setAttribute('href', running ? '#icon-loading' : '#icon-play');
}

function runtimeStatus(key, state) {
  setText('runtime-status', key);
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
    $('output').append(document.createTextNode(`\n${t('outputLimit')}\n`));
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
  runtimeStatus('runtimeFailed', 'error');
  setText('runtime-note', 'failedNote');
  $('retry').hidden = false;
  setText('run-status', 'runtimeUnavailable');
  appendOutput(`${message}\n`, 'stderr');
  syncControls();
}

function startRuntime() {
  worker?.terminate();
  const current = ++generation;
  ready = false;
  active = null;
  $('retry').hidden = true;
  runtimeStatus('runtimeLoading', 'loading');
  setText('runtime-note', 'loadingNote');
  syncControls();
  clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => { if (generation === current && !ready) failRuntime(t('timeout')); }, 120_000);
  try {
    worker = new Worker(new URL('./worker.js', document.baseURI), { type: 'module' });
    worker.onerror = event => {
      if (current !== generation) return;
      event.preventDefault();
      failRuntime(event.message || t('workerStopped'));
    };
    worker.onmessageerror = () => { if (current === generation) failRuntime(t('unreadableResponse')); };
    worker.onmessage = ({ data: message }) => {
      if (current !== generation || !message || typeof message !== 'object') return;
      if (message.type === 'ready') {
        clearTimeout(loadingTimer);
        ready = true;
        runtimeStatus('runtimeReady', '');
        setText('runtime-note', 'readyNote');
        syncControls();
        return;
      }
      if (message.type === 'error' && message.id == null) {
        failRuntime(message.message || t('runtimeLoadError'));
        return;
      }
      if (!active || message.id !== active.id) return;
      if (message.type === 'output') appendOutput(message.text, message.stream);
      else if (message.type === 'result' || message.type === 'error') {
        const finished = active;
        active = null;
        if (typeof message.python === 'string') {
          if (finished.source === source) setLiteralText('python', message.python);
          else setText('python', 'previewStale');
          pythonSource = finished.source === source ? source : null;
        }
        const success = message.type === 'result' && message.ok !== false;
        if (message.type === 'error') appendOutput(`${message.message || t('requestFailed')}\n`, 'stderr');
        if (finished.type === 'run' && outputLength === 0) appendOutput(`${t(success ? 'noOutput' : 'programFailed')}\n`, success ? 'stdout' : 'stderr');
        setText('run-status', success ? (finished.type === 'run' ? 'finished' : 'previewUpdated') : (finished.type === 'run' ? 'finishedError' : 'translationFailed'));
        setText('result-label', success ? (finished.type === 'run' ? 'runComplete' : 'translationComplete') : 'checkOutput');
        runtimeStatus('runtimeReady', '');
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
    setText('run-status', 'running');
    setText('result-label', 'runningCode');
  } else {
    setText('python', 'translating');
    setText('run-status', 'translating');
  }
  runtimeStatus(type === 'run' ? 'runtimeRunning' : 'runtimeTranslating', 'loading');
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
  appendOutput(`\n${t(type === 'run' ? 'programStopped' : 'translationStopped')}\n`, 'stderr');
  setText('run-status', 'restarting');
  setText('result-label', 'stopped');
  startRuntime();
}

async function loadExamples() {
  try {
    const response = await fetch('./examples.json');
    if (!response.ok) throw new Error('Examples could not be loaded.');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('The examples list is invalid.');
    samples = data.filter(sample => sample && typeof sample.id === 'string' && typeof sample.name === 'string' && typeof sample.source === 'string');
    const option = (key, value, fallback) => {
      const item = new Option(key ? t(key) : fallback, value);
      if (key) item.dataset.i18n = key;
      return item;
    };
    $('examples').replaceChildren(option('yourProgram', ''));
    const names = { salam: 'exampleHello', stdlib: 'exampleStdlib', bazi: 'exampleGame' };
    for (const sample of samples) $('examples').append(option(names[sample.id], sample.id, sample.name));
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
    const option = new Option(t('examplesUnavailable'), '');
    option.dataset.i18n = 'examplesUnavailable';
    $('examples').replaceChildren(option);
    $('examples').disabled = true;
  }
}

function createFallback() {
  const textarea = document.createElement('textarea');
  textarea.className = 'editor-fallback';
  textarea.setAttribute('aria-label', t('sourceEditor'));
  textarea.dataset.i18nAriaLabel = 'sourceEditor';
  textarea.spellcheck = false;
  textarea.value = source;
  textarea.dir = rtl ? 'rtl' : 'ltr';
  textarea.addEventListener('input', () => sourceChanged(textarea.value));
  $('editor').replaceChildren(textarea);
  setText('save-status', 'fallbackEditor');
  return { getValue: () => textarea.value, setValue: value => { textarea.value = value; sourceChanged(value); }, setDirection: value => { textarea.dir = value ? 'rtl' : 'ltr'; }, setAriaLabel: value => textarea.setAttribute('aria-label', value), focus: () => textarea.focus() };
}

$('file-name').textContent = filename;
$('direction-label').textContent = rtl ? 'RTL' : 'LTR';
$('direction-icon').firstElementChild.setAttribute('href', rtl ? '#icon-align-right' : '#icon-align-left');
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
  $('direction-label').textContent = rtl ? 'RTL' : 'LTR';
  $('direction-icon').firstElementChild.setAttribute('href', rtl ? '#icon-align-right' : '#icon-align-left');
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
createEditor($('editor'), { source, rtl, ariaLabel: t('sourceEditor'), onChange: sourceChanged, onRun: () => execute('run') }).then(value => {
  editor = value;
  editor.setAriaLabel(t('sourceEditor'));
  if (editor.getValue() !== source) { replacingSource = true; editor.setValue(source); replacingSource = false; }
  syncControls();
}).catch(error => {
  console.warn('The enhanced editor could not start; using the basic editor.', error);
  editor = createFallback();
  syncControls();
});
