// ESM module
// npm i sqlite3 ws
import { open } from 'node:fs/promises';
import sqlite3 from 'sqlite3';
import { WebSocket } from 'ws';
import crypto from 'node:crypto';

// Утилита промисов для sqlite3
function openDb(file) {
  sqlite3.verbose();
  const db = new sqlite3.Database(file);
  db.exec('PRAGMA foreign_keys = ON;');
  return {
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes, lastID: this.lastID });
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
      );
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
      );
    },
    tx(fn) {
      return new Promise(async (resolve, reject) => {
        db.serialize(async () => {
          try {
            await this.run('BEGIN');
            const res = await fn(this);
            await this.run('COMMIT');
            resolve(res);
          } catch (e) {
            try { await this.run('ROLLBACK'); } catch {}
            reject(e);
          }
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));
    }
  };
}

/**
 * Инициализация минимально нужных структур:
 * - Отдельная таблица платежей (журнал платежных транзакций)
 *   (matrix_sale_log уже есть: id, ts, cell_number, qty, good_id, price_minor, payment_ref, note). :contentReference[oaicite:3]{index=3}
 */
async function ensureSchema(db) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS payment_tx (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      created_ts    INTEGER NOT NULL,         -- unix ms создания записи
      sale_uuid     TEXT NOT NULL UNIQUE,     -- для идемпотентности/связи
      amount        REAL NOT NULL,            -- сумма платежа в рублях (телеметрия: price)  :contentReference[oaicite:4]{index=4}
      method        TEXT NOT NULL,            -- cash|card|qr и пр.
      status        TEXT NOT NULL DEFAULT 'pending', -- pending|sent|error
      note          TEXT                      -- будет заполнено меткой отправки в телеметрию; пусто до отправки
    );
  `);
}

/**
 * 1) Запись платежной транзакции в БД.
 * Создаёт запись в payment_tx + вносит факт продажи в matrix_sale_log (note пустое).
 *
 * @param {string} dbPath
 * @param {{
 *   saleUuid?: string,            // если не задан — сгенерируем
 *   ts?: number,                  // unix ms, по умолчанию now
 *   cellNumber: number,
 *   qty?: number,                 // по умолчанию 1
 *   goodId?: number|null,         // можно не указывать, денормализация опциональна
 *   price: number,                // рубли (телеметрия: price)  :contentReference[oaicite:5]{index=5}
 *   method: string                // cash|card|...
 * }} payload
 */
export async function recordPayment(dbPath, payload) {
  const {
    saleUuid = crypto.randomUUID(),
    ts = Date.now(),
    cellNumber,
    qty = 1,
    goodId = null,
    price,
    method
  } = payload;

  if (!cellNumber || !price || !method) {
    throw new Error('cellNumber, price, method are required');
  }

  const db = openDb(dbPath);
  try {
    await ensureSchema(db);

    // Узнаем «эффективную» цену ячейки, если хотим сохранить её в sale_log как денорму (price_minor).
    // В схемаx есть vw_matrix_cell_price и vw_matrix_cell_full; price_minor — REAL. :contentReference[oaicite:6]{index=6}
    const priceRow = await db.get(
      `SELECT COALESCE(c.price_minor, p.price_minor) AS price_minor
         FROM matrix_cell_config c
    LEFT JOIN catalog_product p ON p.id = c.good_id
        WHERE c.cell_number = ?`,
      [cellNumber]
    );
    const priceMinor = priceRow?.price_minor ?? null;

    // Транзакция: журнал продаж + журнал платежей
    await db.tx(async (tx) => {
      // matrix_sale_log: note пусто, payment_ref = saleUuid
      await tx.run(
        `INSERT INTO matrix_sale_log
           (ts, cell_number, qty, good_id, price_minor, payment_ref, note)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        [ts, cellNumber, qty, goodId, priceMinor, saleUuid]
      );

      // payment_tx
      await tx.run(
        `INSERT INTO payment_tx (created_ts, sale_uuid, amount, method, status, note)
         VALUES (?, ?, ?, ?, 'pending', NULL)`,
        [ts, saleUuid, price, method]
      );
    });

    return { saleUuid, ts };
  } finally {
    await db.close();
  }
}

/**
 * 2) Синхронизация с телеметрией.
 * - Берёт все неотправленные продажи (payment_tx.status='pending', note IS NULL).
 * - Формирует пакет сообщений saleImportTopicSnack (body — массив).
 * - Отправляет по WS с Bearer токеном.
 * - По успеху: ставит note=ISO датавремя отправки одновременно в payment_tx и matrix_sale_log (по sale_uuid),
 *   status -> 'sent'. Если ошибка — status='error', note хранит текст ошибки (по желанию можно оставить пустым).
 *
 * @param {string} dbPath
 * @param {{
 *   oauthToken: string,           // уже полученный Bearer токен (из вашего модуля авторизации)
 *   wsUrl: string,                // например: 'ws://185.46.8.39:8315/ws'
 *   serialNumber: string,         // clientId / serialNumber автомата
 *   machineId: number,
 *   orgId: number,
 *   machineModelId?: number,
 *   timezoneOffsetHours?: number  // например, 3
 * }} auth
 */
