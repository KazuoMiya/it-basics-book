"""Verify pinned runtime bytes before publishing them with the book."""
import base64
import hashlib
import io
import tarfile
from pathlib import Path
from urllib.request import urlopen

from book import CONFIG, ROOT

PY_FILES = {
    'pyodide.js': 'c0069107621d5b942a659e737a12e774cc0451feaa2256f475d72e071d844ec7',
    'pyodide.asm.js': '919560652ed3dad3707cb3a394785da1e046fb13dc0defa162058ff230cb7eed',
    'pyodide.asm.wasm': 'b7e66a19427a55010ac3367c1b6c64b893f9826f783412945fdf0c3337f3bc94',
    'pyodide-lock.json': 'cd50b49de944c579045e122fe8628b31f9ce446379f032f36c05e273d38766e0',
    'python_stdlib.zip': '72894522b791858b9d613ac786b951d8b5094035dcf376313ea24a466810f336',
}


def package(name, members, cache):
    spec = CONFIG['runtime'][name]
    if cache:
        raw = (Path(cache) / spec['url'].rsplit('/', 1)[1]).read_bytes()
    else:
        with urlopen(spec['url'], timeout=60) as response:
            raw = response.read()
    digest = base64.b64encode(hashlib.sha512(raw).digest()).decode()
    if digest != spec['sha512']:
        raise ValueError(f'{name}: 配布物のSHA-512が一致しません')
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
        return {n: archive.extractfile('package/' + n).read() for n in members}


def write_runtimes(stage, cache, pyodide_dir, artifact, worker):
    runtime = stage / 'runtime'
    runtime.mkdir()
    sql = package('sql.js', ['dist/sql-asm.js', 'LICENSE'], cache)
    (runtime / 'sql-asm.js').write_bytes(sql['dist/sql-asm.js'])
    (runtime / 'sql-LICENSE.txt').write_bytes(sql['LICENSE'])
    for name in ['pyodide', 'Apache-2.0']:
        (runtime / f'{name}-LICENSE.txt').write_bytes((ROOT / 'site/licenses' / f'{name}.txt').read_bytes())
    if pyodide_dir:
        files = {n: (Path(pyodide_dir) / n).read_bytes() for n in PY_FILES}
    else:
        files = package('pyodide', PY_FILES, cache)
    for name, digest in PY_FILES.items():
        if hashlib.sha256(files[name]).hexdigest() != digest:
            raise ValueError(f'{name}: Pyodideの配布物と一致しません')
    # Blob workers inherit the sandbox frame's CSP. Bundle both entry scripts
    # so the worker needs no remote script loading, even during initialization.
    source = [files.pop('pyodide.js'), files.pop('pyodide.asm.js'), worker.encode()]
    if artifact:
        # The artifact host does not serve ZIP files; embed only its stdlib.
        encoded = base64.b64encode(files.pop('python_stdlib.zip'))
        source.insert(0, b'const STDLIB_B64 = "' + encoded + b'";')
    (stage / 'py-worker.js').write_bytes(b'\n'.join(source))
    for name, content in files.items():
        (runtime / name).write_bytes(content)
