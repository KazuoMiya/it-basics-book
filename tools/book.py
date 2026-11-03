"""Read the manuscript: chapter files, runnable code blocks and the results printed after them.

Code fences can carry options after the language name:

    ```python id=photos          name this block so another block can build on it
    ```python uses=photos        run the named block first (silently), then this one
    ```sql tables=members,products   sample tables to create before running (default: all)
    ```python norun              show the code without a run button
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FENCE = re.compile(r'^```(\S*)\s*(.*?)\s*$')
CONFIG = json.loads((ROOT / 'book.json').read_text(encoding='utf-8'))
SQL_TABLES = ['members', 'products', 'orders', 'accounts']


def chapter_files():
    return sorted((ROOT / 'manuscript').glob('*.md'))


def page_id(first_heading):
    t = first_heading.lstrip('#').strip()
    if t.startswith('序論'):
        return 'intro'
    if t.startswith('おわりに'):
        return 'outro'
    m = re.match(r'第(\d+)章', t)
    if m:
        return f'ch{m.group(1)}'
    raise ValueError(f'unknown chapter heading: {first_heading}')


def parse_info(rest):
    attrs = {}
    for part in rest.split():
        k, _, v = part.partition('=')
        attrs[k] = v if v else True
    return attrs


def fences(lines):
    out, inside = [], False
    for i, l in enumerate(lines):
        m = FENCE.match(l)
        if not m:
            continue
        if not inside:
            inside, lang, attrs, start = True, m.group(1), parse_info(m.group(2)), i
        else:
            inside = False
            out.append({'lang': lang, 'attrs': attrs, 'start': start, 'end': i,
                        'code': '\n'.join(lines[start + 1:i])})
    return out


def _next(lines, i):
    j = i + 1
    while j < len(lines) and not lines[j].strip():
        j += 1
    return j


def _table(lines, j):
    rows = []
    while j < len(lines) and lines[j].startswith('|'):
        rows.append([c.strip().replace('\\_', '_') for c in lines[j].strip().strip('|').split('|')])
        j += 1
    return {'kind': 'table', 'columns': rows[0], 'rows': rows[2:]}, j - 1


def runnable(lines):
    """Runnable blocks of one chapter, each paired with the result printed right after it."""
    fs = fences(lines)
    by_start = {f['start']: f for f in fs}
    out = []
    for f in fs:
        if f['lang'] not in ('python', 'sql') or f['attrs'].get('norun'):
            continue
        r = dict(f, mode='script', expected=None, consume_end=f['end'], drop=[])
        if f['lang'] == 'python' and re.search(r'^>>> ', f['code'], re.M):
            r['mode'] = 'repl'
        j = _next(lines, f['end'])
        if j < len(lines) and lines[j].startswith('実行結果は') and len(lines[j]) < 30:
            k = _next(lines, j)
            if k in by_start and by_start[k]['lang'] in ('', 'text'):
                r['drop'], j = [j], k
        if f['lang'] == 'python' and r['mode'] == 'script' and j in by_start and by_start[j]['lang'] in ('', 'text'):
            r['expected'] = {'kind': 'text', 'text': by_start[j]['code']}
            r['consume_end'] = by_start[j]['end']
        elif f['lang'] == 'sql' and j < len(lines) and lines[j].startswith('|'):
            r['expected'], r['consume_end'] = _table(lines, j)
        r['tables'] = f['attrs']['tables'].split(',') if 'tables' in f['attrs'] else list(SQL_TABLES)
        out.append(r)
    return out


def load():
    """All chapters with their runnable blocks; `uses=` resolved to setup code."""
    chapters = []
    named = {}
    for path in chapter_files():
        lines = path.read_text(encoding='utf-8').split('\n')
        runs = runnable(lines)
        for r in runs:
            if 'id' in r['attrs']:
                named[r['attrs']['id']] = r['code']
        chapters.append({'path': path, 'id': page_id(lines[0]), 'lines': lines, 'runs': runs})
    for ch in chapters:
        for r in ch['runs']:
            use = r['attrs'].get('uses')
            if use:
                if use not in named:
                    raise ValueError(f'{ch["path"].name}: uses={use} but no block has id={use}')
                r['setup'] = named[use]
    return chapters


def sample_sql(tables):
    return '\n\n'.join((ROOT / 'examples' / 'sql' / f'{t}.sql').read_text(encoding='utf-8').strip() for t in tables)
