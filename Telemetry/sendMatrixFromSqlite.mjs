// Node 18+
// npm i sqlite3
import sqlite3 from 'sqlite3';

/**
 * Открыть SQLite в READONLY.
 */
function openDb(path) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}
function closeDb(db) {
  return new Promise((resolve) => db.close(() => resolve()));
}

/**
 * Загрузить «снимок» матрицы из БД и привести к формату телеметрии.
 * Поля берём из вашей схемы:
 * - cell_number, row_number, size, good_id, price_minor, enabled, volume, max_volume. 
 * Цена телеметрии = price ← price_minor (без конвертации/пересчётов). :contentReference[oaicite:4]{index=4}
 * size в БД: 0/1/2 (одинар/сдвоен/тройной) → в телеметрии: 1/2/3. :contentReference[oaicite:5]{index=5}
 */
export async function loadMatrixFromSqlite(dbPath = 'goods.db') {
  const db = await openDb(dbPath);
  try {
    // Если есть представление vw_matrix_cell_full — используем его (предпочтительно). :contentReference[oaicite:6]{index=6}
    const viewExists = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='view' AND name='vw_matrix_cell_full'"
    );

    let rows;
    if (viewExists.length) {
      rows = await all(
        db,
        `SELECT cell_number, row_number, size, good_id,
                COALESCE(price_minor, NULL) AS price_minor,
                volume, max_volume, enabled
           FROM vw_matrix_cell_full
          ORDER BY cell_number ASC`
      );
    } else {
      // Fallback: прямые JOIN-ы конфигурации и состояния + цена из config/product. 
      rows = await all(
        db,
        `SELECT
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
         ORDER BY c.cell_number ASC`
      );
    }

    // Маппинг → формат matrixImportTopicSnack. :contentReference[oaicite:8]{index=8}
    const matrix = rows.map((r) => ({
      cellNumber: Number(r.cell_number),
      rowNumber:  r.row_number != null ? Number(r.row_number) : null,
      price:      r.price_minor != null ? Number(r.price_minor) : null, // price ← price_minor
      goodId:     r.good_id != null ? String(r.good_id) : null,
      size:       r.size != null ? Number(r.size) + 1 : 1,              // 0/1/2 → 1/2/3
      volume:     r.volume != null ? Number(r.volume) : 0,
      maxVolume:  r.max_volume != null ? Number(r.max_volume) : 0,
      isActive:   Boolean(r.enabled),
    }));

    // Базовая локальная проверка целостности: уникальный cellNumber и 0 ≤ volume ≤ maxVolume.
    const seen = new Set();
    for (const [i, c] of matrix.entries()) {
      if (seen.has(c.cellNumber)) {
        throw new Error(`Duplicate cellNumber=${c.cellNumber} at index ${i}`);
      }
      seen.add(c.cellNumber);
      if (!(c.volume >= 0 && c.maxVolume >= 0 && c.volume <= c.maxVolume)) {
        throw new Error(
          `Volume bounds failed for cellNumber=${c.cellNumber}: volume=${c.volume} max=${c.maxVolume}`
        );
      }
    }

    return matrix;
  } finally {
    await closeDb(db);
  }
}

// CLI для отладки: node sendMatrixFromSqlite.mjs [dbPath]
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] || 'goods.db';
  loadMatrixFromSqlite(dbPath)
    .then((m) => {
      console.log(`Loaded cells: ${m.length}`);
      console.log(JSON.stringify(m.slice(0, 5), null, 2), m.length > 5 ? '...' : '');
    })
    .catch((e) => {
      console.error('DB error:', e.message);
      process.exit(1);
    });
}
