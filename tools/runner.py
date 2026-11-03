import sys, io, traceback


def _fmt_exc(e):
    if isinstance(e, SyntaxError):
        where = f'（{e.lineno}行目）' if e.lineno else ''
        return f'SyntaxError: {e.msg}{where}'
    return ''.join(traceback.format_exception_only(type(e), e)).strip()


class _Capture:
    def __enter__(self):
        self.buf = io.StringIO()
        self.old = sys.stdout, sys.stderr
        sys.stdout = sys.stderr = self.buf
        return self.buf

    def __exit__(self, *a):
        sys.stdout, sys.stderr = self.old
        return False


def run_script(src, setup=''):
    g = {'__name__': '__main__'}
    err = None
    with _Capture() as buf:
        try:
            if setup:
                exec(compile(setup, '<setup>', 'exec'), g)
                buf.seek(0)
                buf.truncate()
            exec(compile(src, '<main>', 'exec'), g)
        except BaseException as e:
            err = _fmt_exc(e)
    return {'out': buf.getvalue(), 'err': err}


def _split_repl(src):
    stmts, cur = [], None
    for line in src.split('\n'):
        if line.startswith('>>>'):
            if cur is not None:
                stmts.append(cur)
            cur = [line[4:] if line.startswith('>>> ') else line[3:]]
        elif line.startswith('...') and cur is not None:
            cur.append(line[4:] if line.startswith('... ') else line[3:])
    if cur is not None:
        stmts.append(cur)
    return stmts


def run_repl(src, setup=''):
    stmts = _split_repl(src)
    if not stmts:
        return run_script(src, setup)
    g = {'__name__': '__main__'}
    items = []
    for st in stmts:
        text = '\n'.join(st)
        err = None
        with _Capture() as buf:
            try:
                exec(compile(text + '\n', '<stdin>', 'single'), g)
            except BaseException as e:
                err = _fmt_exc(e)
        items.append({'in': st, 'out': buf.getvalue(), 'err': err})
    return {'repl': items}


def run(src, mode='script', setup=''):
    import json
    import os
    os.chdir('/home/pyodide') if os.path.isdir('/home/pyodide') else None
    res = run_repl(src, setup) if mode == 'repl' else run_script(src, setup)
    return json.dumps(res, ensure_ascii=False)
