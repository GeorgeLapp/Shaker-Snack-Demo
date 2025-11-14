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
  }

  /**
   * Закрытие соединения с БД.
   */
  async close() {
    const closeAsync = promisify(this.db.close.bind(this.db));
    await closeAsync();
  }

  // ================
  // machine_info
  // ================

  async ensureMachineInfoTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS machine_info (
        id              INTEGER PRIMARY KEY CHECK (id = $id),
        machine_id      INTEGER,
        organization_id INTEGER,
        model_id        INTEGER,
        serial_number   TEXT
      );
      INSERT OR IGNORE INTO machine_info (id, machine_id, organization_id, model_id, serial_number)
      VALUES ($id, NULL, NULL, NULL, NULL);
    `;
    await this.runAsync(sql, { $id: MACHINE_INFO_SINGLETON_ID });
  }

  async getMachineInfo() {
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
    await this.ensureMachineInfoTable();
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
        $machineId: info.id,
        $organizationId: info.organizationId,
        $modelId: info.modelId,
        $serialNumber: info.serialNumber,
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
  async applyCatalog(items) {
    await this.runAsync('BEGIN TRANSACTION');
    try {
      // 1) Бренды
      for (const item of items) {
        const brand = item.goodBrand || null;
        if (brand && typeof brand.id === 'number') {
          await this.runAsync(
            `
            INSERT INTO catalog_brand (id, name)
            VALUES ($id, $name)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name
            `,
            {
              $id: brand.id,
              $name: brand.name || ''
            }
          );
        }
      }

      // 2) Продукты
      for (const item of items) {
        const brand = item.goodBrand || null;
        const brandId = brand && typeof brand.id === 'number' ? brand.id : null;

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

      // 3) Обновляем состояние синхронизации каталога
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

      await this.runAsync('COMMIT');
    } catch (err) {
      await this.runAsync('ROLLBACK');
      throw err;
    }
  }

  /**
   * Получение расширенного каталога (vw_catalog_product_full).
   */
  async getCatalogFull() {
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
    await this.runAsync('BEGIN TRANSACTION');
    try {
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
            row_number  = excluded.row_number,
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

      await this.runAsync('COMMIT');
    } catch (err) {
      await this.runAsync('ROLLBACK');
      throw err;
    }
  }

  /**
   * Применение остатков по ячейкам из cellVolumeExportSnack.
   * @param {Array<{cellNumber:number, volume:number}>} cells
   */
  async applyCellVolumesFromServer(cells) {
    await this.runAsync('BEGIN TRANSACTION');
    try {
      for (const cell of cells) {
        await this.runAsync(
          `
          UPDATE matrix_cell_state
             SET volume = $volume,
                 updated_at = $now
           WHERE cell_number = $cellNumber
          `,
          {
            $volume: cell.volume,
            $now: Date.now(),
            $cellNumber: cell.cellNumber
          }
        );
      }
      await this.runAsync('COMMIT');
    } catch (err) {
      await this.runAsync('ROLLBACK');
      throw err;
    }
  }

  /**
   * Получение текущей матрицы (vw_matrix_cell_full).
   */
  async getMatrixFull() {
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
    const writeOffs = Array.isArray(sale.writeOffs) ? sale.writeOffs : [];
    if (writeOffs.length === 0) {
      return; // нечего логировать
    }

    const saleUuid = sale['sale-uuid'] || sale.saleUuid || null;
    const baseTs = typeof sale.dateSale === 'string'
      ? Date.parse(sale.dateSale)
      : Date.now();
    const ts = Number.isFinite(baseTs) ? baseTs : Date.now();

    await this.runAsync('BEGIN TRANSACTION');
    try {
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

      await this.runAsync('COMMIT');
    } catch (err) {
      await this.runAsync('ROLLBACK');
      throw err;
    }
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
   */
  constructor({ dbPath, transport }) {
    this.db = new TelemetryDb(dbPath);
    this.transport = transport;

    this.transport.onPush((msg) => {
      this.handleIncomingPush(msg).catch((err) => {
        console.error('Error handling telemetry push:', err);
      });
    });
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
  async syncCatalog(imageDir = null) {
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

    if (imageDir) {
      await this.downloadProductImages(items, imageDir);
    }

    return {
      success: true,
      message: 'Catalog synced successfully',
      ack,
      result,
      meta: { itemCount: items.length }
    };
  }

  /**
   * Скачивание картинок каталога в указанную директорию.
   * Имя файла: "<id>.<ext>", где ext определяется по Content-Type либо расширению URL.
   */
  async downloadProductImages(items, imageDir) {
    await fs.mkdir(imageDir, { recursive: true });

    for (const item of items) {
      const url = item.imgPath;
      const id = item.id;

      if (!url || !id) continue;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(
            `Failed to download image for product ${id}: HTTP ${response.status}`
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
            // игнорируем ошибки парсинга URL
          }
        }

        if (!ext) {
          ext = 'bin';
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileName = `${id}.${ext}`;
        const filePath = path.join(imageDir, fileName);
        await fs.writeFile(filePath, buffer);
      } catch (err) {
        console.error(
          `Error while downloading image for product ${id}: ${err.message}`
        );
      }
    }
  }

  async getCatalog() {
    return this.db.getCatalogFull();
  }

  // ======================
  // Матрица
  // ======================

  async syncMatrix() {
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
    return this.db.getMatrixFull();
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
}
