(() => {
  const vscode = acquireVsCodeApi();
  const output = document.getElementById('output');
  const scroll = document.getElementById('scroll');
  const direction = document.getElementById('direction');
  let currentDirection = 'rtl';
  window.addEventListener('message', ({ data }) => {
    if (!data || !['snapshot', 'append'].includes(data.type) || typeof data.text !== 'string') return;
    const atBottom = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop < 32;
    if (data.type === 'snapshot') output.textContent = data.text;
    else {
      if (!output.firstChild) output.appendChild(document.createTextNode(''));
      output.firstChild.appendData(data.text);
      if (data.trim) output.firstChild.deleteData(0, data.trim);
    }
    currentDirection = data.direction === 'ltr' ? 'ltr' : 'rtl';
    scroll.dir = currentDirection;
    direction.textContent = currentDirection.toUpperCase();
    direction.setAttribute('aria-label', `Switch to ${currentDirection === 'rtl' ? 'LTR' : 'RTL'}`);
    document.getElementById('stop').disabled = !data.running;
    document.getElementById('empty').hidden = !!output.textContent;
    document.getElementById('notice').hidden = !data.truncated;
    if (atBottom || data.type === 'snapshot') scroll.scrollTop = scroll.scrollHeight;
  });
  direction.addEventListener('click', () => vscode.postMessage({ type: 'direction', value: currentDirection === 'rtl' ? 'ltr' : 'rtl' }));
  for (const type of ['copy', 'clear', 'stop']) {
    document.getElementById(type).addEventListener('click', () => vscode.postMessage({ type }));
  }
  vscode.postMessage({ type: 'ready' });
})();
