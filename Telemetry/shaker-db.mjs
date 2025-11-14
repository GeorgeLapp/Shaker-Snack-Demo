// shaker-db.mjs
// Унифицированная библиотека для работы с БД автомата Shaker Snack.
//
// Включает:
//  - importCatalog / importCatalogFromFile              (импорт каталога из телеметрии)
//  - applyMatrixFromTelemetry                           (применение матрицы из телеметрии)
//  - buildCellStoreMessageForAll / buildCellStoreMessageForCells
//  - buildMatrixImportPayload                           (payload matrixImportTopicSnack)
//  - getCellVolumes                                     (остатки по ячейкам)
//  - recordPayment / getPendingSalesPayload / markSent  (логика продаж/платежей)
//
// Все функции используют sqlite3 и работают в формате ESM.

import sqlite3 from 'sqlite3';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

sqlite3.verbose();

// ───────────────────────────────
// Общие вспомогательные функции
// ───────────────────────────────

/**
 * Открыть "сырое" подключение к SQLite.
 * Включает PRAGMA foreign_keys.
 * @param {string} dbPath
 * @param {number} [mode]
 * @returns {Promise<sqlite3.Database>}
 */
function openRawDb(dbPath, mode = sqlite3.OPEN_READWRITE) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, mode, (err) => {
      if (err) reject(err);
      else {
        db.run('PRAGMA foreign_keys = ON');
        resolve(db);
      }
    });
  });
}

/**
 * Открыть БД только для чтения.
 * @param {string} dbPath
 * @returns {Promise<sqlite3.Database>}
 */
function openReadonlyDb(dbPath) {
  return openRawDb(dbPath, sqlite3.OPEN_READONLY);
}

/**
 * Промис-обёртка над db.all.
 * @param {sqlite3.Database} db
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {Promise<any[]>}
 */
function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

/**
 * Закрыть подключение к SQLite.
 * @param {sqlite3.Database} db
 * @returns {Promise<void>}
 */
function closeRawDb(db) {
  return new Promise((resolve) => db.close(() => resolve()));
}

// ───────────────────────────────
// 1. Импорт каталога (importCatalog.mjs)
// ───────────────────────────────

/**
 * Ожидаемый формат message:
 * {
 *   "type": "baseProductRequestExportTopic",
 *   "body": [ { id, vendorCode, taste, imgPath, isAdult, price, goodBrand:{id,name}, ...КБЖУ... } ]
 * }
 *
 * Функция:
 * - валидирует тип сообщения и наличие массива body
 * - добавляет/обновляет бренды и товары (UPSERT)
 * - конвертирует price -> price_minor (в копейки), если поле есть
 * - обновляет catalog_sync_state.last_sync_ts
 *
 * @param {sqlite3.Database} db  Открытая БД sqlite3
 * @param {object} message       JSON с телеметрии
 */
