const path = require('path');
const Database = require('better-sqlite3');

let dbInstance;

const resolveDatabasePath = () => {
  return process.env.PRODUCTS_DB_PATH
    ? path.resolve(process.env.PRODUCTS_DB_PATH)
    : path.resolve(__dirname, '../../..', 'DB', 'products_db.db');
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