export async function syncWithTelemetry(dbPath, auth) {
  const {
    oauthToken,
    wsUrl,
    serialNumber,
    machineId,
    orgId,
    machineModelId = null,
    timezoneOffsetHours = 0
  } = auth;

  if (!oauthToken || !wsUrl || !serialNumber || !machineId || !orgId) {
    throw new Error('oauthToken, wsUrl, serialNumber, machineId, orgId are required');
  }

  const db = openDb(dbPath);
  try {
    await ensureSchema(db);

    // Собираем «pending» платежи вместе с данными продажи (ячейка, qty, good, price_minor и т.п.)
    const rows = await db.all(
      `SELECT
         pt.id            AS pay_id,
         pt.sale_uuid     AS saleUuid,
         pt.created_ts    AS ts,
         pt.amount        AS amount,          -- рубли
         pt.method        AS method,
         sl.cell_number   AS cellNumber,
         sl.qty           AS qty,
         sl.good_id       AS goodId,
         sl.price_minor   AS priceMinor,
         sl.id            AS sale_log_id
       FROM payment_tx pt
       JOIN matrix_sale_log sl ON sl.payment_ref = pt.sale_uuid
      WHERE pt.status = 'pending' AND (pt.note IS NULL OR LENGTH(pt.note)=0)`
    );

    if (rows.length === 0) return { sent: 0 };

    // Готовим WS
    const ws = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${oauthToken}` }
    });
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });

    // Сформируем тело saleImportTopicSnack (массив)
    const body = rows.map(r => {
      // dateSale — ISO (UTC)
      const dateSaleISO = new Date(r.ts).toISOString();

      return {
        machineId,
        machineModelId,
        orgId,
        serialNumber,
        totalPrice: r.amount,          // телеметрия ожидает price/totalPrice в РУБЛЯХ (float)  :contentReference[oaicite:7]{index=7}
        price: r.priceMinor ?? r.amount, // если хотите фиксировать ценник позиции — иначе можно не отправлять
        dateSale: dateSaleISO,
        name: undefined,               // опционально, можно подставить из каталога
        volume: r.qty,
        machineTimezone: timezoneOffsetHours,
        writeOffs: {
          cellNumber: r.cellNumber,
          productId: r.goodId ?? r.cellNumber // если у вас иное соответствие — подставьте корректно
        },
        payments: {
          price: r.amount,
          method: r.method
        },
        saleUuid: r.saleUuid,
        goodId: r.goodId ?? undefined
      };
    });

    // Отправка и ожидание ack
    const msg = JSON.stringify({ clientId: serialNumber, type: 'saleImportTopicSnack', body });
    const ack = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No ACK for saleImportTopicSnack')), 10000);
      const onMessage = (data) => {
        try {
          const json = JSON.parse(data.toString());
          if (json?.type === 'saleImportTopicSnack') {
            clearTimeout(timer);
            ws.off('message', onMessage);
            if (json.success === false) reject(new Error(json.message || 'saleImportTopicSnack failed'));
            else resolve(json);
          }
        } catch { /* ignore garbage */ }
      };
      ws.on('message', onMessage);
      ws.send(msg, (err) => err && (clearTimeout(timer), ws.off('message', onMessage), reject(err)));
    });

    // По успеху — ставим метку отправки
    const sentAtIso = new Date().toISOString();
    await db.tx(async (tx) => {
      const uuids = rows.map(r => r.saleUuid);
      const placeholders = uuids.map(() => '?').join(',');

      // payment_tx: status -> sent, note = 'sent <ISO>'
      await tx.run(
        `UPDATE payment_tx
            SET status='sent', note=?
          WHERE sale_uuid IN (${placeholders})`,
        [ `sent ${sentAtIso}`, ...uuids ]
      );

      // matrix_sale_log: note = 'sent <ISO>' (поле существует в схеме) :contentReference[oaicite:8]{index=8}
      await tx.run(
        `UPDATE matrix_sale_log
            SET note=?
          WHERE payment_ref IN (${placeholders})`,
        [ `sent ${sentAtIso}`, ...uuids ]
      );
    });

    try { ws.close(1000, 'done'); } catch {}

    return { sent: rows.length, ack };
  } finally {
    await db.close();
  }
}
