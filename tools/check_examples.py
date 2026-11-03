"""Run every runnable example in the manuscript and compare it with the result printed in the book.

    python tools/check_examples.py

Python examples run with the local Python (use 3.12, the version the web book runs).
SQL examples run with SQLite against the sample tables in examples/sql/.
Exits with status 1 when an example no longer prints what the book says.
"""
import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from book import load, sample_sql  # noqa: E402
import runner  # noqa: E402


def python_output(r):
    res = json.loads(runner.run(r['code'], r['mode'], r.get('setup', '')))
    if 'repl' in res:
        parts = []
        for it in res['repl']:
            parts.append('\n'.join(('... ' if i else '>>> ') + l for i, l in enumerate(it['in'])))
            parts.append((it['out'] + (it['err'] + '\n' if it['err'] else '')).rstrip('\n'))
        return '\n'.join(p for p in parts if p != '')
    return (res['out'] + (res['err'] + '\n' if res['err'] else '')).rstrip('\n')


def sql_first_rows(r):
    db = sqlite3.connect(':memory:', isolation_level=None)
    db.execute('PRAGMA foreign_keys = ON')
    db.executescript(sample_sql(r['tables']))
    first, buf = None, ''
    for line in r['code'].split('\n'):
        buf += line + '\n'
        if sqlite3.complete_statement(buf):
            cur = db.execute(buf)
            if cur.description and first is None:
                first = {'columns': [d[0] for d in cur.description], 'rows': [[str(v) for v in row] for row in cur.fetchall()]}
            buf = ''
    return first


def main():
    failures = checked = 0
    work = tempfile.mkdtemp()
    os.chdir(work)  # examples that write files do it here
    for ch in load():
        for r in ch['runs']:
            where = f'{ch["path"].name}:{r["start"] + 1}'
            try:
                if r['lang'] == 'python':
                    got = python_output(r)
                    want = r['code'] if r['mode'] == 'repl' else (r['expected'] or {}).get('text')
                else:
                    got = sql_first_rows(r)
                    want = {'columns': r['expected']['columns'], 'rows': r['expected']['rows']} if r['expected'] else None
            except Exception as e:  # an example that cannot run at all
                print(f'NG  {where}  {type(e).__name__}: {e}')
                failures += 1
                continue
            checked += 1
            if want is None:
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
