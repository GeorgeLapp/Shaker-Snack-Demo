// sendCellStoreFromSqlite.js
// Функции чтения наполнения из SQLite и отправки в телеметрию по WS.
// Зависимости: sqlite3, ws, uuid (без TypeScript)
//
// ВАЖНО:
//  - В БД цена хранится в поле price_minor ТИПА REAL (РУБЛИ, с плавающей точкой).
//  - В телеметрии цена — поле price (РУБЛИ, с плавающей точкой).
//  - ЦЕНЫ НЕ МОДИФИЦИРУЕМ! price = price_minor (как есть).
//  - size НЕ ИЗМЕНЯЕМ — отправляем ровно то, что в БД.
//
// Экспортирует:
//  - sendCellStoreFromSqlite({ dbPath, wsUrl, accessToken, clientId, machineId, onMessage })
//      → читает ВСЕ enabled=1 ячейки из vw_matrix_cell_full и отправляет их.
//  - sendCellStoreForCells({ dbPath, wsUrl, accessToken, clientId, machineId, cellNumbers, onMessage })
//      → читает из БД ТОЛЬКО указанные cell_number (без фильтра enabled) и отправляет их.

import sqlite3 from 'sqlite3';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

/** Преобразование строки БД -> объект ячейки для телеметрии. */
function mapRowToCell(row) {
  // НИКАКИХ преобразований цены: REAL рубли как есть
  const price = row.price_minor != null ? Number(row.price_minor) : 0;

  // НИКАКИХ преобразований size: берём из БД как есть
  const size = Number(row.size ?? 0);

  return {
    cellNumber: Number(row.cell_number),
    price,                               // рубли, REAL как есть
    goodId: String(row.good_id ?? ''),   // goodId обязателен строкой
    size,                                // НЕ ИЗМЕНЯЕМ
    volume: Number(row.volume ?? 0),
    maxVolume: Number(row.max_volume ?? 0)
  };
}

/** Читает ВСЕ enabled=1 из vw_matrix_cell_full. */
function readCellsFromDb(dbPath) {
  const sql = `
    SELECT
      cell_number,
      size,
      good_id,
      price_minor,   -- REAL, рубли
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

/**
 * Читает ТОЛЬКО указанные ячейки по cell_number.
 * ВАЖНО: здесь НЕТ фильтра enabled — отправляем именно те, что попросили.
 */
function readCellsByNumbers(dbPath, cellNumbers) {
  if (!Array.isArray(cellNumbers) || cellNumbers.length === 0) {
    return Promise.resolve([]);
  }
  // готовим плейсхолдеры для IN (?, ?, ?)
  const placeholders = cellNumbers.map(() => '?').join(', ');
  const sql = `
    SELECT
      cell_number,
      size,
      good_id,
      price_minor,   -- REAL, рубли
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

/** Базовая валидация перед отправкой (без изменения значений). */
function validateCells(cells) {
  const errors = [];
  for (const c of cells) {
    if (!Number.isInteger(c.cellNumber)) errors.push(`cellNumber must be integer: ${c.cellNumber}`);
    if (typeof c.price !== 'number' || Number.isNaN(c.price)) {
      errors.push(`price must be a number (REAL) for cell ${c.cellNumber}`);
    }
    if (typeof c.goodId !== 'string' || c.goodId.length === 0) {
      errors.push(`goodId must be non-empty string for cell ${c.cellNumber}`);
    }
    // size — только проверяем, что целое; НЕ меняем и не ограничиваем диапазон
    if (!Number.isInteger(c.size)) errors.push(`size must be integer for cell ${c.cellNumber}`);
    if (!Number.isInteger(c.volume) || c.volume < 0) errors.push(`volume must be >=0 integer for cell ${c.cellNumber}`);
    if (!Number.isInteger(c.maxVolume) || c.maxVolume < 0) errors.push(`maxVolume must be >=0 integer for cell ${c.cellNumber}`);
  }
  return errors;
}

/** Отправка по WebSocket сообщения cellStoreImportTopicSnack. */
async function sendOverWs({ wsUrl, accessToken, clientId, machineId, cells, onMessage }) {
  const req = {
    clientId,
    type: 'cellStoreImportTopicSnack',
    body: {
      requestUuid: uuidv4(),
      machineId,
      cells
    }
  };

  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers });

    ws.on('open', () => {
      ws.send(JSON.stringify(req));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (typeof onMessage === 'function') onMessage(msg);

        // Ждём финальный ответ snackTopicRes с тем же requestUuid
        if (msg?.type === 'snackTopicRes' && msg?.body?.requestUuid === req.body.requestUuid) {
          ws.close(1000, 'done');
          resolve(msg.body);
        }
      } catch {
        // игнорируем нерелевантные сообщения
      }
    });

    ws.on('error', (err) => reject(err));
    ws.on('close', (code, reason) => {
      if (code !== 1000) reject(new Error(`WS closed: ${code} ${reason}`));
    });
  });
}

