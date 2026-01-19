// telemetry-core.mjs
// Модуль телеметрии: работа с локальной SQLite-БД и протоколом Shaker.
// Содержит:
//  - TelemetryDb: обёртка над sqlite3 для каталога, матрицы и журнала продаж;
//  - TelemetryCore: синхронизация с телеметрией, скачивание картинок,
//    логирование продаж.
// Комментарии на русском; все тексты ошибок/логов — на английском.

import sqlite3 from 'sqlite3';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TYPE_MACHINE_INFO,
  TYPE_BASE_PRODUCT_EXPORT,
  TYPE_MATRIX_IMPORT_SNACK,
  TYPE_CELL_STORE_IMPORT_SNACK,
  TYPE_CELL_VOLUME_IMPORT_SNACK,
  TYPE_SALE_IMPORT_SNACK,
  TYPE_SNACK_TOPIC_RES,
  TYPE_CELL_VOLUME_EXPORT_SNACK,
  TYPE_CELL_STORE_EXPORT_SNACK
} from './telemetry-ws-gateway.mjs';

// =============================
// Константы для БД и цен
// =============================

// Множитель для перевода рублей в минимальные единицы (копейки)
const PRICE_SCALE = 100;
const MACHINE_INFO_SINGLETON_ID = 1;
const CATALOG_SYNC_SINGLETON_ID = 1;
const MATRIX_SYNC_SINGLETON_ID = 1;
const MACHINE_CELLS_COUNT = Number(process.env.MACHINE_CELLS_COUNT || 60);

// Сопоставление Content-Type -> расширение файла
const IMAGE_CONTENT_TYPE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg'
};

// =============================
// Класс работы с SQLite
// =============================

class TelemetryDb {
  /**
   * @param {string} dbPath путь к SQLite-файлу
   */
  constructor(dbPath) {
    sqlite3.verbose();
    this.db = new sqlite3.Database(dbPath);

    this.runAsync = promisify(this.db.run.bind(this.db));
    this.getAsync = promisify(this.db.get.bind(this.db));
    this.allAsync = promisify(this.db.all.bind(this.db));
    this.execAsync = promisify(this.db.exec.bind(this.db));
    this.transactionQueue = Promise.resolve();

    this.matrixSeeded = false;
    this.initPromise = this.bootstrapSchemaAndMatrix();
  }

  /**
   * Закрытие соединения с БД.
   */
  async close() {
    await this.ensureReady();
    const closeAsync = promisify(this.db.close.bind(this.db));
    await closeAsync();
  }

