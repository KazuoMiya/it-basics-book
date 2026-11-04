const RUNNER = /*RUNNER*/;
let py;

async function boot(files) {
  const base = 'https://runtime.invalid/';
  if (typeof STDLIB_B64 !== 'undefined') {
    files['python_stdlib.zip'] = Uint8Array.from(atob(STDLIB_B64), c => c.charCodeAt(0));
  }
  // Pyodide loads these three files through fetch. The sandbox CSP remains
  // active for all other requests, including requests made by edited Python.
  const realFetch = self.fetch;
  self.fetch = (input, init) => {
    const url = new URL(input.url || input, base);
    const name = url.pathname.slice(1);
    if (url.origin + '/' === base && Object.hasOwn(files, name)) {
      return Promise.resolve(new Response(files[name], {headers: {
        'Content-Type': name.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'
      }}));
    }
    return realFetch.call(self, input, init);
  };
  try {
    py = await loadPyodide({indexURL: base});
    py.runPython(RUNNER);
  } finally {
    self.fetch = realFetch;
  }
}

self.onmessage = async ({data}) => {
  try {
    if (data.type === 'boot') {
      await boot(data.files);
      self.postMessage({type: 'booted'});
      return;
    }
    const run = py.globals.get('run');
    try {
      const res = JSON.parse(run(data.code, data.mode, data.setup));
      self.postMessage({id: data.id, ok: true, res});
    } finally { run.destroy(); }
  } catch (error) {
    self.postMessage({type: data.type === 'boot' ? 'failed' : 'error', id: data.id, message: String(error)});
  }
};
