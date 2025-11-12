// file: telemetry-payments.mjs
// npm i sqlite3
import sqlite3 from 'sqlite3';
import crypto from 'node:crypto';

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

async function ensureSchema(db) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS payment_tx (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      created_ts    INTEGER NOT NULL,
      sale_uuid     TEXT NOT NULL UNIQUE,
      amount        REAL NOT NULL,
      method        TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending', -- pending|sent|error
      note          TEXT
    );
  `);
}

/** Создание записи продажи+платежа. */
export async function recordPayment(dbPath, payload = {}) {
  const {
    saleUuid = crypto.randomUUID(),
    ts = Date.now(),
    cellNumber,
    qty = 1,
    goodId = null,
    price,
    method
  } = payload;

  if (cellNumber == null || price == null || !method) {
    throw new Error('recordPayment: cellNumber, price, method are required');
  }

  const db = openDb(dbPath);
  try {
    await ensureSchema(db);

    // денорма цены позиции (если есть в БД)
    const priceRow = await db.get(
      `SELECT COALESCE(c.price_minor, p.price_minor) AS price_minor
         FROM matrix_cell_config c
    LEFT JOIN catalog_product p ON p.id = c.good_id
        WHERE c.cell_number = ?`,
      [cellNumber]
    );
    const priceMinor = priceRow?.price_minor ?? null;

    await db.tx(async (tx) => {
      await tx.run(
        `INSERT INTO matrix_sale_log
           (ts, cell_number, qty, good_id, price_minor, payment_ref, note)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        [ts, cellNumber, qty, goodId, priceMinor, saleUuid]
      );

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
 * Сборка всех неотправленных транзакций в payload для WS в формате:
 * {
 *   clientId: <serialNumber>,
 *   type: "saleImportTopicSnack",
 *   body: [ { ... "writeOffs":[{...}], "payments":[{...}], "sale-uuid": "<uuid>" } ]
 * }
 */
export async function getPendingSalesPayload(dbPath, {
  serialNumber,
  machineId,
  orgId,
  machineModelId = null,
  timezoneOffsetHours = 0
}) {
  if (!serialNumber || !machineId || !orgId) {
    throw new Error('getPendingSalesPayload: serialNumber, machineId, orgId are required');
  }

  const db = openDb(dbPath);
  try {
    await ensureSchema(db);

    const rows = await db.all(
      `SELECT
         pt.sale_uuid     AS saleUuid,
         pt.created_ts    AS ts,
         pt.amount        AS amount,
         pt.method        AS method,
         sl.cell_number   AS cellNumber,
         sl.qty           AS qty,
         sl.good_id       AS goodId,
         sl.price_minor   AS priceMinor
       FROM payment_tx pt
       JOIN matrix_sale_log sl ON sl.payment_ref = pt.sale_uuid
      WHERE pt.status = 'pending' AND (pt.note IS NULL OR LENGTH(pt.note)=0)`
    );

    if (rows.length === 0) {
      return { message: null, uuids: [] };
    }

    const body = rows.map(r => {
      const oneWriteOff = {
        cellNumber: r.cellNumber,
        productId: r.goodId ?? r.cellNumber
      };
      const onePayment = {
        price: r.amount,
        method: r.method
      };

      // Собираем объект продажи с требуемой структурой
      const item = {
        machineId,
        machineModelId,
        orgId,
        serialNumber,
        totalPrice: r.amount,
        price: r.priceMinor ?? r.amount,
        dateSale: new Date(r.ts).toISOString(),
        name: undefined, // при желании подставь название
        volume: r.qty,
        machineTimezone: timezoneOffsetHours,
        writeOffs: [ oneWriteOff ],       // <--- массив
        payments: [ onePayment ],         // <--- массив
        brandId: undefined,
        goodId: r.goodId ?? undefined
      };

      // ВАЖНО: ключ "sale-uuid" с дефисом
      item['sale-uuid'] = r.saleUuid;

      return item;
    });

    return {
      message: { clientId: serialNumber, type: 'saleImportTopicSnack', body },
      uuids: rows.map(r => r.saleUuid)
    };
  } finally {
    await db.close();
  }
}

/** Пометить указанные saleUuid как отправленные (note = 'sent <ISO>', status='sent'). */
export async function markSent(dbPath, uuids, sentAtIso = new Date().toISOString()) {
  if (!uuids?.length) return { updated: 0 };

  const db = openDb(dbPath);
  try {
    const placeholders = uuids.map(() => '?').join(',');

    await db.tx(async (tx) => {
      await tx.run(
        `UPDATE payment_tx
            SET status='sent', note=?
          WHERE sale_uuid IN (${placeholders})`,
        [ `sent ${sentAtIso}`, ...uuids ]
      );

      await tx.run(
        `UPDATE matrix_sale_log
            SET note=?
          WHERE payment_ref IN (${placeholders})`,
        [ `sent ${sentAtIso}`, ...uuids ]
      );
    });

    return { updated: uuids.length, note: `sent ${sentAtIso}` };
  } finally {
    await db.close();
  }
}