export async function importCatalog(db, message) {
  if (!message || message.type !== 'baseProductRequestExportTopic') {
    throw new Error('Unexpected message type');
  }
  const items = message.body;
  if (!Array.isArray(items)) {
    throw new Error('Message.body must be an array of products');
  }

  // Промисификация методов sqlite3
  const run = promisify(db.run.bind(db));
  const exec = promisify(db.exec.bind(db));
  const prepare = db.prepare.bind(db);

  // Statements с UPSERT (SQLite ≥ 3.24)
  const brandStmt = prepare(`
    INSERT INTO catalog_brand (id, name)
    VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name
  `);

  const productStmt = prepare(`
    INSERT INTO catalog_product (
      id, brand_id, taste, img_url, is_adult, price_minor, vendor_code,
      calories, proteins, fats, carbohydrates,
      compound, allergens, description
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      brand_id      = excluded.brand_id,
      taste         = excluded.taste,
      img_url       = excluded.img_url,
      is_adult      = excluded.is_adult,
      price_minor   = excluded.price_minor,
      vendor_code   = excluded.vendor_code,
      calories      = excluded.calories,
      proteins      = excluded.proteins,
      fats          = excluded.fats,
      carbohydrates = excluded.carbohydrates,
      compound      = excluded.compound,
      allergens     = excluded.allergens,
      description   = excluded.description
  `);

  // Транзакция
  try {
    await exec('BEGIN IMMEDIATE');

    for (const p of items) {
      if (!p || typeof p.id !== 'number') continue; // минимум — нужен id

      // Нормализация входных полей
      const brandId =
        p.goodBrand && typeof p.goodBrand.id === 'number'
          ? p.goodBrand.id
          : null;
      const brandName =
        p.goodBrand && typeof p.goodBrand.name === 'string'
          ? p.goodBrand.name
          : null;

      if (brandId != null && brandName) {
        brandStmt.run(brandId, brandName);
      }

      const priceMinor =
        typeof p.price === 'number' && Number.isFinite(p.price)
          ? Math.round(p.price * 100)
          : null;

      const taste = safeStr(p.taste);
      const imgUrl = safeStr(p.imgPath);
      const isAdult = truthyToInt(p.isAdult);
      const vendor = emptyToNull(p.vendorCode);

      const calories = numOrNull(p.calories);
      const proteins = numOrNull(p.proteins);
      const fats = numOrNull(p.fats);
      const carbohydrates = numOrNull(p.carbohydrates);

      const compound = emptyToNull(p.compound);
      const allergens = emptyToNull(p.allergens);
      const description = emptyToNull(p.description);

      productStmt.run(
        p.id,
        brandId,
        taste,
        imgUrl,
        isAdult,
        priceMinor,
        vendor,
        calories,
        proteins,
        fats,
        carbohydrates,
        compound,
        allergens,
        description
      );
    }

    // Обновим служебный штамп синхронизации
    await run(`
      INSERT INTO catalog_sync_state (id, last_sync_ts, source_hash)
      VALUES (1, CAST(strftime('%s','now') AS INTEGER) * 1000, NULL)
      ON CONFLICT(id) DO UPDATE SET last_sync_ts = excluded.last_sync_ts
    `);

    await exec('COMMIT');
  } catch (e) {
    await exec('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    brandStmt.finalize();
    productStmt.finalize();
  }
}

/**
 * Удобный враппер: открыть БД по пути, импортировать каталог и закрыть.
 * @param {string} dbPath
 * @param {object} message
 */
export async function importCatalogFromFile(dbPath, message) {
  const db = await openRawDb(dbPath);
  try {
    await importCatalog(db, message);
  } finally {
    await closeRawDb(db);
  }
}

// helpers для importCatalog
function safeStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function emptyToNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function truthyToInt(v) {
  return v ? 1 : 0;
}

// ───────────────────────────────
// 2. Применение матрицы из телеметрии (applyMatrixFromTelemetry.js)
// ───────────────────────────────

/**
 * Применяет наполнение матрицы из телеметрии.
 * Ожидается массив объектов: [{cellNumber, price, goodId, size, volume, maxVolume}, ...]
 *   price: number | null  // Рубли с плавающей точкой, записываем в REAL
 * @param {string} dbPath
 * @param {Array<Object>} telemetryBody
 * @param {Object} [opts]
 * @param {number|null} [opts.syncTs=Date.now()]
 * @param {string|null} [opts.sourceHash=null]
 * @returns {Promise<{updated:number, inserted:number}>}
 */
export function applyMatrixFromTelemetry(dbPath, telemetryBody, opts = {}) {
  const syncTs = opts.syncTs ?? Date.now();
  const sourceHash = opts.sourceHash ?? null;

  if (!Array.isArray(telemetryBody)) {
    return Promise.reject(new Error('telemetryBody must be an array'));
  }

  // Нормализация и базовая валидация
  const rows = telemetryBody.map((x, idx) => {
    const errPrefix = `item[${idx}]`;
    if (!x || typeof x !== 'object')
      throw new Error(`${errPrefix}: must be object`);
    const cellNumber = toInt(x.cellNumber, `${errPrefix}.cellNumber`, 1);
    const size = x.size == null ? 0 : toInt(x.size, `${errPrefix}.size`);
    const price =
      x.price == null ? null : toReal(x.price, `${errPrefix}.price`); // Рубли, REAL
    const goodId =
      x.goodId == null ? null : toInt(x.goodId, `${errPrefix}.goodId`, 0);
    const maxVolume = toInt(x.maxVolume, `${errPrefix}.maxVolume`, 0);
    let volume = toInt(x.volume, `${errPrefix}.volume`, 0);

    if (cellNumber <= 0)
      throw new Error(`${errPrefix}: cellNumber must be > 0`);
    if (maxVolume < 0)
      throw new Error(`${errPrefix}: maxVolume must be >= 0`);
    if (volume < 0) volume = 0;
    if (volume > maxVolume) volume = maxVolume;

    return { cellNumber, size, price, goodId, volume, maxVolume };
  });

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
    });

    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON');

      db.run('BEGIN IMMEDIATE', (err) => {
        if (err) {
          db.close();
          return reject(err);
        }

        let inserted = 0;
        let updated = 0;

        // ВАЖНО: price_minor — столбец типа REAL!
        const upsertConfigSql = `
          INSERT INTO matrix_cell_config (cell_number, row_number, size, good_id, price_minor, enabled)
          VALUES ($cell, NULL, $size, $goodId, $price, 1)
          ON CONFLICT(cell_number) DO UPDATE SET
            size        = excluded.size,
            good_id     = excluded.good_id,
            price_minor = excluded.price_minor,
            enabled     = 1
        `;
        const upsertStateSql = `
          INSERT INTO matrix_cell_state (cell_number, volume, max_volume, last_refill_ts)
          VALUES ($cell, $volume, $maxVolume, NULL)
          ON CONFLICT(cell_number) DO UPDATE SET
            volume     = excluded.volume,
            max_volume = excluded.max_volume
        `;

        const stmtCfg = db.prepare(upsertConfigSql);
        const stmtSt = db.prepare(upsertStateSql);

        const checkCatalog = db.prepare(
          `SELECT 1 FROM catalog_product WHERE id = ? LIMIT 1`
        );

        let i = 0;
        const next = () => {
          if (i >= rows.length) {
            const syncSql = `
              UPDATE matrix_sync_state
                 SET last_sync_ts = $ts,
                     source_hash  = COALESCE($hash, source_hash),
                     matrix_version = COALESCE(matrix_version, 0) + 1
               WHERE id = 1
            `;
            db.run(syncSql, { $ts: syncTs, $hash: sourceHash }, (err2) => {
              if (err2) return rollback(err2);
              db.run('COMMIT', (err3) => {
                if (err3) return rollback(err3);
                cleanup();
                resolve({ updated, inserted });
              });
            });
            return;
          }

          const r = rows[i++];
          // Если goodId не найден в каталоге — ставим NULL, чтобы не ломать FK
          if (r.goodId != null) {
            checkCatalog.get(r.goodId, (err, exists) => {
              if (err) return rollback(err);
              upsertOne(r, exists ? r.goodId : null);
            });
          } else {
            upsertOne(r, null);
          }
        };

        const upsertOne = (r, goodId) => {
          stmtCfg.run(
            {
              $cell: r.cellNumber,
              $size: r.size,
              $goodId: goodId,
              $price: r.price, // REAL или NULL
            },
            function onCfgDone(err) {
              if (err) return rollback(err);
              if (this.changes === 1 && this.lastID) inserted++;
              else updated++;

              stmtSt.run(
                {
                  $cell: r.cellNumber,
                  $volume: r.volume,
                  $maxVolume: r.maxVolume,
                },
                function onStDone(err2) {
                  if (err2) return rollback(err2);
                  next();
                }
              );
            }
          );
        };

        const rollback = (e) => {
          db.run('ROLLBACK', () => {
            cleanup();
            reject(e);
          });
        };

        const cleanup = () => {
          try {
            stmtCfg.finalize();
          } catch {}
          try {
            stmtSt.finalize();
          } catch {}
          try {
            checkCatalog.finalize();
          } catch {}
          db.close();
        };

        next();
      });
    });
  });
}

