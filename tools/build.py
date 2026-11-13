"""Build the web book from manuscript/*.md.

    python tools/build.py                 # GitHub Pages version -> _site/
    python tools/build.py --out dist      # another output folder
    python tools/build.py --target artifact --pyodide-dir PATH
                                          # self-contained copy (Pyodide files bundled)
"""
import argparse
import html
import json
import re
import shutil
import sys
from pathlib import Path

from markdown_it import MarkdownIt

sys.path.insert(0, str(Path(__file__).resolve().parent))
from book import CONFIG, ROOT, load, sample_sql, SQL_TABLES  # noqa: E402

from runtime import write_runtimes
from output import build_output

ap = argparse.ArgumentParser()
ap.add_argument('--out', default='_site')
ap.add_argument('--target', choices=['pages', 'artifact'], default='pages')
ap.add_argument('--pyodide-dir', help='folder with pyodide.js, pyodide.asm.js/.wasm, python_stdlib.zip, pyodide-lock.json')
ap.add_argument('--runtime-cache', help='directory containing the pinned npm .tgz archives for offline builds')
args = ap.parse_args()
if args.target == 'artifact' and not args.pyodide_dir:
    ap.error('--target artifact needs --pyodide-dir')

SITE = ROOT / 'site'
OUT = (ROOT / args.out) if not Path(args.out).is_absolute() else Path(args.out)
md = MarkdownIt('commonmark', {'html': True}).enable('table')
esc = lambda s: html.escape(s, quote=True)  # noqa: E731

FIG_RE = re.compile(r'^!\[(図\d+-\d+　[^\]]*)\]\(\.\./figures/([\w-]+)\.svg\)\s*$')


def figure_svg(name, n):
    svg = (ROOT / 'figures' / f'{name}.svg').read_text(encoding='utf-8').strip()
    svg = re.sub(r'<style>svg:root\{.*?\}</style>', '', svg, count=1, flags=re.S)  # standalone colors only
    pre = f'f{n}-'
    svg = re.sub(r'\sid="([^"]+)"', lambda m: f' id="{pre}{m.group(1)}"', svg)
    svg = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{pre}{m.group(1)})', svg)
    return svg


def section_id(pid, title, counters):
    m = re.match(r'^(\d+)-(\d+)　', title)
    if m:
        return f's{m.group(1)}-{m.group(2)}', 'numbered'
    if title.startswith('コラム'):
        return f'{pid}-column', 'column'
    if 'のまとめ' in title:
        return f'{pid}-summary', 'summary'
    if title.startswith('修正問題の解答'):
        return f'{pid}-answers', 'answers'
    counters[pid] = counters.get(pid, 0) + 1
    return f'{pid}-{counters[pid]}', 'plain'


