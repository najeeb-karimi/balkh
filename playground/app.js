import { createEditor } from './editor.js';
import { applyLanguage, setLiteralText, setText, t } from './i18n.js';
import { attachNativeScrollbars } from './scrollbars.js';

const $ = id => document.getElementById(id);
const workbench = $('workbench');
const workspace = workbench.querySelector('.workspace');
const sourcePanel = workspace.querySelector('.source-panel');
const resultsPanel = $('results-panel');
const resultsResizer = $('results-resizer');
const filenameButton = $('file-name');
const filenameEditor = $('file-name-editor');
const filenameInput = $('file-name-input');
const sourceControls = sourcePanel.querySelectorAll(':scope > :not(#editor)');
const resultsControls = resultsPanel.querySelectorAll(':scope > :not(#result-viewport)');
const STORAGE_KEY = 'balkh.playground.v1';
const UI_LANGUAGE_KEY = 'balkh.playground.ui-language';
const MAX_OUTPUT = 200_000;
const MAX_FILENAME_LENGTH = 32;
const FILE_EXTENSION = '.blk';
const fallbackSource = '# سلام به بلخ!\nچاپ("سلام دنیا!")\nچاپول("سلام نړۍ!")\n';
let saved;
try {
  const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (value && value.version === 1 && typeof value.source === 'string') saved = value;
} catch { /* Private browsing, unavailable storage, and old data must not block editing. */ }
let source = saved?.source ?? fallbackSource;
let rtl = saved?.rtl !== false;
const savedFilename = normalizeFilename(saved?.filename);
let filename = savedFilename ?? 'salam.blk';
let filenameCustomized = savedFilename !== null && saved?.filenameCustomized === true;
let editor;
let samples = [];
let selectedExample = '';
const exampleNames = { salam: 'exampleHello', stdlib: 'exampleStdlib', bazi: 'exampleGame' };
let worker;
let generation = 0;
let sequence = 0;
let activeRunId = null;
let inputRequest = null;
let interactiveInput = true;
let ready = false;
let loadingTimer;
let saveTimer;
let outputLength = 0;
let outputTruncated = false;
let replacingSource = false;
let userEdited = false;
let isFullscreen = false;
let pageScrollBeforeFullscreen = 0;
let resultsMaximized = false;
let resultsHeightRatio = null;
let resultsDrag = null;
let diagnosticsLanguage = saved?.language === 'pashto' ? 'pashto' : 'dari';

let uiLanguage = 'en';
try { uiLanguage = localStorage.getItem(UI_LANGUAGE_KEY) || 'en'; } catch { /* English works without storage. */ }

function changeInterfaceLanguage(language) {
  uiLanguage = applyLanguage(language);
  editor?.setAriaLabel(t('sourceEditor'));
  updateErrorLanguageChoice();
  updateFilenameTooltip();
}

function updateErrorLanguageChoice() {
  $('language').value = diagnosticsLanguage;
  setText('error-language-name', diagnosticsLanguage);
  $('language').setAttribute('aria-label', `${t('errors')}: ${t(diagnosticsLanguage)}`);
  for (const choice of document.querySelectorAll('[data-error-language]')) {
    choice.setAttribute('aria-selected', String(choice.dataset.errorLanguage === diagnosticsLanguage));
  }
}

function closeErrorLanguageMenu(returnFocus = false) {
  $('error-language-menu').hidden = true;
  $('language').setAttribute('aria-expanded', 'false');
  if (returnFocus) $('language').focus();
}

function openErrorLanguageMenu(last = false) {
  if ($('language').disabled) return;
  $('error-language-menu').hidden = false;
  $('language').setAttribute('aria-expanded', 'true');
  const choices = [...document.querySelectorAll('[data-error-language]')];
  (last ? choices.at(-1) : choices.find(choice => choice.getAttribute('aria-selected') === 'true'))?.focus();
}