// helpers для applyMatrixFromTelemetry
function toInt(v, name, min = Number.MIN_SAFE_INTEGER) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  const i = n | 0;
  if (i < min) throw new Error(`${name} must be >= ${min}`);
  return i;
}
function toReal(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n))
    throw new Error(`${name} must be a finite number`);
  return n; // рубли с плавающей точкой — пишем как есть в REAL
}

// ───────────────────────────────
// 3. Формирование payload cellStoreImportTopicSnack (telemetry-payload.mjs)
// ───────────────────────────────

/** Маппинг строки представления -> объект ячейки телеметрии */
function mapRowToCell(row) {
  // price = price_minor (REAL, рубли) — без изменений
  const price = row.price_minor != null ? Number(row.price_minor) : 0;

  // size — как в БД, без преобразований
  const size = Number(row.size ?? 0);

  return {
    cellNumber: Number(row.cell_number),
    price, // REAL, рубли
    goodId: String(row.good_id ?? ''),
    size, // без изменений
    volume: Number(row.volume ?? 0),
    maxVolume: Number(row.max_volume ?? 0),
  };
}

/** Базовая валидация перед отправкой (значения НЕ меняем) */
function validateCells(cells) {
  const errors = [];
  for (const c of cells) {
    if (!Number.isInteger(c.cellNumber))
      errors.push(`cellNumber must be integer: ${c.cellNumber}`);
    if (typeof c.price !== 'number' || Number.isNaN(c.price)) {
      errors.push(`price must be number (REAL) for cell ${c.cellNumber}`);
    }
    if (typeof c.goodId !== 'string' || c.goodId.length === 0) {
      errors.push(`goodId must be non-empty string for cell ${c.cellNumber}`);
    }
    if (!Number.isInteger(c.size))
      errors.push(`size must be integer for cell ${c.cellNumber}`);
    if (!Number.isInteger(c.volume) || c.volume < 0) {
      errors.push(`volume must be >=0 integer for cell ${c.cellNumber}`);
    }
    if (!Number.isInteger(c.maxVolume) || c.maxVolume < 0) {
      errors.push(
        `maxVolume must be >=0 integer for cell ${c.cellNumber}`
      );
    }
  }
  return errors;
}