chapters = load()
run_data, toc, templates = [], [], []
counters = {}
fig_n = 0
for ch in chapters:
    pid, lines = ch['id'], list(ch['lines'])
    # runnable blocks -> placeholders
    for r in ch['runs']:
        for k in range(r['start'], r['consume_end'] + 1):
            lines[k] = None
        for k in r['drop']:
            lines[k] = None
        lines[r['start']] = f'<!--RUN {len(run_data)}-->'
        entry = {'lang': r['lang'], 'mode': r['mode'], 'code': r['code'], 'expected': r['expected']}
        if r['mode'] == 'repl':
            entry['code'] = '\n'.join(line for line in r['code'].splitlines() if line.startswith(('>>>', '...')))
            entry['expected'] = {'kind': 'text', 'text': r['code']}
        if 'exercise' in r['attrs']:
            entry['exercise'] = r['attrs']['exercise']
        if 'answer' in r['attrs']:
            entry['answer'] = r['attrs']['answer']
        if r.get('setup'):
            entry['setup'] = r['setup']
        if r['lang'] == 'sql':
            entry['tables'] = r['tables']
            entry['unordered'] = bool(r['attrs'].get('unordered'))
        run_data.append(entry)
    # figures -> placeholders
    figs = {}
    for i, l in enumerate(lines):
        if l is None:
            continue
        m = FIG_RE.match(l)
        if m:
            figs[fig_n] = (m.group(1), m.group(2))
            lines[i] = f'<!--FIG {fig_n}-->'
            fig_n += 1
    lines = [l for l in lines if l is not None]
    head = lines[0].lstrip('#').strip()
    m = re.match(r'^(序論|第\d+章|おわりに)　?(.*)$', head)
    label, title = (m.group(1), m.group(2)) if m else (head, '')
    h = md.render('\n'.join(lines[1:]))

    secs = []

    def h2(mm, pid=pid, secs=secs):
        t = html.unescape(re.sub('<[^>]+>', '', mm.group(1)))
        sid, kind = section_id(pid, t, counters)
        secs.append({'id': sid, 'title': t, 'kind': kind})
        sm = re.match(r'^(\d+-\d+)　(.*)$', t)
        if sm:
            inner = f'<span class="secno">{sm.group(1)}</span><span class="sectitle">{esc(sm.group(2))}</span>'
        elif kind == 'column':
            inner = f'<span class="kicker">コラム</span><span class="sectitle">{esc(t[3:].lstrip("　 "))}</span>'
        else:
            inner = f'<span class="sectitle">{esc(t)}</span>'
        return f'<h2 id="{sid}" class="sec sec-{kind}">{inner}</h2>'

    h = re.sub(r'<h2>(.*?)</h2>', h2, h)
    parts = re.split(r'(?=<h2 )', h)
    h = ''.join(f'<aside class="column">{x}</aside>' if 'sec-column' in x[:80] else
                (f'<section class="summary">{x}</section>' if 'sec-summary' in x[:80] else x) for x in parts)
    n3 = [0]

    def h3(mm, pid=pid, n3=n3):
        n3[0] += 1
        return f'<h3 id="{pid}-h{n3[0]}">{mm.group(1)}</h3>'

    h = re.sub(r'<h3>(.*?)</h3>', h3, h)
    h = re.sub(r'<p>(表\d+-\d+　[^<]*)</p>\s*<table>(.*?)</table>',
               lambda mm: f'<figure class="tbl"><figcaption>{mm.group(1)}</figcaption>'
                          f'<div class="tscroll"><table>{mm.group(2)}</table></div></figure>', h, flags=re.S)
    h = re.sub(r'(?<!<div class="tscroll">)<table>(.*?)</table>', r'<div class="tscroll"><table>\1</table></div>', h, flags=re.S)

    def static_code(mm):
        lang = mm.group(1) or ''
        lab = {'csv': 'CSV', 'json': 'JSON', 'python': 'Python', 'sql': 'SQL'}.get(lang, '')
        tag = f'<span class="lang">{lab}</span>' if lab else ''
        return f'<div class="code static{" labeled" if lab else ""}">{tag}<pre><code>{mm.group(2)}</code></pre></div>'

    h = re.sub(r'<pre><code(?: class="language-([\w-]+)")?>(.*?)</code></pre>', static_code, h, flags=re.S)
    h = re.sub(r'<!--RUN (\d+)-->', lambda mm: f'<div class="code run" data-run="{mm.group(1)}"></div>', h)
    h = re.sub(r'<!--FIG (\d+)-->', lambda mm: (
        f'<figure class="fig"><div class="fig-art">{figure_svg(figs[int(mm.group(1))][1], int(mm.group(1)))}</div>'
        f'<figcaption>{esc(figs[int(mm.group(1))][0])}</figcaption></figure>'), h)

    first = h.find('<h2 ')
    lead, rest = (h[:first], h[first:]) if first >= 0 else (h, '')
    header = (f'<header class="chap-head"><p class="chap-label">{esc(label)}</p>'
              + (f'<h1 class="chap-title">{esc(title)}</h1>' if title else '') + '</header>')
    templates.append(f'<template id="tpl-{pid}">{header}<div class="lead">{lead}</div>{rest}</template>')
    src_url = f'https://github.com/{CONFIG["repo"]}/blob/{CONFIG["branch"]}/manuscript/{ch["path"].name}'
    toc.append({'id': pid, 'label': label, 'title': title, 'secs': secs, 'source': src_url})

# ---- assemble ---------------------------------------------------------------
data = {'toc': toc, 'runs': run_data, 'title': CONFIG['title'], 'repo': f'https://github.com/{CONFIG["repo"]}',
        'workerHost': (SITE / 'python-host.html').read_text(encoding='utf-8'),
        'embeddedStdlib': args.target == 'artifact', 'sample': {t: sample_sql([t]) for t in SQL_TABLES}}
data_js = 'window.BOOK = ' + json.dumps(data, ensure_ascii=False).replace('</', '<\\/') + ';'
head = (SITE / 'head.html').read_text(encoding='utf-8')
body = (SITE / 'body.html').read_text(encoding='utf-8')
fill = lambda s: (s.replace('{{TITLE}}', esc(CONFIG['title'])).replace('{{DESCRIPTION}}', esc(CONFIG['description']))  # noqa: E731
                  .replace('{{REPO}}', f'https://github.com/{CONFIG["repo"]}'))
head = fill(head).replace('/*STYLE*/', (SITE / 'style.css').read_text(encoding='utf-8'))
body = (fill(body).replace('<!--TEMPLATES-->', '\n'.join(templates))
        .replace('/*DATA*/', data_js)
        .replace('/*APP*/', (SITE / 'app.js').read_text(encoding='utf-8')))
if args.target == 'pages':
    page = f'<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n{head}\n</head>\n<body>\n{body}\n</body>\n</html>\n'
else:
    page = head + '\n' + body  # the artifact host adds the document skeleton
page = page.replace('�', '&#xFFFD;')  # the book shows this character on purpose (mojibake example)

with build_output(OUT) as stage:
    for name in ['sql-worker.js', 'sqlrun.js']:
        shutil.copyfile(SITE / name, stage / name)
    (stage / 'index.html').write_text(page, encoding='utf-8')
    runner = (ROOT / 'tools' / 'runner.py').read_text(encoding='utf-8')
    worker = (SITE / 'py-worker.js').read_text(encoding='utf-8').replace('/*RUNNER*/', json.dumps(runner, ensure_ascii=False))
    write_runtimes(stage, args.runtime_cache, args.pyodide_dir, args.target == 'artifact', worker)
    if args.target == 'pages':
        (stage / '.nojekyll').write_text('')
print(f'{len(templates)} pages, {len(run_data)} runnable examples, {fig_n} figures -> {OUT}')
