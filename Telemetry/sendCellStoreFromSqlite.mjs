// sendCellStoreFromSqlite.js
// Функция читает наполнение из SQLite и отправляет на телеметрию по WS.
// Зависимости: sqlite3, ws, uuid (без TypeScript)
//
// ВАЖНО ПО ЦЕНАМ:
//  - В БД цена хранится в поле price_minor ТИПА REAL (РУБЛИ, с плавающей точкой).
//  - В телеметрии цена — поле price (РУБЛИ, с плавающей точкой).
//  - ЦЕНЫ НЕ МОДИФИЦИРУЕМ! Просто переименовываем: price_minor -> price (как есть).

import sqlite3 from 'sqlite3';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

/**
 * Преобразование строки БД -> объект ячейки для телеметрии.
 * DB (vw_matrix_cell_full): cell_number, size(0/1/2), price_minor(REAL, рубли), volume, max_volume, good_id, enabled
 * Telemetry: { cellNumber, price(REAL, рубли), goodId(string), size(1|2|3), volume, maxVolume }
 */
function mapRowToCell(row) {
  // НИКАКИХ преобразований: price = price_minor (оба — рубли, REAL).
  const price = row.price_minor != null ? Number(row.price_minor) : 0;

  // size в БД: 0/1/2 -> в телеметрию 1/2/3
  const size = row.size ;

  return {
    cellNumber: Number(row.cell_number),
    price, // уже в рублях, с плавающей точкой
    goodId: String(row.good_id ?? ''), // goodId обязателен строкой
    size,
    volume: Number(row.volume ?? 0),
    maxVolume: Number(row.max_volume ?? 0)
  };
}

/**
 * Читает наполнение из SQLite (только enabled=1) и возвращает массив cells для отправки.
 */
function readCellsFromDb(dbPath) {
  const sql = `
    SELECT
      cell_number,
      size,
      good_id,
      price_minor,   -- REAL, в рублях
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
 * Простая локальная валидация перед отправкой.
 * ВАЛИДАЦИЯ ЦЕНЫ: проверяем, что это число (REAL), но НЕ меняем значение.
 */
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
    if (![1, 2, 3].includes(c.size)) errors.push(`size must be 1|2|3 for cell ${c.cellNumber}`);
    if (!Number.isInteger(c.volume) || c.volume < 0) errors.push(`volume must be >=0 integer for cell ${c.cellNumber}`);
    if (!Number.isInteger(c.maxVolume) || c.maxVolume < 0) errors.push(`maxVolume must be >=0 integer for cell ${c.cellNumber}`);
  }
  return errors;
}

/**
 * Отправка по WebSocket сообщения cellStoreImportTopicSnack.
 * Вариант с уже готовым accessToken (получите по своей схеме авторизации).
 */
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

        // Ожидаем ответ вида snackTopicRes с тем же requestUuid
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
 * Главная функция: читает БД и отправляет на телеметрию.
 * Параметры:
 *  - dbPath: путь к SQLite (например '/data/local/goods.db')
 *  - wsUrl: URL вебсокета телеметрии (например 'ws://185.46.8.39:8315/ws')
 *  - accessToken: Bearer-token для апгрейда WS (получите по вашей авторизации)
 *  - clientId: идентификатор автомата (серийный номер)
 *  - machineId: идентификатор автомата на стороне сервера
 * Возвращает: объект ответа сервера (body из snackTopicRes)
 */
export async function sendCellStoreFromSqlite({
  dbPath,
  wsUrl,
  accessToken,
  clientId,
  machineId,
  onMessage
}) {
  // 1) читаем БД
  const cells = await readCellsFromDb(dbPath);

  // 2) базовая валидация
  const validationErrors = validateCells(cells);
  if (validationErrors.length) {
    throw new Error(`Validation failed:\n - ${validationErrors.join('\n - ')}`);
  }

  // 3) отправляем
  const res = await sendOverWs({ wsUrl, accessToken, clientId, machineId, cells, onMessage });

  // 4) возвращаем тело ответа сервера
  return res;
}

/* ===== Пример использования (при необходимости) =====
import { sendCellStoreFromSqlite } from './sendCellStoreFromSqlite.js';

const params = {
  dbPath: '/data/local/goods.db',
  wsUrl: 'ws://185.46.8.39:8315/ws',
  accessToken: process.env.SHAKER_ACCESS_TOKEN, // получите заранее по вашей авторизации
  clientId: process.env.SHAKER_CLIENT_ID || 'snack_02',
  machineId: 'MACHINE_ID_001',
  onMessage: (msg) => console.log('[WS] ←', JSON.stringify(msg))
};

sendCellStoreFromSqlite(params)
  .then((body) => {
    console.log('Snack response:', body);
  })
  .catch((e) => {
    console.error('Send failed:', e);
  });
*/