/**
 * Главная функция: читает БД (enabled=1) и отправляет все ячейки.
 */
export async function sendCellStoreFromSqlite({
  dbPath,
  wsUrl,
  accessToken,
  clientId,
  machineId,
  onMessage
}) {
  const cells = await readCellsFromDb(dbPath);

  const validationErrors = validateCells(cells);
  if (validationErrors.length) {
    throw new Error(`Validation failed:\n - ${validationErrors.join('\n - ')}`);
  }

  const res = await sendOverWs({ wsUrl, accessToken, clientId, machineId, cells, onMessage });
  return res;
}

/**
 * Отправляет ОДНУ/НЕСКОЛЬКО ячеек по их cell_number.
 * Пример:
 *   await sendCellStoreForCells({ dbPath:'goods.db', wsUrl, accessToken, clientId, machineId, cellNumbers:[12,45] })
 */
export async function sendCellStoreForCells({
  dbPath,
  wsUrl,
  accessToken,
  clientId,
  machineId,
  cellNumbers,
  onMessage
}) {
  if (!Array.isArray(cellNumbers) || cellNumbers.length === 0) {
    throw new Error('cellNumbers must be a non-empty array of integers');
  }

  // читаем ровно те ячейки, что попросили (без фильтра enabled)
  const cells = await readCellsByNumbers(dbPath, cellNumbers);

  // если какие-то номера не найдены — сообщим
  const foundNumbers = new Set(cells.map(c => c.cellNumber));
  const missing = cellNumbers.filter(n => !foundNumbers.has(n));
  if (missing.length) {
    throw new Error(`Cells not found in DB: ${missing.join(', ')}`);
  }

  const validationErrors = validateCells(cells);
  if (validationErrors.length) {
    throw new Error(`Validation failed:\n - ${validationErrors.join('\n - ')}`);
  }

  const res = await sendOverWs({ wsUrl, accessToken, clientId, machineId, cells, onMessage });
  return res;
}

/* ===== Примеры использования =====
import { sendCellStoreFromSqlite, sendCellStoreForCells } from './sendCellStoreFromSqlite.js';

// 1) Все enabled ячейки:
await sendCellStoreFromSqlite({
  dbPath: '/data/local/goods.db',
  wsUrl: 'ws://185.46.8.39:8315/ws',
  accessToken: process.env.SHAKER_ACCESS_TOKEN,
  clientId: process.env.SHAKER_CLIENT_ID || 'snack_02',
  machineId: 'MACHINE_ID_001',
  onMessage: (m) => console.log('[WS] ←', JSON.stringify(m))
});

// 2) Только выбранные ячейки (например, 12 и 45):
await sendCellStoreForCells({
  dbPath: '/data/local/goods.db',
  wsUrl: 'ws://185.46.8.39:8315/ws',
  accessToken: process.env.SHAKER_ACCESS_TOKEN,
  clientId: process.env.SHAKER_CLIENT_ID || 'snack_02',
  machineId: 'MACHINE_ID_001',
  cellNumbers: [12, 45],
  onMessage: (m) => console.log('[WS] ←', JSON.stringify(m))
});
*/
