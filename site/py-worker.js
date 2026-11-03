// Runs Python (Pyodide) off the main thread so a long loop never freezes the page.
const RUNNER = /*RUNNER*/;
const PYODIDE = /*PYODIDE*/;  // where Pyodide is loaded from
const BUNDLED = /*BUNDLED*/;  // true when Pyodide files are shipped next to the page
let ready = null;

function boot() {
  if (!ready) {
    ready = (async () => {
      const base = new URL(PYODIDE, self.location.href).href;
      if (BUNDLED) {
        // The standard library ships as a script (base64) because that host does not
        // serve .zip files; hand its bytes to Pyodide when it asks for the archive.
        importScripts(base + 'python_stdlib.js');
        const raw = atob(self.PYODIDE_STDLIB_B64);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        self.PYODIDE_STDLIB_B64 = null;
        const realFetch = self.fetch.bind(self);
        self.fetch = (input, init) => {
          const url = input instanceof Request ? input.url : String(input);
          if (url.endsWith('python_stdlib.zip')) {
            return Promise.resolve(new Response(bytes, { headers: { 'Content-Type': 'application/zip' } }));
          }
          return realFetch(input, init);
        };
      }
      importScripts(base + 'pyodide.js');
      const py = await loadPyodide({ indexURL: base });
      py.runPython(RUNNER);
      return py;
    })();
  }
  return ready;
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  if (msg.type === 'boot') {
    try { await boot(); self.postMessage({ type: 'booted' }); }
    catch (err) { self.postMessage({ type: 'boot-failed', message: String((err && err.message) || err) }); }
    return;
  }
  const { id, code, mode, setup } = msg;
  try {
    const py = await boot();
    const run = py.globals.get('run');
    const res = run(code, mode || 'script', setup || '');
    run.destroy();
    self.postMessage({ id, ok: true, res: JSON.parse(res) });
  } catch (err) {
    self.postMessage({ id, ok: false, message: String((err && err.message) || err) });
  }
};