$('language').addEventListener('click', () => {
  if ($('error-language-menu').hidden) openErrorLanguageMenu();
  else closeErrorLanguageMenu();
});
for (const choice of document.querySelectorAll('[data-error-language]')) choice.addEventListener('click', () => {
  if ($('language').disabled) return;
  diagnosticsLanguage = choice.dataset.errorLanguage;
  updateErrorLanguageChoice();
  closeErrorLanguageMenu(true);
  persist();
});
document.addEventListener('click', event => {
  if (!event.target.closest('.error-language-picker')) closeErrorLanguageMenu();
});
document.querySelector('.error-language-picker').addEventListener('focusout', event => {
  if (!event.currentTarget.contains(event.relatedTarget)) closeErrorLanguageMenu();
});
document.querySelector('.error-language-picker').addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('error-language-menu').hidden) {
    closeErrorLanguageMenu(true);
    event.preventDefault();
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    if ($('error-language-menu').hidden) { openErrorLanguageMenu(event.key === 'ArrowUp' || event.key === 'End'); return; }
    const choices = [...document.querySelectorAll('[data-error-language]')];
    const index = choices.indexOf(document.activeElement);
    choices[event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 :
      (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length]?.focus();
  }
});

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

function closeExamplesMenu(returnFocus = false) {
  $('examples-menu').hidden = true;
  $('examples').setAttribute('aria-expanded', 'false');
  if (returnFocus) $('examples').focus();
}

function openExamplesMenu(last = false) {
  if ($('examples').disabled) return;
  $('examples-menu').hidden = false;
  $('examples').setAttribute('aria-expanded', 'true');
  const choices = [...$('examples-menu').querySelectorAll('[data-example]')];
  (last ? choices.at(-1) : choices.find(choice => choice.getAttribute('aria-selected') === 'true') || choices[0])?.focus();
}

function updateExampleChoice() {
  const sample = samples.find(item => item.id === selectedExample);
  if (!sample) setText('example-name', 'yourProgram');
  else if (exampleNames[sample.id]) setText('example-name', exampleNames[sample.id]);
  else setLiteralText('example-name', sample.name);
  for (const choice of $('examples-menu').querySelectorAll('[data-example]')) {
    choice.setAttribute('aria-selected', String(choice.dataset.example === selectedExample));
  }
}

function chooseExample(sample) {
  if (!editor) return;
  replacingSource = true;
  setFilename(`${sample.id.replace(/[^\w.-]/g, '_')}.blk`);
  editor.setValue(sample.source);
  replacingSource = false;
  source = sample.source;
  selectedExample = sample.id;
  updateExampleChoice();
  closeExamplesMenu(true);
  persist();
}

$('examples').addEventListener('click', () => {
  if ($('examples-menu').hidden) openExamplesMenu();
  else closeExamplesMenu();
});
document.addEventListener('click', event => {
  if (!event.target.closest('.example-picker')) closeExamplesMenu();
});
document.querySelector('.example-picker').addEventListener('focusout', event => {
  if (!event.currentTarget.contains(event.relatedTarget)) closeExamplesMenu();
});
document.querySelector('.example-picker').addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('examples-menu').hidden) {
    closeExamplesMenu(true);
    event.preventDefault();
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    if ($('examples-menu').hidden) { openExamplesMenu(event.key === 'ArrowUp' || event.key === 'End'); return; }
    const choices = [...$('examples-menu').querySelectorAll('[data-example]')];
    const index = choices.indexOf(document.activeElement);
    choices[event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 :
      (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length]?.focus();
  }
});

