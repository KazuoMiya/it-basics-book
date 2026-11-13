// Run against a fresh build with playwright-core and Chrome (see README).
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {once} = require('node:events');
const {chromium} = require('playwright-core');

const site = path.resolve(process.argv[2] || '_site');
const mediaTypes = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.wasm': 'application/wasm'};
let pingCount = 0;
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/review-ping') { pingCount++; res.end('ok'); return; }
  const file = path.resolve(site, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(site + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {'Content-Type': mediaTypes[path.extname(file)] || 'application/octet-stream'}).end(body);
  } catch { res.writeHead(404).end(); }
});

async function verify(page, base) {
  const blocks = page.locator('#page .code.run');
  async function chapter(id) {
    await page.goto(base + '#' + id);
    await page.waitForFunction(id => document.querySelector('li.current')?.dataset.page === id, id);
  }
  async function edit(i, code) {
    const b = blocks.nth(i);
    if (await b.locator('.editor').isHidden()) await b.locator('.btn-edit').click();
    await b.locator('.editor').fill(code);
  }
  async function run(i) {
    const b = blocks.nth(i);
    await b.locator('.btn-run').click();
    await page.waitForFunction(i => !document.querySelectorAll('#page .code.run')[i]
      .querySelector('.btn-run').hasAttribute('aria-busy'), i, {timeout: 55000});
    return b.locator('.out').innerText();
  }

  async function checkResultHidden(block) {
    assert.equal(await block.locator('.result').isHidden(), true);
    assert.equal(await block.locator('.out').textContent(), '');
    assert.equal(await block.locator('.announcement').textContent(), '');
  }
  const exercises = {
    'photo-limit': {from: 'size_mb >= 5', to: 'size_mb > 5', initial: '4 MB そのまま\n5 MB 圧縮\n6 MB 圧縮'},
    'likes-ranking': {from: 'lambda post: post["likes"]', to: 'lambda post: int(post["likes"])', initial: '9 花の写真\n24 海の写真\n105 星の写真'},
    'order-count': {from: 'SUM(quantity)', to: 'COUNT(*)', initial: [['101', '3'], ['102', '1'], ['103', '5']]},
  };
  const exercised = new Set();

  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({contentType: 'text/css', body: ''}));
  let count = 0;
  for (const id of ['ch2', 'ch3', 'ch4', 'ch5']) {
    await chapter(id);
    for (let i = 0; i < await blocks.count(); i++) {
      const b = blocks.nth(i);
      const index = Number(await b.getAttribute('data-run'));
      const example = await page.evaluate(index => BOOK.runs[index], index);
      await checkResultHidden(b);
      assert.equal(await b.locator('.announcement').getAttribute('role'), 'status');
      assert.equal(await b.locator('.announcement').getAttribute('aria-live'), 'polite');
      assert.equal(await b.locator('.announcement').getAttribute('aria-atomic'), 'true');
      if (example.mode === 'repl') {
        const shown = await b.locator('.src').textContent();
        assert.ok(shown.split('\n').every(l => l.startsWith('>>>') || l.startsWith('...')));
        await b.locator('.btn-edit').click();
        assert.equal(await b.locator('.editor').inputValue(), shown);
        await b.locator('.btn-edit').click();
      }
      await run(i);
      assert.ok(await b.locator('.result').isVisible());
      assert.match(await b.locator('.status').textContent(), /ブラウザーで実行/);
      assert.match(await b.locator('.announcement').textContent(), /実行結果を表示しました/);
      assert.equal(await b.locator('.reference').count(), 0);
      if (example.exercise) {
        const fix = exercises[example.exercise];
        assert.match(await b.locator('.feedback').innerText(), /目標と結果が違います/);
        assert.match(await b.locator('.announcement').textContent(), /目標と結果が違います/);
        if (example.lang === 'python') {
          assert.equal(await b.locator('.out pre').innerText(), fix.initial);
        } else {
          assert.deepEqual(await b.locator('.out table').evaluate(t =>
            [...t.tBodies[0].rows].map(r => [...r.cells].map(c => c.textContent))), fix.initial);
        }
        const corrected = example.code.replace(fix.from, fix.to);
        assert.notEqual(corrected, example.code);
        await edit(i, corrected);
        await checkResultHidden(b);
        await run(i);
        assert.equal(await b.locator('.feedback').innerText(), '目標どおりの結果です。');
        assert.match(await b.locator('.announcement').textContent(), /目標どおりの結果/);
        exercised.add(example.exercise);
      }
      if (example.lang === 'python') {
        const output = (await b.locator('.out pre').textContent()).trimEnd();
        const expected = example.expected?.text;
        if (expected !== undefined) assert.equal(output, expected);
        else assert.ok(output.length > 0);
      } else {
        assert.equal(await b.locator('.out .err').count(), 0);
        if (example.expected) {
          const table = b.locator('.out table').first();
          const rows = await table.evaluate(t => [...t.tBodies[0].rows].map(r => [...r.cells].map(c => c.textContent)));
          const expected = example.expected.rows;
          if (example.unordered) { rows.sort(); expected.sort(); }
          assert.deepEqual(rows, expected);
        }
      }
      if (example.exercise) {
        await b.locator('.btn-reset').click();
        await checkResultHidden(b);
        assert.equal(await b.locator('.src').textContent(), example.code);
        await run(i);
        assert.match(await b.locator('.feedback').innerText(), /目標と結果が違います/);
      }
      count++;
    }
  }
  assert.deepEqual([...exercised].sort(), Object.keys(exercises).sort());
  console.log(count + ' runnable examples verified, including 3 edit/run/reset exercises');
  const cdp = await page.context().newCDPSession(page);
  const {nodes} = await cdp.send('Accessibility.getFullAXTree');
  assert.ok(nodes.some(n => n.role?.value === 'status' && !n.ignored &&
    n.properties.some(p => p.name === 'live' && p.value.value === 'polite') &&
    n.properties.some(p => p.name === 'atomic' && p.value.value === true)));
  await cdp.detach();

  const sql = async code => { await edit(0, code); return run(0); };
  const limited = await sql('WITH RECURSIVE s(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM s WHERE i<100000) SELECT i FROM s');
  assert.match(limited, /省略/);
  assert.equal(await blocks.first().locator('.out tbody tr').count(), 200);
  assert.match(await sql("SELECT printf('%10000s','x')"), /省略/);
  const snapshot = await sql('CREATE TABLE many(n); WITH RECURSIVE s(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM s WHERE i<25000) INSERT INTO many SELECT i FROM s');
  assert.match(snapshot, /省略/);
  assert.equal(await blocks.first().locator('.out tbody tr').count(), 200);
  await edit(0, 'WITH RECURSIVE s(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM s WHERE i<3000000) SELECT sum(i) FROM s');
  const responsive = await blocks.first().locator('.btn-run').evaluate(button => {
    return new Promise(resolve => {
      setTimeout(() => resolve(button.hasAttribute('aria-busy')), 0);
      button.click();
    });
  });
  assert.ok(responsive, 'UI timer must run while the aggregate is still executing');
  const aggregate = blocks.first();
  await page.waitForFunction(() => !document.querySelector('#page .code.run .btn-run').hasAttribute('aria-busy'));
  const result = await aggregate.locator('.out').innerText();
  if (await aggregate.locator('.out .err').count()) {
    assert.match(result, /SQLの実行が10秒を超えたため停止/);
    console.log('3 million rows reached the 10-second deadline; UI stayed responsive');
  } else {
    assert.equal(await aggregate.locator('.out td').innerText(), '4500001500000');
    console.log('3 million rows returned the correct sum; UI stayed responsive');
  }
  assert.match(await sql('WITH RECURSIVE s(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM s WHERE i<30000) SELECT sum(i) FROM s'), /450015000/);
  const infinite = 'WITH RECURSIVE s(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM s) SELECT sum(i) FROM s';
  await edit(0, infinite);
  await blocks.first().locator('.btn-run').click();
  await checkResultHidden(blocks.first());
  await blocks.first().getByRole('button', {name: '中断'}).click({timeout: 3000});
  await blocks.first().locator('.out .err').waitFor();
  assert.match(await blocks.first().innerText(), /中断しました/);
  assert.equal(await blocks.first().locator('.reference').count(), 0);
  assert.match(await sql(infinite), /10秒/);
  assert.equal(await blocks.first().locator('.reference').count(), 0);
  assert.match(await sql('SELEC 1'), /エラー/);
  assert.equal(await blocks.first().locator('.reference').count(), 0);
  assert.match(await sql('SELECT 42'), /42/);

  // A late response must not repopulate the result for a different edit.
  await edit(0, 'SELECT 99');
  await blocks.first().evaluate(block => {
    block.querySelector('.btn-run').click();
    const editor = block.querySelector('.editor');
    editor.value = 'SELECT 100';
    editor.dispatchEvent(new Event('input'));
  });
  await page.waitForFunction(() => !document.querySelector('#page .code.run .btn-run').hasAttribute('aria-busy'));
  await checkResultHidden(blocks.first());
  assert.match(await run(0), /100/);

  await chapter('ch2');
  await edit(1, `from js import XMLHttpRequest\nx = XMLHttpRequest.new()\nx.open('GET', '${base}review-ping', False)\nx.send()`);
  assert.match(await run(1), /NetworkError|SecurityError/);
  assert.equal(await blocks.nth(1).locator('.reference').count(), 0);
  await edit(1, `from js import fetch\nfetch('${base}review-ping')\nprint('attempted')`);
  assert.match(await run(1), /attempted/);
  await edit(1, 'while True: pass');
  await blocks.nth(1).locator('.btn-run').click();
  await page.waitForTimeout(3500);
  await edit(2, "print('queued')");
  await blocks.nth(2).locator('.btn-run').click();
  await blocks.nth(1).locator('.out .err').waitFor();
  await blocks.nth(2).locator('.out .err').waitFor();
  assert.equal(await blocks.nth(1).locator('.reference').count(), 0);
  assert.equal(await blocks.nth(2).locator('.reference').count(), 0);
  await edit(3, "import time\nt = time.monotonic()\nwhile time.monotonic()-t < 5.2: pass\nprint('completed')");
  assert.match(await run(3), /completed/);
  assert.equal(pingCount, 0);

  for (const hash of ['%', 'ch9-x', 'ch1-unknown', 'constructor']) {
    await page.goto(base + '#' + hash);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#page .chap-label')?.textContent === '序論');
  }
  console.log('SQL limits/cancellation, Python network/timeout recovery, and invalid routes verified');
}

