"""Run every runnable example in the manuscript and compare it with the result printed in the book.

    python tools/check_examples.py

Python examples run with the local Python (use 3.12, the version the web book runs).
SQL examples run with SQLite against the sample tables in examples/sql/.
Exits with status 1 when an example no longer prints what the book says.
"""
import json
from contextlib import chdir, closing
import sqlite3
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from book import load, sample_sql  # noqa: E402
import runner  # noqa: E402


def python_output(r):
    res = json.loads(runner.run(r['code'], r['mode'], r.get('setup', '')))
    errors = [it['err'] for it in res.get('repl', [res]) if it.get('err')]
    actual = [error.partition(':')[0] for error in errors]
    expected_error = r.get('attrs', {}).get('raises')
    if actual != ([expected_error] if expected_error else []):
        raise ValueError('例外が期待と異なります: ' + repr(errors))
    if 'repl' in res:
        parts = []
        for it in res['repl']:
            parts.append('\n'.join(('... ' if i else '>>> ') + l for i, l in enumerate(it['in'])))
            parts.append((it['out'] + (it['err'] + '\n' if it['err'] else '')).rstrip('\n'))
        return '\n'.join(p for p in parts if p != '')
    return (res['out'] + (res['err'] + '\n' if res['err'] else '')).rstrip('\n')


def sql_statements(code):
    start = 0
    for i, char in enumerate(code):
        if char == ';' and sqlite3.complete_statement(code[start:i + 1]):
            yield code[start:i + 1]
            start = i + 1
    if code[start:].strip():
        yield code[start:]


def sql_first_rows(r):
    with closing(sqlite3.connect(':memory:', isolation_level=None)) as db:
        db.execute('PRAGMA foreign_keys = ON')
        db.executescript(sample_sql(r['tables']))
        first = None
        for sql in sql_statements(r['code']):
            cur = db.execute(sql)
            if cur.description:
                rows = [[str(v) for v in row] for row in cur]
                if first is None:
                    first = {'columns': [d[0] for d in cur.description], 'rows': rows}
        return first


def main():
    with tempfile.TemporaryDirectory() as tmp, chdir(tmp):
        check_chapters(load())


def check_chapters(chapters):
    failures = checked = 0
    for ch in chapters:
        for r in ch['runs']:
            where = f'{ch["path"].name}:{r["start"] + 1}'
            checked += 1
            try:
                if r['lang'] == 'python':
                    got = python_output(r)
                    want = r['code'] if r['mode'] == 'repl' else (r['expected'] or {}).get('text')
                else:
                    got = sql_first_rows(r)
                    want = {'columns': r['expected']['columns'], 'rows': r['expected']['rows']} if r['expected'] else None
                    if r.get('attrs', {}).get('unordered') and got is not None and want is not None:
                        got['rows'] = sorted(got['rows'])
                        want['rows'] = sorted(want['rows'])
            except Exception as e:  # an example that cannot run at all
                print(f'NG  {where}  {type(e).__name__}: {e}')
                failures += 1
                continue
            if 'exercise' in r.get('attrs', {}):
                if got is None or got == want:
                    failures += 1
                    print(f'NG  {where}  修正前のコードは目標と異なる結果を返す必要があります')
                else:
                    print(f'OK  {where}  (exercise starts with a different result)')
            elif want is None:
                print(f'--  {where}  (no printed result to compare)')
            elif got == want:
                print(f'OK  {where}')
            else:
                failures += 1
                print(f'NG  {where}\n    book: {want!r}\n    run : {got!r}')
    print(f'\n{checked} examples run, {failures} problems')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