function normalizeFilename(value) {
  if (typeof value !== 'string') return null;
  const stem = value.trim().replace(/\.blk$/i, '').trim();
  if (!stem || stem === '.' || stem === '..' || /[<>:"\/\\|?*\x00-\x1f\x7f]/.test(stem)) return null;
  // Avoid names that Windows reserves even when an extension is present.
  if (/^(?:con|prn|aux|nul|(?:com|lpt)[1-9¹²³])(?:\.|$)/i.test(stem)) return null;
  return stem + FILE_EXTENSION;
}

function updateFilenameTooltip() {
  const hint = t('renameFileTitle');
  const truncated = !isFullscreen && filenameButton.scrollWidth > filenameButton.clientWidth;
  const title = truncated ? `${filename}\n${hint}` : hint;
  if (filenameButton.title !== title) filenameButton.title = title;
}

function setFilename(name, customized = false) {
  filename = name;
  filenameCustomized = customized;
  filenameButton.textContent = name;
  updateFilenameTooltip();
}

function startRename() {
  if (!filenameEditor.hidden) return;
  filenameInput.defaultValue = filename.slice(0, -FILE_EXTENSION.length);
  filenameInput.value = filenameInput.defaultValue;
  filenameInput.setCustomValidity('');
  filenameButton.hidden = true;
  filenameEditor.hidden = false;
  filenameInput.focus({ preventScroll: true });
  filenameInput.select();
}

function finishRename({ commit = false, returnFocus = false } = {}) {
  if (filenameEditor.hidden) return;
  if (commit && filenameInput.value !== filenameInput.defaultValue) {
    const name = normalizeFilename(filenameInput.value);
    const tooLong = name !== null && [...name].length > MAX_FILENAME_LENGTH;
    const valid = name !== null && !tooLong;
    if (!valid && returnFocus) {
      const message = tooLong ? t('filenameTooLong').replace('{max}', MAX_FILENAME_LENGTH) : t('invalidFileName');
      filenameInput.setCustomValidity(message);
      filenameInput.reportValidity();
      return;
    }
    if (valid && name !== filename) {
      setFilename(name, true);
      saveNow();
    }
  }
  filenameEditor.hidden = true;
  filenameButton.hidden = false;
  if (returnFocus) filenameButton.focus({ preventScroll: true });
}

function saveNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, source, rtl, language: diagnosticsLanguage, filename, filenameCustomized }));
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
    if (!filenameCustomized && filename !== 'program.blk') setFilename('program.blk');
    selectedExample = '';
    updateExampleChoice();
  }
  setText('save-status', 'saving');
  persist();
}

function syncControls() {
  const running = activeRunId !== null;
  $('run').disabled = !ready || running || !editor;
  $('stop').disabled = !running;
  $('download').disabled = !editor;
  $('direction').disabled = !editor;
  $('examples').disabled = !editor || samples.length === 0;
  $('language').disabled = running;
  if (running) closeErrorLanguageMenu();
  setText('run-label', running ? 'running' : 'run');
  $('run-icon').classList.toggle('is-spinning', running);
  $('run-icon').firstElementChild.setAttribute('href', running ? '#icon-loading' : '#icon-play');
}

function runtimeStatus(key, state) {
  setText('runtime-status', key);
  $('runtime-bar').classList.toggle('runtime-notice', key === 'runtimeLoading' || key === 'runtimeFailed');
  $('runtime-dot').className = `runtime-dot ${state || ''}`;
}

function panelControlsHeight(panel, controls) {
  return [...controls].reduce((height, control) => height + control.offsetHeight, panel.offsetHeight - panel.clientHeight);
}

