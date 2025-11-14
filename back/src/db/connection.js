const path = require('path');
const Database = require('better-sqlite3');

let dbInstance;

const resolveDatabasePath = () => {
  const customPath = process.env.GOODS_DB_PATH || process.env.PRODUCTS_DB_PATH;

  if (customPath) {
    return path.resolve(customPath);
  }

  return path.resolve(__dirname, '../../..', 'Telemetry', 'goods.db');
};

const createDatabaseInstance = () => {
  const dbPath = resolveDatabasePath();

  try {
    return new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (error) {
    error.message = `Failed to open SQLite database at ${dbPath}: ${error.message}`;
    throw error;
  }
};

const getDb = () => {
  if (!dbInstance) {
    dbInstance = createDatabaseInstance();
  }

  return dbInstance;
};

module.exports = {
  getDb,
};
