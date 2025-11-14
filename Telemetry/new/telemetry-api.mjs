// telemetry-api.mjs
// HTTP API-сервис телеметрии.
// Делает:
//  - REST-эндпоинты для каталога, матрицы, продаж;
//  - валидацию входящих JSON;
//  - проксирование вызовов к TelemetryCore.
//
// Комментарии на русском;
// все сообщения и тексты ошибок — на английском.

import express from 'express';

import { TelemetryWsGateway } from './telemetry-ws-gateway.mjs';
import { TelemetryCore } from './telemetry-core.mjs';
import {
  HTTP_PORT,
  TELEMETRY_OAUTH_URL,
  TELEMETRY_WS_URL,
  TELEMETRY_CLIENT_ID,
  TELEMETRY_CLIENT_SECRET,
  DB_PATH
} from './telemetry-config.mjs';

// ========================
// HTTP статусы (без магии)
// ========================

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_BAD_GATEWAY = 502;
const HTTP_STATUS_INTERNAL_ERROR = 500;

// ========================
// Инициализация зависимостей
// ========================

const transport = new TelemetryWsGateway({
  oauthUrl: TELEMETRY_OAUTH_URL,
  clientId: TELEMETRY_CLIENT_ID,
  clientSecret: TELEMETRY_CLIENT_SECRET,
  wsUrl: TELEMETRY_WS_URL
});

const telemetryCore = new TelemetryCore({
  dbPath: DB_PATH,
  transport
});

// ========================
// Вспомогательная валидация
// ========================

/**
 * Простая валидация объекта продажи из протокола saleImportTopicSnack.
 * Возвращает строку с описанием ошибки или null, если всё ок.
 * @param {any} obj
 * @returns {string|null}
 */
function validateSaleObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return 'Sale payload must be a JSON object';
  }

  const requiredScalarFields = [
    'machineId',
    'machineModelId',
    'orgId',
    'serialNumber',
    'totalPrice',
    'price',
    'dateSale',
    'volume',
    'machineTimezone',
    'goodId',
    'brandId'
  ];

  for (const field of requiredScalarFields) {
    if (obj[field] === undefined || obj[field] === null) {
      return `Missing required field: ${field}`;
    }
  }

  if (!Array.isArray(obj.writeOffs) || obj.writeOffs.length === 0) {
    return 'Field "writeOffs" must be a non-empty array';
  }

  if (!Array.isArray(obj.payments) || obj.payments.length === 0) {
    return 'Field "payments" must be a non-empty array';
  }

  for (const writeOff of obj.writeOffs) {
    if (typeof writeOff.cellNumber !== 'number') {
      return 'Each writeOff must have numeric cellNumber';
    }
    if (writeOff.productId === undefined || writeOff.productId === null) {
      return 'Each writeOff must have productId';
    }
  }

  for (const payment of obj.payments) {
    if (typeof payment.price !== 'number') {
      return 'Each payment must have numeric price';
    }
    if (typeof payment.method !== 'string') {
      return 'Each payment must have string method';
    }
  }

  return null;
}

/**
 * Валидация массива ячеек для частичного обновления конфигурации/наполнения.
 * @param {any} cells
 * @returns {string|null}
 */
function validateCellsPayload(cells) {
  if (!Array.isArray(cells)) {
    return 'Body must be an array of cells';
  }

  for (const cell of cells) {
    if (!cell || typeof cell !== 'object') {
      return 'Each cell must be a JSON object';
    }
    if (typeof cell.cellNumber !== 'number') {
      return 'Each cell must have numeric cellNumber';
    }
  }

  return null;
}

/**
 * Валидация массива остатков по ячейкам.
 * @param {any} cells
 * @returns {string|null}
 */
function validateVolumesPayload(cells) {
  if (!Array.isArray(cells)) {
    return 'Body must be an array of volume objects';
  }

  for (const cell of cells) {
    if (!cell || typeof cell !== 'object') {
      return 'Each volume item must be a JSON object';
    }
    if (typeof cell.cellNumber !== 'number') {
      return 'Each volume item must have numeric cellNumber';
    }
    if (typeof cell.volume !== 'number' || cell.volume < 0) {
      return 'Each volume item must have non-negative numeric volume';
    }
  }

  return null;
}

// ========================
// Настройка Express
// ========================

const app = express();
app.use(express.json());

// ---------- Каталог ----------

/**
 * Синхронизация каталога с сервером телеметрии.
 * Опциональный query-параметр imageDir производит скачивание картинок.
 */
app.post('/api/telemetry/catalog/sync', async (req, res) => {
  try {
    const imageDir = typeof req.query.imageDir === 'string'
      ? req.query.imageDir
      : null;

    const result = await telemetryCore.syncCatalog(imageDir);
    const statusCode = result.success ? HTTP_STATUS_OK : HTTP_STATUS_BAD_GATEWAY;
    res.status(statusCode).json(result);
  } catch (err) {
    console.error('Catalog sync error:', err);
    res.status(HTTP_STATUS_INTERNAL_ERROR).json({
      success: false,
      message: 'Internal server error during catalog sync'
    });
  }
});