  async ensureReady() {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async runInTransaction(work) {
    await this.ensureReady();
    const previous = this.transactionQueue;
    let release;
    this.transactionQueue = new Promise((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      await this.runAsync('BEGIN TRANSACTION');
      const result = await work();
      await this.runAsync('COMMIT');
      return result;
    } catch (err) {
      try {
        await this.runAsync('ROLLBACK');
      } catch (rollbackErr) {
        console.error(
          'Failed to rollback transaction:',
          rollbackErr?.message || rollbackErr
        );
      }
      throw err;
    } finally {
      release();
    }
  }
  async bootstrapSchemaAndMatrix() {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(currentDir, '..', '..');
    const productsSqlPath = path.join(repoRoot, 'productsdb.sql');
    const matrixSqlPath = path.join(repoRoot, 'matrix.sql');

    try {
      await this.execAsync('PRAGMA foreign_keys = ON');
    } catch (err) {
      console.error('Failed to enable foreign_keys pragma:', err.message || err);
    }

    try {
      const [productsSql, matrixSql] = await Promise.all([
        fs.readFile(productsSqlPath, 'utf8'),
        fs.readFile(matrixSqlPath, 'utf8')
      ]);

      if (productsSql) {
        await this.execAsync(productsSql);
      }
      if (matrixSql) {
        await this.execAsync(matrixSql);
      }
    } catch (err) {
      console.error('Failed to apply schema from SQL files:', err.message || err);
    }

    await this.ensurePlaceholderProduct();
    await this.ensureMatrixCellsBaseline();
  }

  async ensurePlaceholderProduct() {
    // Minimal placeholder product to bind empty cells (id = 0)
    await this.runAsync(
      `
      INSERT OR IGNORE INTO catalog_product (
        id, brand_id, taste, img_url, is_adult, price_minor, vendor_code,
        calories, proteins, fats, carbohydrates, compound, allergens, description
      )
      VALUES (0, NULL, '-', NULL, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
      `
    );
  }

  async ensureMatrixCellsBaseline() {
    const rows = await this.allAsync('SELECT cell_number FROM matrix_cell_config');
    const count = new Set(rows.map((r) => Number(r.cell_number))).size;
    if (count === MACHINE_CELLS_COUNT) {
      this.matrixSeeded = false;
      return false;
    }

    await this.runAsync('BEGIN IMMEDIATE');
    try {
      await this.runAsync('DELETE FROM matrix_cell_state');
      await this.runAsync('DELETE FROM matrix_cell_config');

      for (let cellNumber = 1; cellNumber <= MACHINE_CELLS_COUNT; cellNumber++) {
        const rowNumber = Math.floor((cellNumber - 1) / 10) + 1;
        await this.runAsync(
          `
          INSERT INTO matrix_cell_config (
            cell_number,
            row_number,
            size,
            good_id,
            price_minor,
            enabled
          )
          VALUES (
            $cellNumber,
            $rowNumber,
            1,
            0,
            0,
            1
          )
          `,
          {
            $cellNumber: cellNumber,
            $rowNumber: rowNumber
          }
        );
      }

      await this.runAsync('COMMIT');
      this.matrixSeeded = true;
      return true;
    } catch (err) {
      await this.runAsync('ROLLBACK');
      this.matrixSeeded = false;
      throw err;
    }
  }

  async hasCatalogProducts() {
    await this.ensureReady();
    const row = await this.getAsync(
      'SELECT COUNT(*) AS cnt FROM catalog_product WHERE id <> 0'
    );
    return (row?.cnt || 0) > 0;
  }

  // ================
  // machine_info
  // ================

   /**
   * Инициализация служебной таблицы для хранения machineInfo.
   * ВАЖНО: в CHECK нельзя использовать параметр, поэтому либо:
   *  - вообще не использовать CHECK,
   *  - либо захардкодить константу.
   *
   * Здесь делаем проще: без CHECK, но всюду используем MACHINE_INFO_SINGLETON_ID.
   */
  async ensureMachineInfoTable() {
    await this.ensureReady();
    // 1. Создаём таблицу без параметров
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS machine_info (
        id              INTEGER PRIMARY KEY,
        machine_id      INTEGER,
        organization_id INTEGER,
        model_id        INTEGER,
        serial_number   TEXT
      )
    `);

    // 2. Гарантируем наличие единственной строки с id = MACHINE_INFO_SINGLETON_ID
    await this.runAsync(
      `
      INSERT OR IGNORE INTO machine_info (id, machine_id, organization_id, model_id, serial_number)
      VALUES ($id, NULL, NULL, NULL, NULL)
      `,
      { $id: MACHINE_INFO_SINGLETON_ID }
    );
  }


  async getMachineInfo() {
    await this.ensureReady();
    await this.ensureMachineInfoTable();
    const row = await this.getAsync(
      'SELECT machine_id AS machineId, organization_id AS organizationId, model_id AS modelId, serial_number AS serialNumber FROM machine_info WHERE id = ?',
      [MACHINE_INFO_SINGLETON_ID]
    );
    return row || null;
  }

  /**
   * Сохранение machineInfo из ответа телеметрии.
   */
  async saveMachineInfo(info) {
    await this.ensureReady();
    await this.ensureMachineInfoTable();
    const source = info ?? {};
    const toIntOrNull = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };
    const machineId = toIntOrNull(
      source.machineId ?? source.id ?? source.machine_id ?? null
    );
    const organizationId = toIntOrNull(
      source.organizationId ?? source.orgId ?? source.organization_id ?? source.org_id ?? null
    );
    const modelId = toIntOrNull(source.modelId ?? source.model_id ?? null);
    const serialNumber = source.serialNumber ?? source.serial_number ?? null;
    await this.runAsync(
      `
      UPDATE machine_info
         SET machine_id = $machineId,
             organization_id = $organizationId,
             model_id = $modelId,
             serial_number = $serialNumber
       WHERE id = $id
      `,
      {
        $machineId: machineId,
        $organizationId: organizationId,
        $modelId: modelId,
        $serialNumber: serialNumber,
        $id: MACHINE_INFO_SINGLETON_ID
      }
    );
  }

  // ================
  // Каталог товаров
  // ================

  /**
   * Применение каталога к локальной БД по схеме productsdb.sql.
   * @param {Array<any>} items массив товаров из body baseProductRequestExportTopic
   */
    /**
   * Применение каталога к локальной БД по схеме productsdb.sql.
   * Учитывает UNIQUE-ограничение на catalog_brand.name:
   *  - если бренд с таким name уже существует, используем его id;
   *  - если нет — добавляем новый бренд и читаем его id.
   *
   * @param {Array<any>} items массив товаров из body baseProductRequestExportTopic
   */
  async applyCatalog(items) {
    await this.ensureReady();
    await this.runInTransaction(async () => {
      const itemsArray = Array.isArray(items) ? items : [];
      const incomingProductIds = new Set();
      for (const item of itemsArray) {
        const rawId = item?.id;
        const productId = Number(rawId);
        if (Number.isFinite(productId)) {
          incomingProductIds.add(productId);
        }
      }
      // 1. Загружаем уже существующие бренды и строим карту name -> id
      const existingBrands = await this.allAsync(
        'SELECT id, name FROM catalog_brand'
      );

      /** @type {Map<string, number>} */
      const brandIdByName = new Map();
      for (const row of existingBrands) {
        if (row.name != null) {
          brandIdByName.set(row.name, row.id);
        }
      }

      // 2. Проходим по всем товарам и гарантируем наличие брендов
      for (const item of itemsArray) {
        const brand = item.goodBrand || null;
        if (!brand || !brand.name) {
          // бренд не указан — пропускаем, product будет с brand_id = NULL
          continue;
        }

        const brandName =
          typeof brand.name === 'string' ? brand.name.trim() : brand.name;
        if (!brandName) {
          continue;
        }
        // если бренд уже есть в карте — ничего не делаем
        if (brandIdByName.has(brandName)) {
          continue;
        }

        // бренда с таким именем ещё нет — добавляем
        const telemetryBrandId = typeof brand.id === 'number' ? brand.id : null;

        if (telemetryBrandId != null) {
          // пытаемся вставить с заданным id
          await this.runAsync(
            `
            INSERT OR IGNORE INTO catalog_brand (id, name)
            VALUES ($id, $name)
            `,
            {
              $id: telemetryBrandId,
              $name: brandName
            }
          );
        } else {
          // если id нет — даём БД самой сгенерировать
          await this.runAsync(
            `
            INSERT OR IGNORE INTO catalog_brand (name)
            VALUES ($name)
            `,
            { $name: brandName }
          );
        }

        // вычитываем фактический id бренда по имени
        const row = await this.getAsync(
          'SELECT id, name FROM catalog_brand WHERE name = $name',
          { $name: brandName }
        );
        if (!row || row.id == null) {
          if (telemetryBrandId != null) {
            const rowById = await this.getAsync(
              'SELECT id, name FROM catalog_brand WHERE id = $id',
              { $id: telemetryBrandId }
            );
            if (rowById && rowById.id != null) {
              if (rowById.name !== brandName) {
                try {
                  await this.runAsync(
                    'UPDATE catalog_brand SET name = $name WHERE id = $id',
                    { $id: rowById.id, $name: brandName }
                  );
                } catch (err) {
                  console.warn(
                    `Failed to update brand name for id ${rowById.id}: ${err.message}`,
                  );
                }
              }
              brandIdByName.set(brandName, rowById.id);
              continue;
            }
          }

          await this.runAsync(
            `
            INSERT OR IGNORE INTO catalog_brand (name)
            VALUES ($name)
            `,
            { $name: brandName }
          );
          const rowByName = await this.getAsync(
            'SELECT id FROM catalog_brand WHERE name = $name',
            { $name: brandName }
          );
          if (!rowByName || rowByName.id == null) {
            console.warn(`Failed to resolve brand id for name "${brandName}"`);
            continue;
          }
          brandIdByName.set(brandName, rowByName.id);
          continue;
        }
        brandIdByName.set(brandName, row.id);
      }

      // 3. Upsert продуктов, опираясь на brandIdByName
      for (const item of itemsArray) {
        const brand = item.goodBrand || null;
        const rawBrandName = brand?.name ?? null;
        const brandName =
          typeof rawBrandName === 'string' ? rawBrandName.trim() : rawBrandName;
        const brandId = brandName ? (brandIdByName.get(brandName) ?? null) : null;

        const priceMinor = typeof item.price === 'number'
          ? Math.round(item.price * PRICE_SCALE)
          : null;

        await this.runAsync(
          `
          INSERT INTO catalog_product (
            id,
            brand_id,
            taste,
            img_url,
            is_adult,
            price_minor,
            vendor_code,
            calories,
            proteins,
            fats,
            carbohydrates,
            compound,
            allergens,
            description
          )
          VALUES (
            $id,
            $brandId,
            $taste,
            $imgUrl,
            $isAdult,
            $priceMinor,
            $vendorCode,
            $calories,
            $proteins,
            $fats,
            $carbohydrates,
            $compound,
            $allergens,
            $description
          )
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
          `,
          {
            $id: item.id,
            $brandId: brandId,
            $taste: item.taste || '',
            $imgUrl: item.imgPath || null,
            $isAdult: item.isAdult ? 1 : 0,
            $priceMinor: priceMinor,
            $vendorCode: item.vendorCode || null,
            $calories: item.calories ?? null,
            $proteins: item.proteins ?? null,
            $fats: item.fats ?? null,
            $carbohydrates: item.carbohydrates ?? null,
            $compound: item.compound || null,
            $allergens: item.allergens || null,
            $description: item.description || null
          }
        );
      }

      // 4. Обновляем состояние синхронизации каталога
      const incomingIds = Array.from(incomingProductIds).filter((id) => id !== 0);
      if (incomingIds.length === 0) {
        await this.runAsync('DELETE FROM catalog_product WHERE id <> 0');
      } else {
        const params = {};
        const placeholders = incomingIds
          .map((id, index) => {
            const key = `$id${index}`;
            params[key] = id;
            return key;
          })
          .join(', ');
        await this.runAsync(
          `DELETE FROM catalog_product WHERE id <> 0 AND id NOT IN (${placeholders})`,
          params
        );
      }

      await this.runAsync(
        `
        DELETE FROM catalog_brand
         WHERE id NOT IN (
           SELECT DISTINCT brand_id FROM catalog_product WHERE brand_id IS NOT NULL
         )
        `
      );

      await this.runAsync(
        `
        INSERT INTO catalog_sync_state (id, last_sync_ts, source_hash)
        VALUES ($id, $ts, NULL)
        ON CONFLICT(id) DO UPDATE SET last_sync_ts = excluded.last_sync_ts
        `,
        {
          $id: CATALOG_SYNC_SINGLETON_ID,
          $ts: Date.now()
        }
      );

    });
  }

  /**
   * Получение расширенного каталога (vw_catalog_product_full).
   */
  async getCatalogFull() {
    await this.ensureReady();
    const rows = await this.allAsync(
      'SELECT * FROM vw_catalog_product_full ORDER BY id ASC'
    );
    return rows;
  }

  // ================
  // Матрица товаров
  // ================

  /**
   * Формирование payload матрицы по представлению vw_matrix_cell_full.
   * @param {{machineId:number, organizationId:number, modelId:number, serialNumber:string}} machineInfo
   */
  async buildMatrixPayload(machineInfo) {
    await this.ensureReady();
    const rows = await this.allAsync(
      `
      SELECT
        cell_number    AS cellNumber,
        row_number     AS rowNumber,
        size           AS size,
        good_id        AS goodId,
        price_minor    AS priceMinor,
        volume         AS volume,
        max_volume     AS maxVolume,
        enabled        AS enabled
      FROM vw_matrix_cell_full
      ORDER BY cell_number ASC
      `
    );

    const matrix = rows.map(row => ({
      cellNumber: row.cellNumber,
      rowNumber: row.rowNumber,
      price: row.priceMinor != null ? row.priceMinor / PRICE_SCALE : 0,
      goodId: row.goodId != null ? String(row.goodId) : null,
      size: row.size,
      volume: row.volume,
      maxVolume: row.maxVolume,
      isActive: !!row.enabled
    }));

    return {
      machineId: machineInfo.machineId,
      matrix
    };
  }

  /**
   * Применение массива ячеек из телеметрии (matrixExportTopicSnack, cellStoreExportSnack).
   * @param {Array<any>} cells
   */
  async applyMatrixCellsFromServer(cells) {
    await this.ensureReady();
    await this.runInTransaction(async () => {
      for (const cell of cells) {
        const priceMinor = typeof cell.price === 'number'
          ? Math.round(cell.price * PRICE_SCALE)
          : null;

        await this.runAsync(
          `
          INSERT INTO matrix_cell_config (
            cell_number,
            row_number,
            size,
            good_id,
            price_minor,
            enabled
          )
          VALUES (
            $cellNumber,
            $rowNumber,
            $size,
            $goodId,
            $priceMinor,
            $enabled
          )
          ON CONFLICT(cell_number) DO UPDATE SET
            size        = excluded.size,
            good_id     = excluded.good_id,
            price_minor = excluded.price_minor,
            enabled     = excluded.enabled
          `,
          {
            $cellNumber: cell.cellNumber,
            $rowNumber: cell.rowNumber ?? null,
            $size: cell.size ?? 0,
            $goodId: cell.goodId != null ? Number(cell.goodId) : null,
            $priceMinor: priceMinor,
            $enabled: cell.isActive === false ? 0 : 1
          }
        );

        if (typeof cell.volume === 'number' || typeof cell.maxVolume === 'number') {
          await this.runAsync(
            `
            INSERT INTO matrix_cell_state (
              cell_number,
              volume,
              max_volume,
              last_refill_ts,
              updated_at
            )
            VALUES (
              $cellNumber,
              $volume,
              $maxVolume,
              NULL,
              $now
            )
            ON CONFLICT(cell_number) DO UPDATE SET
              volume     = excluded.volume,
              max_volume = excluded.max_volume,
              updated_at = excluded.updated_at
            `,
            {
              $cellNumber: cell.cellNumber,
              $volume: cell.volume ?? 0,
              $maxVolume: cell.maxVolume ?? 0,
              $now: Date.now()
            }
          );
        }
      }

      await this.runAsync(
        `
        INSERT INTO matrix_sync_state (id, last_sync_ts, source_hash, matrix_version)
        VALUES ($id, $ts, NULL, NULL)
        ON CONFLICT(id) DO UPDATE SET last_sync_ts = excluded.last_sync_ts
        `,
        {
          $id: MATRIX_SYNC_SINGLETON_ID,
          $ts: Date.now()
        }
      );

    });
  }

  /**
   * Применение остатков по ячейкам из cellVolumeExportSnack.
   * @param {Array<{cellNumber:number, volume:number}>} cells
   */
  async applyCellVolumesFromServer(cells) {
    await this.ensureReady();
    await this.runInTransaction(async () => {
      for (const cell of cells) {
        const volume =
          typeof cell.volume === 'number' && Number.isFinite(cell.volume)
            ? Math.max(0, cell.volume)
            : 0;

        await this.runAsync(
          `
          UPDATE matrix_cell_state
             SET volume = MIN(max_volume, $volume),
                 updated_at = $now
           WHERE cell_number = $cellNumber
          `,
          {
            $volume: volume,
            $now: Date.now(),
            $cellNumber: cell.cellNumber
          }
        );
      }
    });
  }

  /**
   * Получение текущей матрицы (vw_matrix_cell_full).
   */
  async getMatrixFull() {
    await this.ensureReady();
    const rows = await this.allAsync(
      'SELECT * FROM vw_matrix_cell_full ORDER BY cell_number ASC'
    );
    return rows;
  }

  // ================
  // Журнал продаж
  // ================

  /**
   * Логирование продажи в matrix_sale_log по схеме из matrix.sql.
   * Использует триггер trg_sale_apply для уменьшения volume.
   *
   * @param {any} sale объект продажи из протокола saleImportTopicSnack (одна продажа)
   */
  async logSaleFromTelemetry(sale) {
    await this.ensureReady();
    const writeOffs = Array.isArray(sale.writeOffs) ? sale.writeOffs : [];
    if (writeOffs.length === 0) {
      return; // нечего логировать
    }

    const saleUuid = sale['sale-uuid'] || sale.saleUuid || null;
    const baseTs = typeof sale.dateSale === 'string'
      ? Date.parse(sale.dateSale)
      : Date.now();
    const ts = Number.isFinite(baseTs) ? baseTs : Date.now();

    await this.runInTransaction(async () => {
      for (const writeOff of writeOffs) {
        const cellNumber = writeOff.cellNumber;
        if (typeof cellNumber !== 'number') {
          // пропускаем некорректную запись
          continue;
        }

        // Количество: если явно указано в writeOff, берём; иначе total volume для одиночной ячейки; иначе 1.
        let qty = 1;
        if (typeof writeOff.volume === 'number') {
          qty = writeOff.volume;
        } else if (typeof sale.volume === 'number' && writeOffs.length === 1) {
          qty = sale.volume;
        }

        const goodId = writeOff.productId ?? sale.goodId ?? null;
        const priceMinor = typeof sale.price === 'number'
          ? Math.round(sale.price * PRICE_SCALE)
          : null;

        const paymentRef = saleUuid;
        const note = saleUuid
          ? `telemetry sale ${saleUuid}`
          : 'telemetry sale';

        await this.runAsync(
          `
          INSERT INTO matrix_sale_log (
            ts,
            cell_number,
            qty,
            good_id,
            price_minor,
            payment_ref,
            note
          )
          VALUES (
            $ts,
            $cellNumber,
            $qty,
            $goodId,
            $priceMinor,
            $paymentRef,
            $note
          )
          `,
          {
            $ts: ts,
            $cellNumber: cellNumber,
            $qty: qty,
            $goodId: goodId,
            $priceMinor: priceMinor,
            $paymentRef: paymentRef,
            $note: note
          }
        );
      }

    });
  }
}

// ========================
// TelemetryCore – высокоуровневый API
// ========================
export class TelemetryCore {
  /**
   * @param {object} options
   * @param {string} options.dbPath     путь к SQLite-файлу
   * @param {import('./telemetry-ws-gateway.mjs').TelemetryWsGateway} options.transport
   * @param {string|null} [options.imageDir] директория с локальными картинками товаров
   */
  constructor({ dbPath, transport, imageDir = null }) {
    this.db = new TelemetryDb(dbPath);
    this.transport = transport;

    // Директория с локальными изображениями товаров (может быть null)
    this.imageDir = imageDir;
    // Кэш соответствий productId -> абсолютный путь к файлу
    this.imagePathByProductId = null;
    this.imageDownloadPromise = null;
    this.pendingImageDownload = null;
    this.lastMatrixSyncConnectionId = null;
    this.lastCatalogSyncConnectionId = null;

    this.postBootstrapPromise = this.db
      .ensureReady()
      .then(() => this.handlePostBootstrap())
      .catch((err) => {
        console.error('Telemetry post-bootstrap failed:', err);
      });

    this.transport.onPush((msg) => {
      this.handleIncomingPush(msg).catch((err) => {
        console.error('Error handling telemetry push:', err);
      });
    });
    this.transport.onConnect((info) => {
      this.handleTransportConnected(info).catch((err) => {
        console.error(
          'Failed to sync telemetry after connect:',
          err?.message || err,
        );
      });
    });
  }

  async handlePostBootstrap() {
    const hasCatalog = await this.db.hasCatalogProducts();

    if (!hasCatalog) {
      try {
        await this.syncCatalog();
      } catch (err) {
        console.error('Failed to sync catalog after bootstrap:', err.message || err);
      }
    }

  }

  async ensurePostBootstrap() {
    if (this.postBootstrapPromise) {
      await this.postBootstrapPromise;
    }
  }

  async handleTransportConnected({ connectionId } = {}) {
    const hasConnectionId = Number.isInteger(connectionId);
    const shouldSyncCatalog =
      !hasConnectionId || this.lastCatalogSyncConnectionId !== connectionId;
    const shouldSyncMatrix =
      !hasConnectionId || this.lastMatrixSyncConnectionId !== connectionId;

    if (!shouldSyncCatalog && !shouldSyncMatrix) {
      return;
    }

    await this.db.ensureReady();

    if (hasConnectionId) {
      if (shouldSyncCatalog) {
        this.lastCatalogSyncConnectionId = connectionId;
      }
      if (shouldSyncMatrix) {
        this.lastMatrixSyncConnectionId = connectionId;
      }
    }

    if (shouldSyncCatalog) {
      try {
        await this.syncCatalog();
      } catch (err) {
        console.error(
          'Failed to sync catalog on telemetry connect:',
          err?.message || err,
        );
      }
    }

    if (shouldSyncMatrix) {
      try {
        await this.syncMatrix();
      } catch (err) {
        console.error('Failed to push matrix on telemetry connect:', err.message || err);
      }
    }
  }


  async close() {
    await this.db.close();
  }

  // ======================
  // Вспомогательные
  // ======================

  async ensureMachineInfo() {
    let info = await this.db.getMachineInfo();
    if (info && info.machineId && info.organizationId) {
      return info;
    }

    const { ack } = await this.transport.send({
      type: TYPE_MACHINE_INFO,
      body: {}
    });

    if (!ack || ack.success !== true || !ack.body) {
      throw new Error('Failed to get machineInfo from telemetry server');
    }

    await this.db.saveMachineInfo(ack.body);

    info = await this.db.getMachineInfo();
    if (!info || !info.machineId || !info.organizationId) {
      throw new Error('Machine info not stored correctly in database');
    }
    return info;
  }

  generateRequestUuid() {
    const randomPart = Math.random().toString(16).slice(2);
    const timestamp = Date.now();
    return `REQ-${timestamp}-${randomPart}`;
  }

  // ======================
  // Каталог
  // ======================

  /**
   * Синхронизация каталога и скачивание картинок (если указан imageDir).
   * @param {string|null} imageDir
   */
   /**
   * Синхронизация каталога и скачивание картинок.
   * Если imageDir не передан явно, используется this.imageDir (из конфига).
   * @param {string|null} [imageDirOverride]
   */
  async syncCatalog(imageDirOverride = null) {
    const machine = await this.ensureMachineInfo();

    const { ack, result } = await this.transport.send({
      type: TYPE_BASE_PRODUCT_EXPORT,
      body: {
        machineId: machine.machineId,
        organizationId: machine.organizationId
      },
      timeoutMs: 20_000
    });

    if (!ack || ack.success !== true) {
      return {
        success: false,
        message: ack ? (ack.message || 'Catalog ACK failed') : 'No ACK for catalog',
        ack,
        result
      };
    }

    if (!result || !Array.isArray(result.body)) {
      return {
        success: false,
        message: 'Catalog result body is empty or invalid',
        ack,
        result
      };
    }

    const items = result.body;
    await this.db.applyCatalog(items);

    const imageDir = imageDirOverride ?? this.imageDir;
    if (imageDir) {
      this.scheduleCatalogImageDownload(items, imageDir);
    }

    return {
      success: true,
      message: 'Catalog synced successfully',
      ack,
      result,
      meta: { itemCount: items.length }
    };
  }

  scheduleCatalogImageDownload(items, imageDir) {
    if (!imageDir) {
      return;
    }

    this.pendingImageDownload = { items, imageDir };

    if (this.imageDownloadPromise) {
      return;
    }

    const run = async () => {
      while (this.pendingImageDownload) {
        const current = this.pendingImageDownload;
        this.pendingImageDownload = null;
        await this.downloadProductImages(current.items, current.imageDir);
        this.imagePathByProductId = null;
      }
    };

    this.imageDownloadPromise = run()
      .catch((err) => {
        console.error('Failed to download product images:', err?.message || err);
      })
      .finally(() => {
        this.imageDownloadPromise = null;
      });
  }
  /**
   * Скачивание картинок каталога в указанную директорию.
   * Имя файла: "<id>.<ext>", где ext определяется по Content-Type либо расширению URL.
   */
  async downloadProductImages(items, imageDir) {
    await fs.mkdir(imageDir, { recursive: true });

    const itemsArray = Array.isArray(items) ? items : [];
    const downloadById = new Map();

    for (const item of itemsArray) {
      const productId = Number(item?.id);
      if (!Number.isFinite(productId) || productId <= 0) {
        continue;
      }

      const url = typeof item.imgPath === 'string' ? item.imgPath.trim() : '';
      if (url) {
        downloadById.set(productId, url);
      }
    }

    try {
      const entries = await fs.readdir(imageDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filePath = path.join(imageDir, entry.name);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          if (err?.code !== 'ENOENT') {
            console.warn(
              `Failed to remove image file ${entry.name}: ${err.message}`
            );
          }
        }
      }
    } catch (err) {
      console.error('Failed to clear product images directory:', err.message || err);
    }

    for (const [productId, url] of downloadById.entries()) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(
            `Failed to download image for product ${productId}: HTTP ${response.status}`
          );
          continue;
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        let ext = IMAGE_CONTENT_TYPE_EXTENSIONS[contentType] || null;

        if (!ext) {
          try {
            const urlObj = new URL(url);
            const extName = path.extname(urlObj.pathname).toLowerCase().replace('.', '');
            if (extName && Object.values(IMAGE_CONTENT_TYPE_EXTENSIONS).includes(extName)) {
              ext = extName;
            }
          } catch {
          }
        }

        if (!ext) {
          ext = 'bin';
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileName = `${productId}.${ext}`;
        const filePath = path.join(imageDir, fileName);
        await fs.writeFile(filePath, buffer);
      } catch (err) {
        console.error(
          `Error while downloading image for product ${productId}: ${err.message}`
        );
      }
    }
  }
  async getCatalog() {
    await this.ensurePostBootstrap();
    const rows = await this.db.getCatalogFull();
    if (!rows || rows.length === 0) {
      // Try one forced sync if catalog still empty
      try {
        await this.syncCatalog();
        const refreshed = await this.db.getCatalogFull();
        return this.mapRowsWithLocalImages(refreshed);
      } catch (err) {
        console.error('Catalog refresh on empty dataset failed:', err.message || err);
      }
    }
    return this.mapRowsWithLocalImages(rows);
  }


  // ======================
  // Матрица
  // ======================

  async syncMatrix() {
    await this.db.ensureReady();
    const machine = await this.ensureMachineInfo();
    const payload = await this.db.buildMatrixPayload(machine);
    const requestUuid = this.generateRequestUuid();

    const { ack, result } = await this.transport.send({
      type: TYPE_MATRIX_IMPORT_SNACK,
      body: {
        requestUuid,
        machineId: payload.machineId,
        matrix: payload.matrix
      },
      timeoutMs: 20_000
    });

    if (!ack || ack.success !== true) {
      return {
        success: false,
        message: ack ? (ack.message || 'Matrix ACK failed') : 'No ACK for matrix',
        ack,
        result
      };
    }

    if (!result || result.type !== TYPE_SNACK_TOPIC_RES || !result.body) {
      return {
        success: false,
        message: 'Matrix result is empty or has unexpected type',
        ack,
        result
      };
    }

    const resBody = result.body;
    if (!resBody.success) {
      return {
        success: false,
        message: 'Matrix sync failed on telemetry server',
        ack,
        result
      };
    }

    return {
      success: true,
      message: 'Matrix synced successfully',
      ack,
      result
    };
  }

  async syncCellsPartial(cells) {
    const machine = await this.ensureMachineInfo();
    const requestUuid = this.generateRequestUuid();

    const { ack, result } = await this.transport.send({
      type: TYPE_CELL_STORE_IMPORT_SNACK,
      body: {
        requestUuid,
        machineId: `MACHINE_ID_${machine.machineId}`,
        cells
      },
      timeoutMs: 20_000
    });

    if (!ack || ack.success !== true) {
      return {
        success: false,
        message: ack ? (ack.message || 'Cell store ACK failed') : 'No ACK for cell store',
        ack,
        result
      };
    }

    if (!result || result.type !== TYPE_SNACK_TOPIC_RES || !result.body) {
      return {
        success: false,
        message: 'Cell store result is empty or has unexpected type',
        ack,
        result
      };
    }

    const resBody = result.body;
    if (!resBody.success) {
      return {
        success: false,
        message: 'Cell store sync failed on telemetry server',
        ack,
        result
      };
    }

    // Apply changes locally so subsequent reads reflect assigned products immediately
    await this.db.applyMatrixCellsFromServer(cells);

    return {
      success: true,
      message: 'Cell store synced successfully',
      ack,
      result
    };
  }

  async syncCellVolumes(cells) {
    const machine = await this.ensureMachineInfo();
    const requestUuid = this.generateRequestUuid();

    const { ack, result } = await this.transport.send({
      type: TYPE_CELL_VOLUME_IMPORT_SNACK,
      body: {
        requestUuid,
        machineId: `MACHINE_ID_${machine.machineId}`,
        cells
      },
      timeoutMs: 20_000
    });

    if (!ack || ack.success !== true) {
      return {
        success: false,
        message: ack ? (ack.message || 'Cell volume ACK failed') : 'No ACK for cell volume import',
        ack,
        result
      };
    }

    if (!result || result.type !== TYPE_CELL_VOLUME_EXPORT_SNACK || !Array.isArray(result.body)) {
      return {
        success: false,
        message: 'Cell volume result is empty or has unexpected type',
        ack,
        result
      };
    }

    await this.db.applyCellVolumesFromServer(result.body);

    return {
      success: true,
      message: 'Cell volumes synced successfully',
      ack,
      result
    };
  }

  
  async getMatrix() {
    const rows = await this.db.getMatrixFull();
    return this.mapRowsWithLocalImages(rows);
  }
  // ======================
  // Продажи
  // ======================

  /**
   * Отправка продажи в телеметрию и запись в matrix_sale_log.
   * @param {any} saleObject объект одной продажи (элемент массива body)
   */
  async sendSaleDirect(saleObject) {
    const body = [saleObject];

    const { ack, result } = await this.transport.send({
      type: TYPE_SALE_IMPORT_SNACK,
      body,
      timeoutMs: 20_000
    });

    if (!ack || ack.success !== true) {
      return {
        success: false,
        message: ack ? (ack.message || 'Sale ACK failed') : 'No ACK for sale',
        ack,
        result
      };
    }

    // При успешном ACK — логируем продажу в локальную БД, триггер уменьшит остатки
    try {
      await this.db.logSaleFromTelemetry(saleObject);
    } catch (err) {
      console.error('Failed to log sale into local database:', err);
      // Не падаем наружу, т.к. продажа уже принята телеметрией
    }

    return {
      success: true,
      message: 'Sale sent successfully',
      ack,
      result
    };
  }

  // ======================
  // Обработка push-сообщений
  // ======================

  async handleIncomingPush(msg) {
    switch (msg.type) {
      case TYPE_CELL_STORE_EXPORT_SNACK:
      case 'matrixExportTopicSnack':
        if (Array.isArray(msg.body)) {
          await this.db.applyMatrixCellsFromServer(msg.body);
        }
        break;
      case TYPE_CELL_VOLUME_EXPORT_SNACK:
        if (Array.isArray(msg.body)) {
          await this.db.applyCellVolumesFromServer(msg.body);
        }
        break;
      default:
        console.warn('Unknown telemetry push type:', msg.type);
    }
  }
    /**
   * Строит (или возвращает из кэша) карту соответствий:
   *   productId (целое число) -> абсолютный путь к локальному файлу изображения.
   * Картинки ожидаются в this.imageDir и имеют формат "<id>.<ext>".
   */
  async buildImageIndexIfNeeded() {
    if (!this.imageDir) {
      // нет директории — нет индекса
      this.imagePathByProductId = null;
      return;
    }

    if (this.imagePathByProductId) {
      return;
    }

    const index = new Map();

    try {
      const entries = await fs.readdir(this.imageDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const match = entry.name.match(/^(\d+)\.[^.]+$/);
        if (!match) continue;

        const productId = Number(match[1]);
        if (!Number.isFinite(productId)) continue;

        const fullPath = path.resolve(this.imageDir, entry.name);
        index.set(productId, fullPath);
      }
    } catch (err) {
      console.error('Failed to read product images directory:', err);
    }

    this.imagePathByProductId = index;
  }

  /**
   * Заменяет путь к картинке в строках каталога/матрицы на локальный,
   * если найдена соответствующая картинка.
   *
   * Ищем productId в полях: id, good_id, goodId.
   * Обновляем поля изображения, если они есть: img_url, imgUrl, img_path, imgPath.
   *
   * @param {Array<any>} rows
   * @returns {Promise<Array<any>>}
   */
    /**
   * Заменяет путь к картинке в строках каталога/матрицы на локальный,
   * если найдена соответствующая картинка.
   *
   * Ищем productId в полях: id, good_id, goodId.
   * Обновляем поля изображения, если они есть:
   *   - img_url / imgUrl
   *   - img_path / imgPath
   *   - product_img / productImg
   *
   * @param {Array<any>} rows
   * @returns {Promise<Array<any>>}
   */
  async mapRowsWithLocalImages(rows) {
    if (!this.imageDir || !Array.isArray(rows) || rows.length === 0) {
      return rows;
    }

    await this.buildImageIndexIfNeeded();
    const index = this.imagePathByProductId;
    if (!index || index.size === 0) {
      return rows;
    }

    return rows.map((row) => {
      const copy = { ...row };

      // определяем productId для строки
      const productId =
        copy.id ??
        copy.good_id ??
        copy.goodId ??
        null;

      if (productId != null && index.has(productId)) {
        const localPath = index.get(productId);

        // поля каталога
        if (Object.prototype.hasOwnProperty.call(copy, 'img_url')) {
          copy.img_url = localPath;
        }
        if (Object.prototype.hasOwnProperty.call(copy, 'imgUrl')) {
          copy.imgUrl = localPath;
        }
        if (Object.prototype.hasOwnProperty.call(copy, 'img_path')) {
          copy.img_path = localPath;
        }
        if (Object.prototype.hasOwnProperty.call(copy, 'imgPath')) {
          copy.imgPath = localPath;
        }

        // поля матрицы (как в vw_matrix_cell_full)
        if (Object.prototype.hasOwnProperty.call(copy, 'product_img')) {
          copy.product_img = localPath;
        }
        if (Object.prototype.hasOwnProperty.call(copy, 'productImg')) {
          copy.productImg = localPath;
        }
      }

      return copy;
    });
  }


}
