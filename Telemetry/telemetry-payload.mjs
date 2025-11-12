// telemetry-payload.mjs
// Назначение: читать из SQLite текущее наполнение и собирать ГОТОВЫЙ JSON
// для отправки в телеметрию (type: "cellStoreImportTopicSnack").
// Здесь сосредоточена вся логика: SQL, маппинг, валидация, построение сообщения.
//
// ВАЖНО:
//  - price = price_minor (оба REAL, рубли). НИКАКИХ конвертаций!
//  - size НЕ МЕНЯЕМ — отправляем как есть из БД.
//  - Поддержка: все enabled ячейки или конкретный список cell_number.
//
// Экспорт:
//   - buildCellStoreMessageForAll({ dbPath, clientId, machineId })
//   - buildCellStoreMessageForCells({ dbPath, clientId, machineId, cellNumbers })
//
// Зависимости: sqlite3, uuid

import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

/** Маппинг строки представления -> объект ячейки телеметрии */
function mapRowToCell(row) {
  // price = price_minor (REAL, рубли) — без изменений
  const price = row.price_minor != null ? Number(row.price_minor) : 0;

  // size — как в БД, без преобразований
  const size = Number(row.size ?? 0);

  return {
    cellNumber: Number(row.cell_number),
    price,                               // REAL, рубли
    goodId: String(row.good_id ?? ''),
    size,                                // без изменений
    volume: Number(row.volume ?? 0),
    maxVolume: Number(row.max_volume ?? 0),
  };
}

/** Базовая валидация перед отправкой (значения НЕ меняем) */
function validateCells(cells) {
  const errors = [];
  for (const c of cells) {
    if (!Number.isInteger(c.cellNumber)) errors.push(`cellNumber must be integer: ${c.cellNumber}`);
    if (typeof c.price !== 'number' || Number.isNaN(c.price)) {
      errors.push(`price must be number (REAL) for cell ${c.cellNumber}`);
    }
    if (typeof c.goodId !== 'string' || c.goodId.length === 0) {
      errors.push(`goodId must be non-empty string for cell ${c.cellNumber}`);
    }
    if (!Number.isInteger(c.size)) errors.push(`size must be integer for cell ${c.cellNumber}`);
    if (!Number.isInteger(c.volume) || c.volume < 0) {
      errors.push(`volume must be >=0 integer for cell ${c.cellNumber}`);
    }
    if (!Number.isInteger(c.maxVolume) || c.maxVolume < 0) {
      errors.push(`maxVolume must be >=0 integer for cell ${c.cellNumber}`);
    }
  }
  return errors;
}

/** Чтение всех enabled=1 ячеек */
function readCellsAll(dbPath) {
  const sql = `
    SELECT
      cell_number,
      size,
      good_id,
      price_minor,   -- REAL (рубли)
      volume,
      max_volume,
      enabled
    FROM vw_matrix_cell_full
    WHERE enabled = 1
    ORDER BY cell_number ASC
  `;
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });
    db.all(sql, [], (err, rows) => {
      if (err) {
        db.close(() => reject(err));
        return;
      }
      const cells = rows.map(mapRowToCell);
      db.close(() => resolve(cells));
    });
  });
}

/** Чтение списка ячеек по cell_number (без фильтра enabled) */
function readCellsByNumbers(dbPath, cellNumbers) {
  if (!Array.isArray(cellNumbers) || cellNumbers.length === 0) return Promise.resolve([]);
  const placeholders = cellNumbers.map(() => '?').join(', ');
  const sql = `
    SELECT
      cell_number,
      size,
      good_id,
      price_minor,   -- REAL (рубли)
      volume,
      max_volume,
      enabled
    FROM vw_matrix_cell_full
    WHERE cell_number IN (${placeholders})
    ORDER BY cell_number ASC
  `;
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });
    db.all(sql, cellNumbers, (err, rows) => {
      if (err) {
        db.close(() => reject(err));
        return;
      }
      const cells = rows.map(mapRowToCell);
      db.close(() => resolve(cells));
    });
  });
}

/** Вспомогательно: собираем готовое сообщение для телеметрии */
function buildCellStoreMessage({ clientId, machineId, cells }) {
  const requestUuid = uuidv4();
  return {
    clientId,
    type: 'cellStoreImportTopicSnack',
    body: {
      requestUuid,
      machineId,
      cells,
    },
  };
}

/** Публично: все enabled ячейки → готовый JSON */
export async function buildCellStoreMessageForAll({ dbPath, clientId, machineId }) {
  const cells = await readCellsAll(dbPath);
  const validation = validateCells(cells);
  if (validation.length) {
    throw new Error('Validation failed:\n - ' + validation.join('\n - '));
  }
  return buildCellStoreMessage({ clientId, machineId, cells });
}

/** Публично: выбранные cell_number → готовый JSON */
export async function buildCellStoreMessageForCells({ dbPath, clientId, machineId, cellNumbers }) {
  if (!Array.isArray(cellNumbers) || cellNumbers.length === 0) {
    throw new Error('cellNumbers must be a non-empty array of integers');
  }
  const cells = await readCellsByNumbers(dbPath, cellNumbers);

  // проверим, что все запрошенные найдены
  const got = new Set(cells.map(c => c.cellNumber));
  const missing = cellNumbers.filter(n => !got.has(n));
  if (missing.length) {
    throw new Error(`Cells not found in DB: ${missing.join(', ')}`);
  }

  const validation = validateCells(cells);
  if (validation.length) {
    throw new Error('Validation failed:\n - ' + validation.join('\n - '));
  }
  return buildCellStoreMessage({ clientId, machineId, cells });
}
