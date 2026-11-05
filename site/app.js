(function () {
  'use strict';
  const BOOK = window.BOOK;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  // ---------------------------------------------------------------- TOC
  const pages = BOOK.toc;
  const secToPage = Object.create(null);
  pages.forEach(p => p.secs.forEach(s => { secToPage[s.id] = p.id; }));
  const pageTitle = p => p.title ? `${p.label}　${p.title}` : p.label;

  const tocEl = $('#toc');
  tocEl.innerHTML = pages.map(p => {
    const subs = p.secs.filter(s => s.kind !== 'plain' || p.id === 'intro').map(s => {
      const m = s.title.match(/^(\d+-\d+)　(.*)$/);
      const t = m ? `<span class="no">${m[1]}</span>${esc(m[2])}` : esc(s.title.replace(/^コラム　/, 'コラム：'));
      return `<li><a href="#${s.id}" data-sec="${s.id}">${t}</a></li>`;
    }).join('');
    return `<li data-page="${p.id}"><a href="#${p.id}"><span class="lab">${esc(p.label)}</span>` +
      (p.title ? `<span class="ttl">${esc(p.title)}</span>` : '') + `</a><ol hidden>${subs}</ol></li>`;
  }).join('');

  // ------------------------------------------------------------- drawer
  const sidebar = $('#sidebar'), scrim = $('#scrim'), menuBtn = $('#menu-btn');
  function drawer(open) {
    sidebar.classList.toggle('open', open);
    scrim.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  }
  menuBtn.addEventListener('click', () => drawer(!sidebar.classList.contains('open')));
  scrim.addEventListener('click', () => drawer(false));
  sidebar.addEventListener('click', e => { if (e.target.closest('a')) drawer(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') drawer(false); });

  // ------------------------------------------------------------- router
  const pageEl = $('#page'), pagerEl = $('#pager'), crumb = $('#crumb');
  let current = null, spy = null, pendingMark = null;

  function showPage(pid) {
    if (current === pid) return;
    current = pid;
    const tpl = document.getElementById('tpl-' + pid);
    pageEl.replaceChildren(tpl.content.cloneNode(true));
    pageEl.querySelectorAll('.code.run').forEach(el => hydrate(el, +el.dataset.run));
    const i = pages.findIndex(p => p.id === pid);
    const p = pages[i];
    crumb.textContent = pageTitle(p);
    document.title = (pid === 'intro' ? '' : pageTitle(p) + ' | ') + BOOK.title;
    const prev = pages[i - 1], next = pages[i + 1];
    pagerEl.innerHTML =
      (prev ? `<a class="prev" href="#${prev.id}"><span class="dir">前へ</span><span class="t">${esc(pageTitle(prev))}</span></a>` : '') +
      (next ? `<a class="next" href="#${next.id}"><span class="dir">次へ</span><span class="t">${esc(pageTitle(next))}</span></a>` : '') +
      `<p class="source"><a href="${esc(p.source)}" target="_blank" rel="noopener">この章の原稿をGitHubで見る</a></p>`;
    tocEl.querySelectorAll(':scope > li').forEach(li => {
      const on = li.dataset.page === pid;
      li.classList.toggle('current', on);
      li.querySelector('ol').hidden = !on;
    });
    watchSections();
  }

  function route() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)) || 'intro'; }
    catch { id = 'intro'; }
    const pid = pages.some(p => p.id === id) ? id : (secToPage[id] || (id.match(/^(intro|ch\d|outro)-/) || [])[1]);
    if (!pages.some(p => p.id === pid)) { showPage('intro'); window.scrollTo(0, 0); return; }
    if (id !== pid && !document.getElementById('tpl-' + pid).content.getElementById(id)) {
      showPage('intro'); window.scrollTo(0, 0); return;
    }
    const changed = current !== pid;
    showPage(pid);
    if (id === pid) {
      if (changed) window.scrollTo(0, 0);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ block: 'start' });
      if (pendingMark) { markIn(el, pendingMark); pendingMark = null; }
    }
    store.set('itbook-last', { page: pid, at: id });
  }
  window.addEventListener('hashchange', route);

  function watchSections() {
    if (spy) spy.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const links = {};
    tocEl.querySelectorAll('a[data-sec]').forEach(a => { links[a.dataset.sec] = a; });
    spy = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        tocEl.querySelectorAll('a.active').forEach(a => a.classList.remove('active'));
        const a = links[en.target.id];
        if (a) a.classList.add('active');
        store.set('itbook-last', { page: current, at: en.target.id });
      });
    }, { rootMargin: '-64px 0px -70% 0px' });
    pageEl.querySelectorAll('h2.sec').forEach(h => spy.observe(h));
  }

  // ------------------------------------------------------------- search
  let index = null;
  function buildIndex() {
    index = [];
    pages.forEach(p => {
      const frag = document.getElementById('tpl-' + p.id).content;
      let cur = { id: p.id, page: p, title: pageTitle(p), text: '' };
      index.push(cur);
      frag.querySelectorAll('h2.sec, h3, h4, p, li, th, td, figcaption').forEach(el => {
        if (el.matches('h2.sec')) {
          cur = { id: el.id, page: p, title: el.textContent.replace(/^(\d+-\d+)/, '$1　'), text: '' };
          index.push(cur);
        } else if (!el.closest('li') || el.matches('li')) {
          cur.text += el.textContent.replace(/\s+/g, ' ') + '\n';
        }
      });
    });
  }
  const resultsEl = $('#results'), q = $('#q');
  let timer = null;
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 120); });
  function search() {
    const term = q.value.trim();
    if (!term) { resultsEl.hidden = true; tocEl.hidden = false; return; }
    if (!index) buildIndex();
    const lower = term.toLowerCase();
    const hits = [];
    for (const s of index) {
      const hay = s.text.toLowerCase();
      const at = hay.indexOf(lower);
      const inTitle = s.title.toLowerCase().includes(lower);
      if (at < 0 && !inTitle) continue;
      let n = 0, k = at;
      while (k >= 0) { n++; k = hay.indexOf(lower, k + lower.length); }
      const from = Math.max(0, at - 24);
      const snip = at >= 0 ? (from ? '…' : '') + s.text.slice(from, at + term.length + 40).replace(/\n/g, ' ') + '…' : '';
      hits.push({ s, n, snip });
    }
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const mark = t => esc(t).replace(re, m => `<mark>${m}</mark>`);
    resultsEl.innerHTML = `<p class="count">${hits.length ? hits.length + 'か所の節で見つかりました' : '見つかりませんでした'}</p>` +
      hits.slice(0, 60).map((h, i) => `<a href="#${h.s.id}" data-hit="${i}"><span class="where">${esc(h.s.page.label)}　${mark(h.s.title.replace(h.s.page.label + '　', ''))}</span>` +
        (h.snip ? `<span class="snip">${mark(h.snip)}</span>` : '') + '</a>').join('');
    resultsEl.hidden = false;
    tocEl.hidden = true;
    resultsEl.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { pendingMark = term; }));
  }
  function markIn(root, term) {
    if (!root) return;
    // the section runs from its heading to the next h3
    let node = root;
    const lower = term.toLowerCase();
    while (node) {
      const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let t;
      while ((t = w.nextNode())) {
        const k = t.nodeValue.toLowerCase().indexOf(lower);
        if (k >= 0) {
          const r = document.createRange();
          r.setStart(t, k); r.setEnd(t, k + term.length);
          const m = document.createElement('mark');
          r.surroundContents(m);
          m.scrollIntoView({ block: 'center' });
          setTimeout(() => { m.replaceWith(...m.childNodes); }, 6000);
          return;
        }
      }
      node = node.nextElementSibling;
      if (node && node.matches && node.matches('h2.sec, aside.column, section.summary')) return;
    }
  }

  // ---------------------------------------------------------- highlighter
  const PY_KW = new Set('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'.split(' '));
  const PY_BI = new Set('print len type int str float bool list dict range sorted open sum min max enumerate zip'.split(' '));
  const SQL_KW = new Set('SELECT FROM WHERE ORDER BY DESC ASC INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE INDEX INTEGER VARCHAR PRIMARY KEY NOT NULL DATE FOREIGN REFERENCES JOIN ON GROUP AS COUNT SUM AVG MIN MAX BEGIN COMMIT ROLLBACK AND OR LIMIT HAVING DISTINCT LEFT INNER LIKE IN IS DECIMAL UNIQUE DROP ALTER'.split(' '));
  const PY_RE = /(#[^\n]*)|((?:\b[rbfuRBFU]{1,2})?(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'))|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
  const SQL_RE = /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
  function hlCode(code, lang) {
    const re = lang === 'sql' ? SQL_RE : PY_RE;
    re.lastIndex = 0;
    let out = '', last = 0, m, prev = '';
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      const t = m[0];
      let cls = '';
      if (m[1]) cls = 'com';
      else if (m[2]) cls = 'str';
      else if (m[3]) cls = 'num';
      else if (lang === 'sql') cls = SQL_KW.has(t.toUpperCase()) ? 'kw' : '';
      else if (PY_KW.has(t)) cls = 'kw';
      else if (prev === 'def' || PY_BI.has(t)) cls = 'fn';
      out += cls ? `<span class="tok-${cls}">${esc(t)}</span>` : esc(t);
      if (m[4]) prev = t;
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }
  function hl(code, lang, mode) {
    if (mode !== 'repl') return hlCode(code, lang);
    return code.split('\n').map(line => {
      const m = line.match(/^(>>> |\.\.\. )(.*)$/);
      if (m) return `<span class="tok-prompt">${esc(m[1])}</span>${hlCode(m[2], lang)}`;
      return `<span class="tok-out">${esc(line)}</span>`;
    }).join('\n');
  }

  // ------------------------------------------------------------- Python
  class RuntimeLoadError extends Error {}
  let pySession = null;
  let pyAssets = null;
  async function loadPyAssets(signal) {
    const names = ['py-worker.js', 'runtime/pyodide.asm.wasm', 'runtime/pyodide-lock.json'];
    if (!BOOK.embeddedStdlib) names.push('runtime/python_stdlib.zip');
    const buffers = await Promise.all(names.map(async name => {
      const res = await fetch(name, {signal});
      if (!res.ok) throw new Error(name + ' を取得できませんでした。');
      return res.arrayBuffer();
    }));
    const files = {};
    names.slice(1).forEach((name, i) => { files[name.split('/').pop()] = buffers[i + 1]; });
    return {source: new Blob([buffers[0]], {type: 'text/javascript'}), files};
  }

  function endPySession(s, error) {
    if (pySession !== s) return;
    pySession = null;
    clearTimeout(s.bootTimer);
    s.rejectBoot(error);
    for (const p of s.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    s.pending.clear();
    s.loading.abort();
    s.port.close();
    s.frame.remove();
  }

  function startPython() {
    if (pySession) return pySession;
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.setAttribute('sandbox', 'allow-scripts');
    const channel = new MessageChannel();
    const s = {frame, port: channel.port1, seq: 0, pending: new Map(), loading: new AbortController()};
    pySession = s;
    s.ready = new Promise((resolve, reject) => { s.resolveBoot = resolve; s.rejectBoot = reject; });
    s.bootTimer = setTimeout(() => endPySession(s, new Error('Pythonの準備が時間内に完了しませんでした。')), 45000);
    s.port.onmessage = ({data}) => {
      if (data.type === 'failed') return endPySession(s, new Error(data.message));
      if (data.type === 'booted') { clearTimeout(s.bootTimer); s.resolveBoot(); return; }
      const p = s.pending.get(data.id);
      if (!p) return;
      clearTimeout(p.timer);
      s.pending.delete(data.id);
      if (data.ok) p.resolve(data.res); else p.reject(new Error(data.message));
    };
    frame.onload = async () => {
      try {
        const assets = pyAssets || await loadPyAssets(s.loading.signal);
        if (pySession !== s) return;
        pyAssets = assets;
        frame.contentWindow.postMessage(assets, '*', [channel.port2]);
      } catch (error) { endPySession(s, error); }
    };
    frame.srcdoc = BOOK.workerHost;
    document.body.appendChild(frame);
    return s;
  }

  async function runPython(code, mode, setup) {
    let s;
    try {
      s = startPython();
      await s.ready;
    } catch (error) { throw new RuntimeLoadError(error.message || String(error)); }
    const id = ++s.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => endPySession(s, new Error('10秒たっても終わらなかったため、同じ実行環境の処理を停止しました。')), 10000);
      s.pending.set(id, {resolve, reject, timer});
      s.port.postMessage({id, code, mode, setup});
    });
  }

  // ---------------------------------------------------------------- SQL
  function runSQL(code, setup, signal) {
    return new Promise((resolve, reject) => {
      let worker, booted = false;
      try { worker = new Worker('sql-worker.js'); }
      catch (error) { reject(new RuntimeLoadError(error.message || String(error))); return; }
      const stop = () => finish(new Error('実行を中断しました。'));
      let timer = setTimeout(() => finish(new RuntimeLoadError('SQLの準備が時間内に完了しませんでした。')), 10000);
      function finish(error, items) {
        clearTimeout(timer);
        signal.removeEventListener('abort', stop);
        worker.terminate();
        if (error) reject(error); else resolve(items);
      }
      signal.addEventListener('abort', stop, {once: true});
      worker.onmessage = ({data}) => {
        if (data.type === 'booted') {
          booted = true;
          clearTimeout(timer);
          timer = setTimeout(() => finish(new Error('SQLの実行が10秒を超えたため停止しました。')), 10000);
          return;
        }
        finish(data.error && (data.phase === 'load' ? new RuntimeLoadError(data.error) : new Error(data.error)), data.items);
      };
      worker.onerror = () => finish(booted ? new Error('SQLの実行中にエラーが発生しました。')
        : new RuntimeLoadError('SQLの実行環境を読み込めませんでした。'));
      worker.postMessage({code, setup});
    });
  }

  // ----------------------------------------------------- result rendering
  function tableHTML(columns, rows, cap) {
    const head = '<tr>' + columns.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>';
    const body = rows.length ? rows.map(r => '<tr>' + r.map(v => `<td>${v === null ? '<span class="msg">NULL</span>' : esc(v)}</td>`).join('') + '</tr>').join('')
      : `<tr><td colspan="${columns.length}" class="msg">（行はありません）</td></tr>`;
    return `<div>${cap ? `<div class="cap">${esc(cap)}</div>` : ''}<div class="tscroll"><table><thead>${head}</thead><tbody>${body}</tbody></table></div></div>`;
  }
  function pyResultHTML(res) {
    if (res.repl) {
      const t = res.repl.map(it => it.in.map((l, i) => `<span class="tok-prompt">${i ? '... ' : '>>> '}</span>${hlCode(l, 'python')}`).join('\n') + '\n' +
        esc(it.out) + (it.err ? `<span class="err">${esc(it.err)}</span>\n` : '')).join('');
      return `<pre>${t.replace(/\n$/, '')}</pre>`;
    }
    const body = esc(res.out) + (res.err ? `<span class="err">${esc(res.err)}</span>` : '');
    return `<pre>${body.replace(/\n$/, '') || '<span class="msg">（表示された内容はありません）</span>'}</pre>`;
  }
  const TX = { BEGIN: 'トランザクションを開始しました（BEGIN）', COMMIT: '変更を確定しました（COMMIT）', END: '変更を確定しました（END）', ROLLBACK: '変更を取り消しました（ROLLBACK）' };
  function sqlResultHTML(items) {
    const lines = [], tables = [];
    for (const it of items) {
      if (it.truncated) lines.push('<div class="msg">表示上限を超えたため、結果の一部を省略しました。</div>');
      if (it.type === 'limit') lines.push(`<div class="msg">${esc(it.message)}</div>`);
      if (it.type === 'rows') tables.push(tableHTML(it.columns, it.rows, items.filter(x => x.type === 'rows').length > 1 ? `結果 ${tables.length + 1}` : ''));
      else if (it.type === 'change') lines.push(`<div class="ok">${esc(it.table)}テーブル：${it.n}行を${it.verb}しました</div>`);
      else if (it.type === 'create') lines.push(`<div class="ok">${esc(it.table)}テーブルを作成しました</div>`);
      else if (it.type === 'index') lines.push(`<div class="ok">${esc(it.table)}テーブルに、インデックス ${esc(it.name)} を作成しました</div>`);
      else if (it.type === 'tx') lines.push(`<div class="ok">${esc(TX[it.verb] || it.verb)}</div>`);
      else if (it.type === 'ok') lines.push(`<div class="ok">実行しました（${esc(it.head)}）</div>`);
      else if (it.type === 'error') lines.push(`<div class="err">エラー：${esc(it.message)}</div>`);
      else if (it.type === 'snapshot') tables.push(tableHTML(it.columns, it.rows, `実行後の${it.table}テーブル`));
    }
    return (lines.length ? `<div class="lines">${lines.join('')}</div>` : '') +
      (tables.length ? `<div class="tables">${tables.join('')}</div>` : (lines.length ? '<div class="tables"></div>' : '<pre class="msg">（結果はありません）</pre>'));
  }
  function meetsSqlGoal(items, goal, unordered) {
    const tables = items.filter(it => it.type === 'rows');
    if (tables.length !== 1 || tables[0].truncated || items.some(it => it.type === 'error' || it.type === 'limit')) return false;
    const table = tables[0];
    const rowKeys = rows => rows.map(row => JSON.stringify(row.map(String)));
    const actual = rowKeys(table.rows), target = rowKeys(goal.rows);
    if (unordered) { actual.sort(); target.sort(); }
    return JSON.stringify(table.columns) === JSON.stringify(goal.columns) &&
      actual.length === target.length && actual.every((key, i) => key === target[i]);
  }
  function referenceHTML(b) {
    if (!b.expected) return '<p class="msg">このコードには、本書に掲載の結果がありません。</p>';
    const heading = b.exercise ? '本書に掲載の目標の出力（修正後）' : '本書に掲載の結果';
    const note = b.exercise ? '修正後に目指す出力です。初期コードや編集したコードの実行結果ではありません。'
      : '原稿に掲載したコードの結果です。編集したコードの実行結果ではありません。';
    const output = b.expected.kind === 'table' ? tableHTML(b.expected.columns, b.expected.rows)
      : `<pre>${esc(b.expected.text)}</pre>`;
    return `<section class="reference"><p><strong>${heading}</strong><br>${note}</p>${output}</section>`;
  }

  // --------------------------------------------------------- code blocks
  const SAMPLE_NOTE = { members: '会員', products: '商品', orders: '注文', accounts: '口座' };
  function hydrate(el, i) {
    const b = BOOK.runs[i];
    const lang = b.lang;
    let code = b.code, revision = 0;
    let note = '';
    if (b.setup) note = 'この節で前に出てきたコードの続きとして実行します。';
    if (lang === 'sql') note = 'サンプルの' + b.tables.map(t => SAMPLE_NOTE[t] + 'テーブル').join('・') + 'に対して実行します。何度実行しても、データは元の状態から始まります。';
    const id = 'ed-' + i;
    const sqlSetup = lang === 'sql' ? b.tables.map(t => BOOK.sample[t]).join('\n\n') : '';
    let sqlController = null;
    el.innerHTML =
      `<div class="code-head"><span class="lang">${lang === 'sql' ? 'SQL' : 'Python'}</span><span class="note">${esc(note)}</span>` +
      `<div class="actions"><button type="button" class="btn-reset" hidden>元に戻す</button>` +
      `<button type="button" class="btn-edit" aria-controls="${id}">編集</button>` +
      `<button type="button" class="btn-run" aria-controls="result-${i}">実行</button></div></div>` +
      `<pre class="src"><code></code></pre>` +
      `<textarea class="editor" id="${id}" spellcheck="false" autocapitalize="off" autocomplete="off" hidden aria-label="コードを編集"></textarea>` +
      `<div class="announcement sr-only" role="status" aria-live="polite" aria-atomic="true"></div>` +
      `<div class="result" id="result-${i}" hidden><div class="result-head"><span class="label">実行結果</span><span class="status"></span></div><div class="out"></div>` +
      (b.exercise ? '<p class="feedback"></p>' : '') + '</div>' +
      (lang === 'sql' ? `<details class="sample"><summary>サンプルデータを作るSQLを見る</summary><pre><code>${hlCode(sqlSetup, 'sql')}</code></pre></details>` : '');
    const src = $('.src code', el), ed = $('.editor', el), result = $('.result', el), out = $('.out', el),
      status = $('.status', el), announcement = $('.announcement', el),
      btnRun = $('.btn-run', el), btnEdit = $('.btn-edit', el), btnReset = $('.btn-reset', el);
    const paint = () => { src.innerHTML = hl(code, lang, b.mode); };
    const clearResult = () => {
      result.hidden = true;
      out.replaceChildren();
      $('.result-head .label', el).textContent = '実行結果';
      announcement.textContent = '';
      status.textContent = '';
      status.classList.remove('live');
      if (b.exercise) $('.feedback', el).textContent = '';
    };
    const fit = () => { ed.style.height = 'auto'; ed.style.height = ed.scrollHeight + 4 + 'px'; };
    const editing = () => !ed.hidden;
    const sync = () => {
      if (editing() && code !== ed.value) {
        code = ed.value;
        revision++;
        clearResult();
      }
      btnReset.hidden = code === b.code;
    };
    paint();

    btnEdit.addEventListener('click', () => {
      if (editing()) {
        sync(); ed.hidden = true; src.parentElement.hidden = false; paint(); btnEdit.textContent = '編集';
      } else {
        ed.value = code; ed.hidden = false; src.parentElement.hidden = true; fit(); ed.focus(); btnEdit.textContent = '編集を終える';
      }
    });
    ed.addEventListener('input', () => { fit(); sync(); });
    ed.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); btnRun.click(); }
      else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const s = ed.selectionStart, t = ed.selectionEnd;
        ed.setRangeText('    ', s, t, 'end'); sync();
      }
    });
    btnReset.addEventListener('click', () => {
      code = b.code; ed.value = code; ed.hidden = true; src.parentElement.hidden = false; btnEdit.textContent = '編集';
      revision++;
      paint(); btnReset.hidden = true; clearResult();
    });
    btnRun.addEventListener('click', async () => {
      if (sqlController) { sqlController.abort(); return; }
      if (btnRun.getAttribute('aria-busy') === 'true') return;
      sync();
      const runningRevision = revision;
      clearResult();
      btnRun.setAttribute('aria-busy', 'true');
      const t0 = performance.now();
      try {
        let html, goalMet;
        if (lang === 'python') {
          btnRun.textContent = pySession ? '実行中…' : 'Pythonを準備中…';
          const res = await runPython(code, b.mode, b.setup || '');
          html = pyResultHTML(res);
          if (b.exercise) goalMet = !res.err && res.out.replace(/\n$/, '') === b.expected.text;
        } else {
          sqlController = new AbortController();
          btnRun.textContent = '中断';
          const items = await runSQL(code, sqlSetup, sqlController.signal);
          html = sqlResultHTML(items);
          if (b.exercise) goalMet = meetsSqlGoal(items, b.expected, b.unordered);
        }
        if (revision !== runningRevision) return;
        out.innerHTML = html;
        const ms = performance.now() - t0;
        status.textContent = 'ブラウザーで実行した結果' + (ms < 2000 ? '' : `（${(ms / 1000).toFixed(1)}秒）`);
        status.classList.add('live');
        if (b.exercise) $('.feedback', el).textContent = goalMet
          ? '目標どおりの結果です。' : '目標と結果が違います。コードを編集してもう一度実行しましょう。';
        result.hidden = false;
        announcement.textContent = '実行結果を表示しました。' + (b.exercise ? $('.feedback', el).textContent : '');
      } catch (err) {
        if (revision !== runningRevision) return;
        const unavailable = err instanceof RuntimeLoadError;
        $('.result-head .label', el).textContent = 'エラー';
        status.textContent = unavailable ? '実行環境を読み込めませんでした' : '実行できませんでした';
        out.innerHTML = `<pre><span class="err">${esc(err.message || err)}</span></pre>` +
          (unavailable ? referenceHTML(b) : '');
        result.hidden = false;
        announcement.textContent = status.textContent + '。' + (unavailable && b.expected
          ? (b.exercise ? '本書に掲載の目標の出力を参考表示しました。判定は行っていません。' : '本書に掲載の結果を参考表示しました。') : 'エラーの内容を確認してください。');
      } finally {
        sqlController = null;
        btnRun.textContent = '実行';
        btnRun.removeAttribute('aria-busy');
      }
    });
    // Start loading Python as soon as the reader shows interest in running code.
    if (lang === 'python') btnRun.addEventListener('pointerenter', () => {
      try { startPython().ready.catch(() => {}); } catch { /* Report preparation failures when Run is pressed. */ }
    }, { once: true });
  }

  // ------------------------------------------------------------- start
  const last = store.get('itbook-last');
  if (!location.hash && last && last.page && last.page !== 'intro' && pages.some(p => p.id === last.page)) {
    const p = pages.find(x => x.id === last.page);
    const r = $('#resume');
    r.href = '#' + (last.at || last.page);
    r.innerHTML = `前回の続きから読む<br><b>${esc(pageTitle(p))}</b>`;
    r.hidden = false;
    r.addEventListener('click', () => { r.hidden = true; });
  }
  route();
})();