function resizeResults(requestedHeight) {
  if (resultsResizer.hidden) return;
  const workspaceHeight = workspace.clientHeight;
  if (!workspaceHeight) return;

  const availableHeight = Math.max(0, workspaceHeight - resultsResizer.offsetHeight);
  const sourceControlsHeight = panelControlsHeight(sourcePanel, sourceControls);
  const resultsControlsHeight = panelControlsHeight(resultsPanel, resultsControls);
  const contentHeight = Math.max(0, availableHeight - sourceControlsHeight - resultsControlsHeight);
  // Reserve some space for both panes' content, even in a short browser window.
  const minContentHeight = Math.min(48, Math.floor(contentHeight / 2));
  const minHeight = Math.min(availableHeight, resultsControlsHeight + minContentHeight);
  const maxHeight = Math.max(minHeight, availableHeight - sourceControlsHeight - minContentHeight);
  const preferredHeight = requestedHeight ?? workspaceHeight * (
    resultsHeightRatio ?? parseFloat(getComputedStyle(workspace).getPropertyValue('--default-results-height')) / 100
  );
  const height = Math.round(Math.max(minHeight, Math.min(maxHeight, preferredHeight)));
  if (requestedHeight !== undefined) resultsHeightRatio = height / workspaceHeight;

  workspace.style.setProperty('--results-height', `${height}px`);
  const percent = pixels => String(Math.round(100 * pixels / workspaceHeight));
  resultsResizer.setAttribute('aria-valuemin', percent(minHeight));
  resultsResizer.setAttribute('aria-valuemax', percent(maxHeight));
  resultsResizer.setAttribute('aria-valuenow', percent(height));
}

function syncResultsLayout() {
  const fullscreenResults = isFullscreen && !resultsPanel.hidden;
  const split = fullscreenResults && !resultsMaximized;
  sourcePanel.hidden = resultsMaximized;
  resultsResizer.hidden = !split;
  workspace.classList.toggle('results-open', split);
  workspace.classList.toggle('results-maximized', resultsMaximized);
  const button = $('maximize-results');
  const key = resultsMaximized ? 'restoreResults' : 'maximizeResults';
  button.hidden = !fullscreenResults;
  setText('maximize-results-label', resultsMaximized ? 'restore' : 'maximize');
  button.dataset.i18nTitle = key;
  button.dataset.i18nAriaLabel = key;
  button.title = t(key);
  button.setAttribute('aria-label', button.title);
  button.querySelector('use').setAttribute('href', resultsMaximized ? '#icon-collapse' : '#icon-expand');
  if (split) resizeResults();
  else if (resultsDrag) {
    if (resultsResizer.hasPointerCapture(resultsDrag.id)) resultsResizer.releasePointerCapture(resultsDrag.id);
    resultsDrag = null;
  }
}

function setResultsMaximized(maximized) {
  resultsMaximized = maximized;
  syncResultsLayout();
}

function setResultsOpen(open) {
  const moveFocus = !open && (resultsPanel.contains(document.activeElement) || document.activeElement === resultsResizer);
  resultsPanel.hidden = !open;
  setResultsMaximized(isFullscreen && open && resultsMaximized);
  $('toggle-results').setAttribute('aria-expanded', String(open));
  if (moveFocus) $('toggle-results').focus({ preventScroll: true });
  if (open && inputRequest) {
    $('stdin').focus({ preventScroll: true });
    $('input-form').scrollIntoView({ block: 'nearest' });
  }
}

function setFullscreenMode(enabled) {
  if (enabled === isFullscreen) return;
  if (enabled) pageScrollBeforeFullscreen = window.scrollY;
  isFullscreen = enabled;
  workbench.classList.toggle('is-fullscreen', enabled);
  document.body.classList.toggle('workspace-fullscreen', enabled);
  const button = $('fullscreen');
  setText('fullscreen-label', enabled ? 'exitFullscreen' : 'fullscreen');
  const titleKey = enabled ? 'exitFullscreenTitle' : 'fullscreenTitle';
  button.dataset.i18nTitle = titleKey;
  button.title = t(titleKey);
  button.querySelector('use').setAttribute('href', enabled ? '#icon-collapse' : '#icon-expand');
  $('toggle-results').hidden = !enabled;
  setResultsOpen(!enabled || !!inputRequest);
  updateFilenameTooltip();
  if (enabled && !inputRequest && editor) editor.focus();
  if (!enabled) {
    if (!inputRequest) button.focus({ preventScroll: true });
    window.scrollTo(0, pageScrollBeforeFullscreen);
  }
}

