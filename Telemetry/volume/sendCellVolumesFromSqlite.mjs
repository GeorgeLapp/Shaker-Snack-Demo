// Требуется: npm i sqlite3
import sqlite3 from 'sqlite3';

// ---- Конфигурация SQLite ----

/**
 * Открытие базы данных SQLite.
 * Включаем foreign_keys, чтобы корректно работали ограничения и триггеры.
 */
function openDb(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else {
        db.run('PRAGMA foreign_keys = ON');
        resolve(db);
      }
    });
  });
}

/**
 * Обёртка над db.all в виде промиса.
 */
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

/**
 * Закрытие соединения с БД.
 */
function close(db) {
  return new Promise((resolve) => db.close(() => resolve()));
}

/**
 * Чтение остатков (volume) по ячейкам из БД.
 *
 * - если передан массив cellNumbers — берём только эти ячейки
 * - если не передан — берём все включённые ячейки (enabled = 1)
 *
 * @param {string} dbPath путь к SQLite-файлу (например, goods.db)
 * @param {number[]} [cellNumbers] список номеров ячеек, которые нужно прочитать
 * @returns {Promise<Array<{cellNumber:number, volume:number}>>}
 */
export async function getCellVolumes(dbPath, cellNumbers = null) {
  const db = await openDb(dbPath);

  try {
    let rows;
    if (Array.isArray(cellNumbers) && cellNumbers.length) {
      const placeholders = cellNumbers.map(() => '?').join(',');
      rows = await all(
        db,
        `
        SELECT s.cell_number AS cellNumber, s.volume
        FROM matrix_cell_state s
        JOIN matrix_cell_config c ON c.cell_number = s.cell_number
        WHERE c.enabled = 1
          AND s.cell_number IN (${placeholders})
        ORDER BY s.cell_number
        `,
        cellNumbers
      );
    } else {
      rows = await all(
        db,
        `
        SELECT s.cell_number AS cellNumber, s.volume
        FROM matrix_cell_state s
        JOIN matrix_cell_config c ON c.cell_number = s.cell_number
        WHERE c.enabled = 1
        ORDER BY s.cell_number
        `
      );
    }

    // Нормализация данных на всякий случай
    return rows.map((r) => ({
      cellNumber: Number(r.cellNumber),
      volume: Math.max(
        0,
        Number.isFinite(+r.volume) ? Math.trunc(+r.volume) : 0
      ),
    }));
  } finally {
    await close(db);
  }
}

// Локальный тестовый запуск модуля (без телеметрии)
// node sendCellVolumesFromSqlite.mjs goods.db 1 2 3
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const dbPath = process.argv[2] || 'goods.db';
    const nums = process.argv
      .slice(3)
      .map((n) => parseInt(n, 10))
      .filter(Number.isInteger);

    const cells = await getCellVolumes(
      dbPath,
      nums.length ? nums : undefined
    );

    if (!cells.length) {
      console.log('Нет ячеек для отправки (в БД нет enabled-ячееек или volume=0).');
      return;
    }

    for (const { cellNumber, volume } of cells) {
      console.log(`cell ${cellNumber} → volume=${volume}`);
    }
  })().catch((e) => {
    console.error('Error:', e.message);
    process.exitCode = 1;
  });
}
