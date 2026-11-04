// One run owns one in-memory database. The page can terminate this worker.
importScripts('runtime/sql-asm.js', 'sqlrun.js');
self.onmessage = async ({data}) => {
  try {
    const SQL = await initSqlJs();
    self.postMessage({items: BookSQL.run(SQL, data.setup, data.code)});
  } catch (error) {
    self.postMessage({error: String(error.message || error)});
  }
};