/** Чтение всех enabled=1 ячеек */
async function readCellsAll(dbPath) {
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
  const db = await openReadonlyDb(dbPath);
  try {
    const rows = await allAsync(db, sql);
    return rows.map(mapRowToCell);
  } finally {
    await closeRawDb(db);
  }
}

/** Чтение списка ячеек по cell_number (без фильтра enabled) */
async function readCellsByNumbers(dbPath, cellNumbers) {
  if (!Array.isArray(cellNumbers) || cellNumbers.length === 0) return [];
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
  const db = await openReadonlyDb(dbPath);
  try {
    const rows = await allAsync(db, sql, cellNumbers);
    return rows.map(mapRowToCell);
  } finally {
    await closeRawDb(db);
  }
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

/**
 * Публично: все enabled ячейки → готовый JSON
 * @param {{dbPath:string, clientId:string, machineId:string}} params
 */
export async function buildCellStoreMessageForAll({
  dbPath,
  clientId,
  machineId,
}) {
  const cells = await readCellsAll(dbPath);
  const validation = validateCells(cells);
  if (validation.length) {
    throw new Error(
      'Validation failed:\n - ' + validation.join('\n - ')
    );
  }
  return buildCellStoreMessage({ clientId, machineId, cells });
}

/**
 * Публично: выбранные cell_number → готовый JSON
 * @param {{dbPath:string, clientId:string, machineId:string, cellNumbers:number[]}} params
 */
export async function buildCellStoreMessageForCells({
  dbPath,
  clientId,
  machineId,
  cellNumbers,
}) {
  if (!Array.isArray(cellNumbers) || cellNumbers.length === 0) {
    throw new Error('cellNumbers must be a non-empty array of integers');
  }
  const cells = await readCellsByNumbers(dbPath, cellNumbers);

  // проверим, что все запрошенные найдены
  const got = new Set(cells.map((c) => c.cellNumber));
  const missing = cellNumbers.filter((n) => !got.has(n));
  if (missing.length) {
    throw new Error(`Cells not found in DB: ${missing.join(', ')}`);
  }

  const validation = validateCells(cells);
  if (validation.length) {
    throw new Error(
      'Validation failed:\n - ' + validation.join('\n - ')
    );
  }
  return buildCellStoreMessage({ clientId, machineId, cells });
}

// ───────────────────────────────
// 4. Сборка payload matrixImportTopicSnack (sendMatrixFromSqlite.mjs)
// ───────────────────────────────

/** загрузить «снимок» матрицы из БД и привести к формату телеметрии */
async function loadMatrixFromSqlite(dbPath) {
  const db = await openReadonlyDb(dbPath);
  try {
    const viewExists = await allAsync(
      db,
      "SELECT name FROM sqlite_master WHERE type='view' AND name='vw_matrix_cell_full'"
    );
    let rows;
    if (viewExists.length) {
      rows = await allAsync(
        db,
        `
        SELECT cell_number, row_number, size, good_id,
               COALESCE(price_minor, NULL) AS price_minor,
               volume, max_volume, enabled
          FROM vw_matrix_cell_full
         ORDER BY cell_number ASC`
      );
    } else {
      rows = await allAsync(
        db,
        `
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
        ORDER BY c.cell_number ASC`
      );
    }

    const matrix = rows.map((r) => ({
      cellNumber: Number(r.cell_number),
      rowNumber: r.row_number != null ? Number(r.row_number) : null,
      price:
        r.price_minor != null ? Number(r.price_minor) : null, // price ← price_minor
      goodId: r.good_id != null ? String(r.good_id) : null,
      size: r.size != null ? Number(r.size) + 1 : 1, // 0/1/2 → 1/2/3
      volume: r.volume != null ? Number(r.volume) : 0,
      maxVolume: r.max_volume != null ? Number(r.max_volume) : 0,
      isActive: Boolean(r.enabled),
    }));

    // базовая целостность
    const seen = new Set();
    for (const [i, c] of matrix.entries()) {
      if (seen.has(c.cellNumber))
        throw new Error(
          `Duplicate cellNumber=${c.cellNumber} at index ${i}`
        );
      seen.add(c.cellNumber);
      if (!(c.volume >= 0 && c.maxVolume >= 0 && c.volume <= c.maxVolume)) {
        throw new Error(
          `Volume bounds failed for cellNumber=${c.cellNumber}: volume=${c.volume} max=${c.maxVolume}`
        );
      }
    }
    return matrix;
  } finally {
    await closeRawDb(db);
  }
}

/**
 * Построить готовый payload для matrixImportTopicSnack (с requestUuid).
 * @param {{dbPath?:string, clientId:string, machineId:string, requestUuid?:string}} params
 */
export async function buildMatrixImportPayload({
  dbPath = 'goods.db',
  clientId,
  machineId,
  requestUuid,
}) {
  if (!clientId) throw new Error('clientId is required');
  if (!machineId) throw new Error('machineId is required');

  const matrix = await loadMatrixFromSqlite(dbPath);
  const reqId = requestUuid || randomUUID();

  return {
    payload: {
      clientId,
      type: 'matrixImportTopicSnack',
      body: { requestUuid: reqId, machineId, matrix },
    },
    requestUuid: reqId,
    matrixCount: matrix.length,
  };
}

// ───────────────────────────────
// 5. Чтение остатков по ячейкам (sendCellVolumesFromSqlite.mjs)
// ───────────────────────────────

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
  const db = await openRawDb(dbPath);

  try {
    let rows;
    if (Array.isArray(cellNumbers) && cellNumbers.length) {
      const placeholders = cellNumbers.map(() => '?').join(',');
      rows = await allAsync(
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
      rows = await allAsync(
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
    await closeRawDb(db);
  }
}

// ───────────────────────────────
// 6. Продажи и платежи (telemetry-payments.mjs)
// ───────────────────────────────

/**
 * Вспомогательный враппер над sqlite3.Database с run/get/all/tx/close.
 * @param {string} file
 */
function openPaymentDb(file) {
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
        db.all(sql, params, (err, rows) =>
          err ? reject(err) : resolve(rows)
        )
      );
    },
    tx(fn) {
      return new Promise((resolve, reject) => {
        db.serialize(async () => {
          try {
            await this.run('BEGIN');
            const res = await fn(this);
            await this.run('COMMIT');
            resolve(res);
          } catch (e) {
            try {
              await this.run('ROLLBACK');
            } catch {}
            reject(e);
          }
        });
      });
    },
    close() {
      return new Promise((resolve, reject) =>
        db.close((err) => (err ? reject(err) : resolve()))
      );
    },
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

/**
 * Создание записи продажи+платежа.
 * @param {string} dbPath
 * @param {object} [payload]
 * @returns {Promise<{saleUuid:string, ts:number}>}
 */
export async function recordPayment(dbPath, payload = {}) {
  const {
    saleUuid = randomUUID(),
    ts = Date.now(),
    cellNumber,
    qty = 1,
    goodId = null,
    price,
    method,
  } = payload;

  if (cellNumber == null || price == null || !method) {
    throw new Error('recordPayment: cellNumber, price, method are required');
  }

  const db = openPaymentDb(dbPath);
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
export async function getPendingSalesPayload(
  dbPath,
  {
    serialNumber,
    machineId,
    orgId,
    machineModelId = null,
    timezoneOffsetHours = 0,
  }
) {
  if (!serialNumber || !machineId || !orgId) {
    throw new Error(
      'getPendingSalesPayload: serialNumber, machineId, orgId are required'
    );
  }

  const db = openPaymentDb(dbPath);
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

    const body = rows.map((r) => {
      const oneWriteOff = {
        cellNumber: r.cellNumber,
        productId: r.goodId ?? r.cellNumber,
      };
      const onePayment = {
        price: r.amount,
        method: r.method,
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
        writeOffs: [oneWriteOff], // <--- массив
        payments: [onePayment], // <--- массив
        brandId: undefined,
        goodId: r.goodId ?? undefined,
      };

      // ВАЖНО: ключ "sale-uuid" с дефисом
      item['sale-uuid'] = r.saleUuid;

      return item;
    });

    return {
      message: {
        clientId: serialNumber,
        type: 'saleImportTopicSnack',
        body,
      },
      uuids: rows.map((r) => r.saleUuid),
    };
  } finally {
    await db.close();
  }
}

/** Пометить указанные saleUuid как отправленные (note = 'sent <ISO>', status='sent'). */
export async function markSent(
  dbPath,
  uuids,
  sentAtIso = new Date().toISOString()
) {
  if (!uuids?.length) return { updated: 0 };

  const db = openPaymentDb(dbPath);
  try {
    const placeholders = uuids.map(() => '?').join(',');

    await db.tx(async (tx) => {
      await tx.run(
        `UPDATE payment_tx
            SET status='sent', note=?
          WHERE sale_uuid IN (${placeholders})`,
        [`sent ${sentAtIso}`, ...uuids]
      );

      await tx.run(
        `UPDATE matrix_sale_log
            SET note=?
          WHERE payment_ref IN (${placeholders})`,
        [`sent ${sentAtIso}`, ...uuids]
      );
    });

    return { updated: uuids.length, note: `sent ${sentAtIso}` };
  } finally {
    await db.close();
  }
}