async function verifyLoadFailures(browser, base) {
  // Fresh pages prevent a previously cached Python runtime from masking a load failure.
  for (const lang of ['sql', 'python']) {
    const chapter = lang === 'sql' ? 'ch5' : 'ch3';
    const asset = lang === 'sql' ? '**/sql-worker.js' : '**/runtime/pyodide.asm.wasm';
    const page = await browser.newPage();
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({contentType: 'text/css', body: ''}));
    await page.route(asset, r => r.abort());
    await page.goto(base + '#' + chapter);
    const blocks = page.locator('#page .code.run');
    const index = await blocks.evaluateAll(bs => bs.findIndex(b => {
      const ex = BOOK.runs[Number(b.dataset.run)];
      return ex.expected && !ex.exercise;
    }));
    const block = blocks.nth(index);
    async function run(b) {
      await b.locator('.btn-run').click();
      await page.waitForFunction(id => !document.querySelector(`[data-run="${id}"] .btn-run`).hasAttribute('aria-busy'),
        await b.getAttribute('data-run'), {timeout: 55000});
    }
    const expected = await block.evaluate(b => BOOK.runs[Number(b.dataset.run)].expected);
    await run(block);
    assert.match(await block.locator('.status').textContent(), /実行環境を読み込めません/);
    assert.match(await block.locator('.reference').innerText(), /本書に掲載の結果/);
    if (lang === 'sql') {
      assert.deepEqual(await block.locator('.reference tbody').evaluate(t =>
        [...t.rows].map(r => [...r.cells].map(c => c.textContent))), expected.rows);
    } else {
      assert.equal(await block.locator('.reference pre').textContent(), expected.text);
    }
    assert.match(await block.locator('.announcement').textContent(), /参考表示/);
    // The reference belongs to the manuscript even if the reader has edited the code.
    await block.locator('.btn-edit').click();
    await block.locator('.editor').fill(lang === 'sql' ? 'SELECT 98765' : 'print(98765)');
    assert.equal(await block.locator('.result').isHidden(), true);
    await run(block);
    assert.match(await block.locator('.reference').innerText(), /編集したコードの実行結果ではありません/);
    assert.doesNotMatch(await block.locator('.reference').innerText(), /98765/);
    const exerciseIndex = await blocks.evaluateAll(bs => bs.findIndex(b => BOOK.runs[Number(b.dataset.run)].exercise));
    const exercise = blocks.nth(exerciseIndex);
    assert.ok(await exercise.evaluate(b => BOOK.runs[Number(b.dataset.run)].exercise));
    await run(exercise);
    assert.match(await exercise.locator('.reference').innerText(), /本書に掲載の目標の出力（修正後）/);
    assert.equal(await exercise.locator('.feedback').textContent(), '');
    assert.match(await exercise.locator('.announcement').textContent(), /判定は行っていません/);
    const noReferenceIndex = await blocks.evaluateAll(bs => bs.findIndex(b => !BOOK.runs[Number(b.dataset.run)].expected));
    const noReference = blocks.nth(noReferenceIndex);
    await run(noReference);
    assert.equal(await noReference.locator('.reference').count(), 0);
    assert.match(await noReference.locator('.out').innerText(), /本書に掲載の結果がありません/);
    // A failed load arriving after an edit must not insert a stale reference either.
    await block.evaluate(b => {
      b.querySelector('.btn-run').click();
      const editor = b.querySelector('.editor');
      editor.value += '\n';
      editor.dispatchEvent(new Event('input'));
    });
    await page.waitForFunction(id => !document.querySelector(`[data-run="${id}"] .btn-run`).hasAttribute('aria-busy'),
      await block.getAttribute('data-run'));
    assert.equal(await block.locator('.result').isHidden(), true);
    assert.equal(await block.locator('.out').textContent(), '');
    await page.unroute(asset);
    await run(block);
    assert.match(await block.locator('.out').innerText(), /98765/);
    assert.equal(await block.locator('.reference').count(), 0);
    assert.match(await block.locator('.status').textContent(), /ブラウザーで実行/);
    await block.locator('.btn-reset').click();
    assert.equal(await block.locator('.result').isHidden(), true);
    assert.equal(await block.locator('.out').textContent(), '');
    await page.close();
  }

  // Exercise each initialization boundary, including APIs absent in an older browser.
  const failures = [
    {chapter: 'ch5', asset: '**/runtime/sql-asm.js', body: "self.initSqlJs = async () => { throw new Error('init failed'); };"},
    {chapter: 'ch3', asset: '**/py-worker.js', body: "self.onmessage = () => self.postMessage({type: 'failed', message: 'boot failed'});"},
    {chapter: 'ch5', init: () => { window.Worker = undefined; }},
    {chapter: 'ch3', init: () => { window.MessageChannel = undefined; }},
    {chapter: 'ch5', asset: '**/sql-worker.js', body: 'self.onmessage = () => {};', timeout: 10001},
    {chapter: 'ch3', asset: '**/py-worker.js', body: 'self.onmessage = () => {};', timeout: 45001},
  ];
  for (const test of failures) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({contentType: 'text/css', body: ''}));
    if (test.init) await page.addInitScript(test.init);
    if (test.asset) await page.route(test.asset, r => r.fulfill({contentType: 'text/javascript', body: test.body}));
    if (test.timeout) await page.clock.install();
    await page.goto(base + '#' + test.chapter);
    const blocks = page.locator('#page .code.run');
    const index = await blocks.evaluateAll(bs => bs.findIndex(b => BOOK.runs[Number(b.dataset.run)].expected));
    const block = blocks.nth(index);
    // dispatch avoids starting Python's speculative preparation via pointerenter.
    await block.locator('.btn-run').dispatchEvent('click');
    if (test.timeout) await page.clock.fastForward(test.timeout);
    await block.locator('.reference').waitFor();
    assert.match(await block.locator('.status').textContent(), /実行環境を読み込めません/);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Runtime load failures, initialization deadlines, references, retries, and live announcements verified');
}

async function main() {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({executablePath: process.env.CHROME_PATH || undefined});
    const page = await browser.newPage();
    const base = 'http://127.0.0.1:' + server.address().port + '/';
    await verify(page, base);
    await page.close();
    await verifyLoadFailures(browser, base);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