function closeInput() {
  inputRequest = null;
  $('input-form').hidden = true;
  $('stdin').value = '';
}

function requestInput(message) {
  if (activeRunId === null || !Number.isSafeInteger(message.requestId)) return;
  inputRequest = { id: activeRunId, requestId: message.requestId };
  $('output-placeholder').hidden = true;
  $('output').hidden = false;
  $('input-form').hidden = false;
  runtimeStatus('waitingInput', 'waiting');
  setText('run-status', 'waitingInput');
  setResultsOpen(true);
}

function sendInput(eof = false) {
  if (!inputRequest || activeRunId !== inputRequest.id) return;
  const request = inputRequest;
  const value = $('stdin').value;
  if (!eof) appendOutput(`${value}\n`, 'stdin');
  closeInput();
  runtimeStatus('runtimeRunning', 'loading');
  setText('run-status', 'running');
  try { worker.postMessage({ type: 'input-response', ...request, value, eof }); }
  catch (error) { failRuntime(error.message); }
}

function clearOutput() {
  $('output').replaceChildren();
  outputLength = 0;
  outputTruncated = false;
  $('output').hidden = !inputRequest;
  $('output-placeholder').hidden = !!inputRequest;
}

function appendOutput(text, stream = 'stdout', { isolate = false } = {}) {
  if (typeof text !== 'string' || !text || outputTruncated) return;
  $('output').hidden = false;
  $('output-placeholder').hidden = true;
  const available = MAX_OUTPUT - outputLength;
  const slice = text.slice(0, available);
  outputLength += slice.length;
  const last = $('output').lastElementChild;
  if (!isolate && last?.localName === 'span' && last.className === stream) last.append(document.createTextNode(slice));
  else {
    const chunk = document.createElement(isolate ? 'bdi' : 'span');
    chunk.className = stream === 'stderr' ? 'stderr' : stream === 'stdin' ? 'stdin' : 'stdout';
    chunk.textContent = slice;
    $('output').append(chunk);
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
  closeInput();
  clearTimeout(loadingTimer);
  generation++;
  worker?.terminate();
  worker = null;
  ready = false;
  activeRunId = null;
  runtimeStatus('runtimeFailed', 'error');
  setText('runtime-note', 'failedNote');
  $('retry').hidden = false;
  setText('run-status', 'runtimeUnavailable');
  appendOutput(`${message}\n`, 'stderr');
  syncControls();
}

function startRuntime() {
  closeInput();
  worker?.terminate();
  const current = ++generation;
  ready = false;
  activeRunId = null;
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
        interactiveInput = message.interactiveInput !== false;
        setText('runtime-note', interactiveInput ? 'readyNote' : 'inputUnsupported');
        syncControls();
        return;
      }
      if (message.type === 'error' && message.id == null) {
        failRuntime(message.message || t('runtimeLoadError'));
        return;
      }
      if (activeRunId === null || message.id !== activeRunId) return;
      if (message.type === 'output') appendOutput(message.text, message.stream);
      else if (message.type === 'input') requestInput(message);
      else if (message.type === 'result' || message.type === 'error') {
        closeInput();
        activeRunId = null;
        const success = message.type === 'result' && message.ok !== false;
        if (message.type === 'error') appendOutput(`${message.message || t('requestFailed')}\n`, 'stderr');
        if (outputLength === 0) appendOutput(`${t(success ? 'noOutput' : 'programFailed')}\n`, success ? 'stdout' : 'stderr');
        setText('run-status', success ? 'finished' : 'finishedError');
        runtimeStatus('runtimeReady', '');
        syncControls();
      }
    };
    worker.postMessage({ type: 'init' });
  } catch (error) { failRuntime(error.message); }
}

