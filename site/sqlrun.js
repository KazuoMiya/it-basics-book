// SQL runner shared by the web book and the Node test.
(function (root) {
  const MAX_STATEMENTS = 100;
  function readTable(stmt, budget) {
    const names = stmt.getColumnNames();
    const columns = names.slice(0, 40).map(c => c.slice(0, 128));
    const rows = [];
    let truncated = names.length > columns.length || names.some(c => c.length > 128);
    while (stmt.step()) {
      if (!budget.rows || budget.chars <= 0) { truncated = true; break; }
      const row = stmt.get().slice(0, columns.length).map(value => {
        if (value === null) return null;
        if (value instanceof Uint8Array) return '[BLOB ' + value.length + ' bytes]';
        const text = String(value);
        const limit = Math.min(budget.chars, 2048);
        budget.chars -= Math.min(limit, text.length);
        if (text.length <= limit) return value;
        truncated = true;
        return text.slice(0, limit) + '…';
      });
      rows.push(row);
      budget.rows--;
    }
    return {columns, rows, truncated};
  }

  function tableRows(db, table, budget) {
    const stmt = db.prepare(`SELECT * FROM "${table}"`);
    try { return readTable(stmt, budget); }
    finally { stmt.free(); }
  }

  const VERB = { INSERT: '追加', UPDATE: '変更', DELETE: '削除' };

  function run(SQL, setup, code) {
    if (code.length > 65536) throw new Error('SQLは65,536文字以内で入力してください。');
    const db = new SQL.Database();
    const out = [];
    try {
      db.exec('PRAGMA foreign_keys = ON;');
      db.exec(setup);
      const budget = {rows: 200, chars: 65536};
      const touched = [];
      try {
        for (const stmt of db.iterateStatements(code)) {
          if (out.length >= MAX_STATEMENTS) {
            out.push({type: 'limit', message: '100文を超えたので、残りのSQLは実行していません。'});
            break;
          }
          const text = stmt.getSQL().replace(/^\s*(--[^\n]*\n\s*)*/, '').trim();
          const head = text.split(/[\s;]+/)[0].toUpperCase();
          const cols = stmt.getColumnNames();
          if (cols.length) {
            out.push({ type: 'rows', ...readTable(stmt, budget) });
          } else {
            stmt.step();
            if (VERB[head]) {
              const m = text.match(/^(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM)\s+["`]?(\w+)/i);
              const table = m ? m[1] : '';
              out.push({ type: 'change', verb: VERB[head], table, n: db.getRowsModified() });
              if (table && !touched.includes(table)) touched.push(table);
            } else if (/^CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE/i.test(text)) {
              const m = text.match(/^CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)/i);
              out.push({ type: 'create', table: m ? m[1] : '' });
              if (m && !touched.includes(m[1])) touched.push(m[1]);
            } else if (/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(text)) {
              const m = text.match(/INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s+ON\s+["`]?(\w+)/i);
              out.push({ type: 'index', name: m ? m[1] : '', table: m ? m[2] : '' });
            } else if (/^(BEGIN|COMMIT|ROLLBACK|END)/i.test(text)) {
              out.push({ type: 'tx', verb: head });
            } else {
              out.push({ type: 'ok', head });
            }
          }
          stmt.free();
        }
      } catch (e) {
        out.push({ type: 'error', message: String(e.message || e) });
      }
      for (const t of touched) {
        try { out.push({ type: 'snapshot', table: t, ...tableRows(db, t, budget) }); } catch (e) { /* table may be gone */ }
      }
    } finally {
      db.close();
    }
    return out;
  }

  const api = { run };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BookSQL = api;
})(typeof self !== 'undefined' ? self : this);
