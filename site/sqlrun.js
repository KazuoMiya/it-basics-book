// SQL runner shared by the web book and the Node test.
(function (root) {
  const SAMPLE = (root.BOOK && root.BOOK.sample) || {};

  function setupSql(tables) {
    return tables.map(t => SAMPLE[t]).join('\n\n');
  }

  function tableRows(db, table) {
    const r = db.exec(`SELECT * FROM "${table}"`);
    if (!r.length) {
      const info = db.exec(`PRAGMA table_info("${table}")`);
      return { columns: info.length ? info[0].values.map(v => v[1]) : [], rows: [] };
    }
    return { columns: r[0].columns, rows: r[0].values };
  }

  const VERB = { INSERT: '追加', UPDATE: '変更', DELETE: '削除' };

  function run(SQL, tables, code) {
    const db = new SQL.Database();
    const out = [];
    try {
      db.exec('PRAGMA foreign_keys = ON;');
      db.exec(setupSql(tables));
      const touched = [];
      try {
        for (const stmt of db.iterateStatements(code)) {
          const text = stmt.getSQL().replace(/^\s*(--[^\n]*\n\s*)*/, '').trim();
          const head = text.split(/[\s;]+/)[0].toUpperCase();
          const cols = stmt.getColumnNames();
          if (cols.length) {
            const rows = [];
            while (stmt.step()) rows.push(stmt.get());
            out.push({ type: 'rows', columns: cols, rows });
          } else {
            stmt.step();
            if (VERB[head]) {
              const m = text.match(/^(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+["`]?(\w+)/i);
              const table = m ? m[1] : '';
              out.push({ type: 'change', verb: VERB[head], table, n: db.getRowsModified() });
              if (table && !touched.includes(table)) touched.push(table);
            } else if (/^CREATE\s+TABLE/i.test(text)) {
              const m = text.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)/i);
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
        try { out.push({ type: 'snapshot', table: t, ...tableRows(db, t) }); } catch (e) { /* table may be gone */ }
      }
    } finally {
      db.close();
    }
    return out;
  }

  const api = { SAMPLE, setupSql, run };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BookSQL = api;
})(typeof self !== 'undefined' ? self : this);