function execute() {
  if (!ready || activeRunId !== null || !editor) return;
  source = editor.getValue();
  activeRunId = ++sequence;
  closeInput();
  if (isFullscreen) setResultsOpen(true);
  clearOutput();
  setText('run-status', 'running');
  runtimeStatus('runtimeRunning', 'loading');
  syncControls();
  try { worker.postMessage({ type: 'run', id: activeRunId, source, language: diagnosticsLanguage }); }
  catch (error) { failRuntime(error.message); }
}

function stop() {
  if (activeRunId === null) return;
  closeInput();
  // Terminating the dedicated worker also interrupts Python loops that never yield.
  generation++;
  worker?.terminate();
  worker = null;
  activeRunId = null;
  appendOutput(`\n${t('programStopped')}\n`, 'stderr', { isolate: true });
  setText('run-status', 'restarting');
  startRuntime();
}

async function loadExamples() {
  try {
    const response = await fetch('./examples.json');
    if (!response.ok) throw new Error('Examples could not be loaded.');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('The examples list is invalid.');
    samples = data.filter(sample => sample && typeof sample.id === 'string' && typeof sample.name === 'string' && typeof sample.source === 'string');
    const choices = samples.map(sample => {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.setAttribute('role', 'option');
      choice.tabIndex = -1;
      choice.dataset.example = sample.id;
      if (exampleNames[sample.id]) choice.dataset.i18n = exampleNames[sample.id];
      choice.textContent = exampleNames[sample.id] ? t(exampleNames[sample.id]) : sample.name;
      choice.addEventListener('click', () => chooseExample(sample));
      return choice;
    });
    $('examples-menu').replaceChildren(...choices);
    const salam = samples.find(sample => sample.id === 'salam') || samples[0];
    if (!saved && !userEdited && salam) {
      source = salam.source;
      if (!filenameCustomized) setFilename(`${salam.id.replace(/[^\w.-]/g, '_')}.blk`);
      if (editor) {
        replacingSource = true;
        editor.setValue(source);
        replacingSource = false;
      }
      selectedExample = salam.id;
      persist();
    } else {
      const matching = samples.find(sample => sample.source === source);
      if (matching) selectedExample = matching.id;
    }
    updateExampleChoice();
    syncControls();
  } catch {
    setText('example-name', 'examplesUnavailable');
    closeExamplesMenu();
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
  const container = $('editor');
  const setDirection = value => {
    textarea.dir = value ? 'rtl' : 'ltr';
    container.dataset.editorDirection = textarea.dir;
  };
  setDirection(rtl);
  textarea.addEventListener('input', () => sourceChanged(textarea.value));
  container.replaceChildren(textarea);
  const updateScrollbars = attachNativeScrollbars(container, textarea);
  setText('save-status', 'fallbackEditor');
  return {
    getValue: () => textarea.value,
    setValue(value) { textarea.value = value; updateScrollbars(); sourceChanged(value); },
    setDirection,
    setAriaLabel: value => textarea.setAttribute('aria-label', value),
    focus: () => textarea.focus(),
  };
}

filenameButton.textContent = filename;
new ResizeObserver(updateFilenameTooltip).observe(filenameButton);
filenameButton.addEventListener('pointerenter', updateFilenameTooltip);
filenameButton.addEventListener('dblclick', startRename);
filenameButton.addEventListener('click', event => {
  if (event.detail === 0 || event.pointerType === 'touch') startRename();
});
filenameInput.addEventListener('input', () => filenameInput.setCustomValidity(''));
filenameInput.addEventListener('blur', () => finishRename({ commit: true }));
filenameInput.addEventListener('keydown', event => {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || !['Enter', 'Escape'].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  finishRename({ commit: event.key === 'Enter', returnFocus: true });
});
$('direction-label').textContent = rtl ? 'RTL' : 'LTR';
$('direction-icon').firstElementChild.setAttribute('href', rtl ? '#icon-align-right' : '#icon-align-left');
$('direction').setAttribute('aria-pressed', String(rtl));
$('fullscreen').addEventListener('click', () => setFullscreenMode(!isFullscreen));
$('toggle-results').addEventListener('click', () => setResultsOpen(resultsPanel.hidden));
$('maximize-results').addEventListener('click', () => setResultsMaximized(!resultsMaximized));
const resultsResizeObserver = new ResizeObserver(() => resizeResults());
for (const element of [workspace, resultsResizer, ...sourceControls, ...resultsControls]) {
  resultsResizeObserver.observe(element);
}
resultsResizer.addEventListener('pointerdown', event => {
  if (event.button !== 0 || resultsDrag) return;
  resultsDrag = { id: event.pointerId, y: event.clientY, height: resultsPanel.offsetHeight };
  resultsResizer.setPointerCapture(event.pointerId);
  resultsResizer.focus({ preventScroll: true });
  event.preventDefault();
});
resultsResizer.addEventListener('pointermove', event => {
  if (event.pointerId === resultsDrag?.id) resizeResults(resultsDrag.height + resultsDrag.y - event.clientY);
});
resultsResizer.addEventListener('lostpointercapture', event => {
  if (event.pointerId === resultsDrag?.id) resultsDrag = null;
});
resultsResizer.addEventListener('keydown', event => {
  const step = { ArrowUp: 32, ArrowDown: -32, Home: -Infinity, End: Infinity }[event.key];
  if (step === undefined) return;
  event.preventDefault();
  resizeResults(resultsPanel.offsetHeight + step);
});
$('run').addEventListener('click', execute);
$('stop').addEventListener('click', stop);
$('retry').addEventListener('click', startRuntime);
$('clear-output').addEventListener('click', clearOutput);
$('direction').addEventListener('click', () => {
  rtl = !rtl;
  editor?.setDirection(rtl);
  $('direction-label').textContent = rtl ? 'RTL' : 'LTR';
  $('direction-icon').firstElementChild.setAttribute('href', rtl ? '#icon-align-right' : '#icon-align-left');
  $('direction').setAttribute('aria-pressed', String(rtl));
  persist();
});
$('input-form').addEventListener('submit', event => { event.preventDefault(); sendInput(); });
$('input-eof').addEventListener('click', () => sendInput(true));
attachNativeScrollbars($('result-viewport'), $('output-panel'));
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
  if (event.isComposing) return;
  if (event.key === 'Enter' && event.shiftKey && !event.altKey && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) stop();
    return;
  }
  if (!isFullscreen || !event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  if (event.code !== 'KeyJ' && event.code !== 'Backquote' && !['j', '`'].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat) setResultsOpen(resultsPanel.hidden);
}, { capture: true });
document.addEventListener('keydown', event => {
  if (isFullscreen && !event.defaultPrevented && event.key === 'Escape') {
    if (!event.repeat) {
      if (resultsMaximized) setResultsMaximized(false);
      else setFullscreenMode(false);
    }
    return;
  }
  if (!event.shiftKey && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    execute();
  }
});
window.addEventListener('pagehide', () => {
  closeInput();
  saveNow();
  generation++;
  worker?.terminate();
  worker = null;
  ready = false;
  activeRunId = null;
  clearTimeout(loadingTimer);
  syncControls();
});
window.addEventListener('pageshow', event => { if (event.persisted) startRuntime(); });

loadExamples();
startRuntime();
createEditor($('editor'), { source, rtl, ariaLabel: t('sourceEditor'), onChange: sourceChanged, onRun: execute }).then(value => {
  editor = value;
  editor.setAriaLabel(t('sourceEditor'));
  if (editor.getValue() !== source) { replacingSource = true; editor.setValue(source); replacingSource = false; }
  syncControls();
}).catch(error => {
  console.warn('The enhanced editor could not start; using the basic editor.', error);
  editor = createFallback();
  syncControls();
});
