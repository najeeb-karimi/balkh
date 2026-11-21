/* The page can terminate this worker even while Python is in an infinite loop. */
"use strict";

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.8/full/";
const PYTHON_ROOT = "/home/pyodide";
let runtime = null;
let runner = null;
let initializing = null;
let busy = false;

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return response.text();
}

async function initialize() {
  const { loadPyodide } = await import(`${PYODIDE_URL}pyodide.mjs`);
  runtime = await loadPyodide({ indexURL: PYODIDE_URL });
  const manifest = JSON.parse(await fetchText("./balkh/manifest.json"));
  if (!Array.isArray(manifest) || !manifest.length) {
    throw new Error("The Balkh package manifest is empty or invalid.");
  }
  await Promise.all(manifest.map(async (path) => {
    // The manifest is generated locally. Validate it before using filesystem paths.
    // Include Unicode module filenames without allowing traversal or URL syntax.
    if (typeof path !== "string" || !/^(?:[\p{L}\p{M}\p{N}_-]+\/)*[\p{L}\p{M}\p{N}_-]+\.py$/u.test(path)) {
      throw new Error("The Balkh package manifest contains an invalid path.");
    }
    const contents = await fetchText(`./balkh/${path}`);
    const destination = `${PYTHON_ROOT}/balkh/${path}`;
    runtime.FS.mkdirTree(destination.slice(0, destination.lastIndexOf("/")));
    runtime.FS.writeFile(destination, contents, { encoding: "utf8" });
  }));
  runtime.FS.writeFile(`${PYTHON_ROOT}/playground_runner.py`,
    await fetchText("./runner.py"), { encoding: "utf8" });
  runner = runtime.pyimport("playground_runner");
}

self.onmessage = async ({ data }) => {
  const id = data && data.id;
  try {
    if (data && data.type === "init") {
      initializing ||= initialize();
      await initializing;
      self.postMessage({ type: "ready" });
      return;
    }
    if (!data || !["run", "translate"].includes(data.type)) {
      throw new Error("Unknown playground request.");
    }
    if (!runner) throw new Error("The Python runtime is not ready.");
    if (busy) throw new Error("A program is already running.");
    if (typeof data.source !== "string" || !["dari", "pashto"].includes(data.language) ||
        (data.type === "run" && typeof data.stdin !== "string")) {
      throw new Error("Invalid playground request.");
    }
    busy = true;
    // Batch adjacent tiny writes to reduce messages from print-heavy loops.
    // Flush synchronously during execution; worker timers cannot run while
    // Python holds this thread.
    let pending = [];
    let pendingSize = 0;
    let sentOutput = false;
    let lastFlush = performance.now();
    const flush = () => {
      if (pending.length) sentOutput = true;
      for (const chunk of pending) self.postMessage({ type: "output", id, ...chunk });
      pending = [];
      pendingSize = 0;
      lastFlush = performance.now();
    };
    const emit = (stream, text) => {
      const previous = pending[pending.length - 1];
      if (previous && previous.stream === stream) previous.text += text;
      else pending.push({ stream, text });
      pendingSize += text.length;
      // Show an initial completed line promptly, then batch subsequent lines.
      // Flushing every newline turns a short print loop into tens of thousands
      // of worker messages and DOM updates despite the output character cap.
      if ((!sentOutput && text.includes("\n")) || pendingSize >= 4096 || performance.now() - lastFlush >= 16) flush();
    };
    let result;
    try {
      result = data.type === "run"
        ? runner.run(data.source, data.language, data.stdin, emit, flush)
        : runner.translate(data.source, data.language, emit, flush);
      const value = result.toJs({ dict_converter: Object.fromEntries });
      flush();
      self.postMessage({ type: "result", id, ...value });
    } finally {
      flush();
      if (result) result.destroy();
      busy = false;
    }
  } catch (error) {
    self.postMessage({ type: "error", id, message: error.message || String(error) });
  }
};
