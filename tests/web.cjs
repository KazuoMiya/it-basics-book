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

  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({contentType: 'text/css', body: ''}));
  let count = 0;
  for (const id of ['ch2', 'ch3', 'ch4', 'ch5']) {
    await chapter(id);
    for (let i = 0; i < await blocks.count(); i++) {
      const b = blocks.nth(i);
      const index = Number(await b.getAttribute('data-run'));
      const example = await page.evaluate(index => BOOK.runs[index], index);
      await run(i);
      assert.match(await b.locator('.status').textContent(), /ブラウザーで実行/);
      if (example.lang === 'python') {
        const output = (await b.locator('.out pre').textContent()).trimEnd();
        const expected = example.mode === 'repl' ? example.code : example.expected?.text;
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
      count++;
    }
  }
  console.log(count + ' runnable examples verified');

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
  await blocks.first().getByText('4500001500000', {exact: true}).waitFor();
  const infinite = 'WITH RECURSIVE s(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM s) SELECT sum(i) FROM s';
  await edit(0, infinite);
  await blocks.first().locator('.btn-run').click();
  await blocks.first().getByRole('button', {name: '中断'}).click({timeout: 3000});
  await blocks.first().locator('.out .err').waitFor();
  assert.match(await blocks.first().innerText(), /中断しました/);
  assert.match(await sql(infinite), /10秒/);
  assert.match(await sql('SELECT 42'), /42/);

  await chapter('ch2');
  await edit(1, `from js import XMLHttpRequest\nx = XMLHttpRequest.new()\nx.open('GET', '${base}review-ping', False)\nx.send()`);
  assert.match(await run(1), /NetworkError|SecurityError/);
  await edit(1, `from js import fetch\nfetch('${base}review-ping')\nprint('attempted')`);
  assert.match(await run(1), /attempted/);
  await edit(1, 'while True: pass');
  await blocks.nth(1).locator('.btn-run').click();
  await page.waitForTimeout(3500);
  await edit(2, "print('queued')");
  await blocks.nth(2).locator('.btn-run').click();
  await blocks.nth(1).locator('.out .err').waitFor();
  await blocks.nth(2).locator('.out .err').waitFor();
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

async function main() {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({executablePath: process.env.CHROME_PATH || undefined});
    const page = await browser.newPage();
    await verify(page, 'http://127.0.0.1:' + server.address().port + '/');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
