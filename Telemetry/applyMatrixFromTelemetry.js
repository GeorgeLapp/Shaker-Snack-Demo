// file: applyMatrixFromTelemetry.js
// npm i sqlite3
const sqlite3 = require('sqlite3').verbose();

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
function applyMatrixFromTelemetry(dbPath, telemetryBody, opts = {}) {
  const syncTs = opts.syncTs ?? Date.now();
  const sourceHash = opts.sourceHash ?? null;

  if (!Array.isArray(telemetryBody)) {
    return Promise.reject(new Error('telemetryBody must be an array'));
  }

  // Нормализация и базовая валидация
  const rows = telemetryBody.map((x, idx) => {
    const errPrefix = `item[${idx}]`;
    if (!x || typeof x !== 'object') throw new Error(`${errPrefix}: must be object`);
    const cellNumber = toInt(x.cellNumber, `${errPrefix}.cellNumber`, 1);
    const size       = x.size == null ? 0 : toInt(x.size, `${errPrefix}.size`);
    const price      = x.price == null ? null : toReal(x.price, `${errPrefix}.price`); // Рубли, REAL
    const goodId     = x.goodId == null ? null : toInt(x.goodId, `${errPrefix}.goodId`, 0);
    const maxVolume  = toInt(x.maxVolume, `${errPrefix}.maxVolume`, 0);
    let   volume     = toInt(x.volume, `${errPrefix}.volume`, 0);

    if (cellNumber <= 0) throw new Error(`${errPrefix}: cellNumber must be > 0`);
    if (maxVolume < 0)  throw new Error(`${errPrefix}: maxVolume must be >= 0`);
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
        if (err) { db.close(); return reject(err); }

        let inserted = 0;
        let updated  = 0;

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
        const stmtSt  = db.prepare(upsertStateSql);

        const checkCatalog = db.prepare(`SELECT 1 FROM catalog_product WHERE id = ? LIMIT 1`);

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
              $cell:  r.cellNumber,
              $size:  r.size,
              $goodId: goodId,
              $price: r.price  // REAL или NULL
            },
            function onCfgDone(err) {
              if (err) return rollback(err);
              if (this.changes === 1 && this.lastID) inserted++;
              else updated++;

              stmtSt.run(
                {
                  $cell:      r.cellNumber,
                  $volume:    r.volume,
                  $maxVolume: r.maxVolume
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
          try { stmtCfg.finalize(); } catch {}
          try { stmtSt.finalize(); }  catch {}
          try { checkCatalog.finalize(); } catch {}
          db.close();
        };

        next();
      });
    });
  });
}

// ---------- helpers ----------
function toInt(v, name, min = Number.MIN_SAFE_INTEGER) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  const i = n | 0;
  if (i < min) throw new Error(`${name} must be >= ${min}`);
  return i;
}
function toReal(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a finite number`);
  return n; // рубли с плавающей точкой — пишем как есть в REAL
}

module.exports = { applyMatrixFromTelemetry };
