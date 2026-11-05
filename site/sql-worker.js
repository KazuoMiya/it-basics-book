// One run owns one in-memory database. The page can terminate this worker.
self.onmessage = async ({data}) => {
  let SQL;
  try {
    importScripts('runtime/sql-asm.js', 'sqlrun.js');
    SQL = await initSqlJs();
  } catch (error) {
    self.postMessage({phase: 'load', error: String(error.message || error)});
    return;
  }
  self.postMessage({type: 'booted'});
  try {
    self.postMessage({items: BookSQL.run(SQL, data.setup, data.code)});
  } catch (error) {
    self.postMessage({error: String(error.message || error)});
  }
};
