// Node 18+
// npm i sqlite3
import sqlite3 from 'sqlite3';
import { randomUUID } from 'crypto';

/** tiny sqlite3 helpers */
function openDb(path) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path, sqlite3.OPEN_READONLY, (err) => err ? reject(err) : resolve(db));
  });
}
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (e, rows) => e ? reject(e) : resolve(rows || [])));
}
function closeDb(db) {
  return new Promise((resolve) => db.close(() => resolve()));
}

/** загрузить «снимок» матрицы из БД и привести к формату телеметрии */
async function loadMatrixFromSqlite(dbPath) {
  const db = await openDb(dbPath);
  try {
    const viewExists = await all(db, "SELECT name FROM sqlite_master WHERE type='view' AND name='vw_matrix_cell_full'");
    let rows;
    if (viewExists.length) {
      rows = await all(db, `
        SELECT cell_number, row_number, size, good_id,
               COALESCE(price_minor, NULL) AS price_minor,
               volume, max_volume, enabled
          FROM vw_matrix_cell_full
         ORDER BY cell_number ASC`);
    } else {
      rows = await all(db, `
        SELECT
          c.cell_number,
          c.row_number,
          c.size,
          c.good_id,
          COALESCE(c.price_minor, p.price_minor) AS price_minor,
          s.volume,
          s.max_volume,
          c.enabled
        FROM matrix_cell_config c
        LEFT JOIN matrix_cell_state s ON s.cell_number = c.cell_number
        LEFT JOIN catalog_product   p ON p.id = c.good_id
        ORDER BY c.cell_number ASC`);
    }

    const matrix = rows.map(r => ({
      cellNumber: Number(r.cell_number),
      rowNumber:  r.row_number != null ? Number(r.row_number) : null,
      price:      r.price_minor != null ? Number(r.price_minor) : null, // price ← price_minor
      goodId:     r.good_id != null ? String(r.good_id) : null,
      size:       r.size != null ? Number(r.size) + 1 : 1,              // 0/1/2 → 1/2/3
      volume:     r.volume != null ? Number(r.volume) : 0,
      maxVolume:  r.max_volume != null ? Number(r.max_volume) : 0,
      isActive:   Boolean(r.enabled),
    }));

    // базовая целостность
    const seen = new Set();
    for (const [i, c] of matrix.entries()) {
      if (seen.has(c.cellNumber)) throw new Error(`Duplicate cellNumber=${c.cellNumber} at index ${i}`);
      seen.add(c.cellNumber);
      if (!(c.volume >= 0 && c.maxVolume >= 0 && c.volume <= c.maxVolume)) {
        throw new Error(`Volume bounds failed for cellNumber=${c.cellNumber}: volume=${c.volume} max=${c.maxVolume}`);
      }
    }
    return matrix;
  } finally {
    await closeDb(db);
  }
}

/** построить Готовый payload для matrixImportTopicSnack (с requestUuid) */
export async function buildMatrixImportPayload({ dbPath = 'goods.db', clientId, machineId, requestUuid }) {
  if (!clientId)  throw new Error('clientId is required');
  if (!machineId) throw new Error('machineId is required');

  const matrix = await loadMatrixFromSqlite(dbPath);
  const reqId = requestUuid || randomUUID();

  return {
    payload: {
      clientId,
      type: 'matrixImportTopicSnack',
      body: { requestUuid: reqId, machineId, matrix }
    },
    requestUuid: reqId,
    matrixCount: matrix.length,
  };
}

// опциональный CLI-тест: просто показать первые строки матрицы
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] || 'goods.db';
  const clientId = process.env.SHAKER_CLIENT_ID || 'snack_02';
  const machineId = process.env.SHAKER_MACHINE_ID || 'MACHINE_ID_001';
  buildMatrixImportPayload({ dbPath, clientId, machineId })
    .then(({ payload, matrixCount }) => {
      console.log(`Matrix cells: ${matrixCount}`);
      console.log(JSON.stringify(payload.body.matrix.slice(0, 5), null, 2), matrixCount > 5 ? '...' : '');
    })
    .catch(e => { console.error('DB/payload error:', e.message); process.exit(1); });
}