/**
 * Получение каталога товаров из локальной БД.
 */
app.get('/api/catalog', async (req, res) => {
  try {
    const rows = await telemetryCore.getCatalog();
    res.status(HTTP_STATUS_OK).json(rows);
  } catch (err) {
    console.error('Get catalog error:', err);
    res.status(HTTP_STATUS_INTERNAL_ERROR).json({
      success: false,
      message: 'Internal server error during catalog fetch'
    });
  }
});

// ---------- Матрица ----------

/**
 * Синхронизация полной матрицы.
 */
app.post('/api/telemetry/matrix/sync', async (req, res) => {
  try {
    const result = await telemetryCore.syncMatrix();
    const statusCode = result.success ? HTTP_STATUS_OK : HTTP_STATUS_BAD_GATEWAY;
    res.status(statusCode).json(result);
  } catch (err) {
    console.error('Matrix sync error:', err);
    res.status(HTTP_STATUS_INTERNAL_ERROR).json({
      success: false,
      message: 'Internal server error during matrix sync'
    });
  }
});

/**
 * Получение текущей матрицы из БД.
 */
app.get('/api/matrix', async (req, res) => {
  try {
    const rows = await telemetryCore.getMatrix();
    res.status(HTTP_STATUS_OK).json(rows);
  } catch (err) {
    console.error('Get matrix error:', err);
    res.status(HTTP_STATUS_INTERNAL_ERROR).json({
      success: false,
      message: 'Internal server error during matrix fetch'
    });
  }
});

// ---------- Частичные обновления матрицы ----------

/**
 * Частичное обновление конфигурации/наполнения (cellStoreImportTopicSnack).
 */
app.post('/api/telemetry/matrix/cells', async (req, res) => {
  try {
    const validationError = validateCellsPayload(req.body);
    if (validationError) {
      res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        message: validationError
      });
      return;
    }

    const cells = req.body;
    const result = await telemetryCore.syncCellsPartial(cells);
    const statusCode = result.success ? HTTP_STATUS_OK : HTTP_STATUS_BAD_GATEWAY;
    res.status(statusCode).json(result);
  } catch (err) {
    console.error('Cell store sync error:', err);
    res.status(HTTP_STATUS_INTERNAL_ERROR).json({
      success: false,
      message: 'Internal server error during cell store sync'
    });
  }
});

/**
 * Обновление остатков (cellVolumeImportTopicSnack).
 */
app.post('/api/telemetry/matrix/volumes', async (req, res) => {
  try {
    const validationError = validateVolumesPayload(req.body);
    if (validationError) {
      res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        message: validationError
      });
      return;
    }

    const cells = req.body;
    const result = await telemetryCore.syncCellVolumes(cells);
    const statusCode = result.success ? HTTP_STATUS_OK : HTTP_STATUS_BAD_GATEWAY;
    res.status(statusCode).json(result);
  } catch (err) {
    console.error('Cell volume sync error:', err);
    res.status(HTTP_STATUS_INTERNAL_ERROR).json({
      success: false,
      message: 'Internal server error during cell volume sync'
    });
  }
});

// ---------- Продажи ----------

/**
 * Отправка продажи в телеметрию и логирование её в matrix_sale_log.
 * Тело запроса — один объект продажи (будет обёрнут в массив body).
 */
app.post('/api/telemetry/sales', async (req, res) => {
  try {
    const saleObject = req.body;
    const validationError = validateSaleObject(saleObject);
    if (validationError) {
      res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        message: validationError
      });
      return;
    }

    const result = await telemetryCore.sendSaleDirect(saleObject);
    const statusCode = result.success ? HTTP_STATUS_OK : HTTP_STATUS_BAD_GATEWAY;
    res.status(statusCode).json(result);
  } catch (err) {
    console.error('Send sale error:', err);
    res.status(HTTP_STATUS_INTERNAL_ERROR).json({
      success: false,
      message: 'Internal server error during sale send'
    });
  }
});

// ---------- machineInfo ----------

/**
 * Принудительное получение/сохранение паспорта автомата (machineInfo).
 */
app.post('/api/telemetry/machine-info/sync', async (req, res) => {
  try {
    const info = await telemetryCore.ensureMachineInfo();
    res.status(HTTP_STATUS_OK).json({
      success: true,
      message: 'Machine info synced successfully',
      machineInfo: info
    });
  } catch (err) {
    console.error('Machine info sync error:', err);
    res.status(HTTP_STATUS_INTERNAL_ERROR).json({
      success: false,
      message: 'Internal server error during machine info sync'
    });
  }
});

// ========================
// Запуск HTTP-сервера
// ========================

app.listen(HTTP_PORT, () => {
  console.log(`Telemetry API server is listening on port ${HTTP_PORT}`);
});
