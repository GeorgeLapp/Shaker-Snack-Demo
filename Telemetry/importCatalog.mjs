// file: importCatalog.js
import sqlite3 from 'sqlite3';
import { promisify } from 'node:util';

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
  const run  = promisify(db.run.bind(db));
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
      const brandId   = (p.goodBrand && typeof p.goodBrand.id === 'number') ? p.goodBrand.id : null;
      const brandName = (p.goodBrand && typeof p.goodBrand.name === 'string') ? p.goodBrand.name : null;

      if (brandId != null && brandName) {
        brandStmt.run(brandId, brandName);
      }

      const priceMinor =
        (typeof p.price === 'number' && Number.isFinite(p.price))
          ? Math.round(p.price * 100)
          : null;

      const taste   = safeStr(p.taste);
      const imgUrl  = safeStr(p.imgPath);
      const isAdult = truthyToInt(p.isAdult);
      const vendor  = emptyToNull(p.vendorCode);

      const calories      = numOrNull(p.calories);
      const proteins      = numOrNull(p.proteins);
      const fats          = numOrNull(p.fats);
      const carbohydrates = numOrNull(p.carbohydrates);

      const compound    = emptyToNull(p.compound);
      const allergens   = emptyToNull(p.allergens);
      const description = emptyToNull(p.description);

      productStmt.run(
        p.id, brandId, taste, imgUrl, isAdult, priceMinor, vendor,
        calories, proteins, fats, carbohydrates,
        compound, allergens, description
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
    await exec('ROLLBACK').catch(()=>{});
    throw e;
  } finally {
    brandStmt.finalize();
    productStmt.finalize();
  }
}

// ───────── helpers ─────────
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
