// back/controllers/clientController.js

const { logEvent } = require('../logger');
const { vendProduct } = require('../services/vendingControllerClient');

const PAYMENT_DELAY_MS = Number(process.env.PAYMENT_DELAY_MS || 5000);

// Базовый URL HTTP-сервиса телеметрии (telemetry-api.mjs)
// Например, если там HTTP_PORT = 3001, то: http://localhost:3001
const TELEMETRY_API_BASE_URL =
  process.env.TELEMETRY_API_BASE_URL || 'http://localhost:3001';

/**
 * Небольшой helper для запросов к телеметрии.
 * Бросает осмысленные ошибки с корректным statusCode.
 * @param {string} path - относительный путь, например "/api/matrix"
 * @returns {Promise<any>}
 */
async function telemetryFetchJson(path) {
  const url = `${TELEMETRY_API_BASE_URL}${path}`;

  // На всякий случай проверим наличие fetch (Node 18+)
  if (typeof fetch !== 'function') {
    const error = new Error(
      'Global fetch is not available. Please use Node.js 18+ or polyfill fetch.',
    );
    error.statusCode = 500;
    throw error;
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (err) {
    const error = new Error(`Telemetry API request failed: ${err.message}`);
    error.statusCode = 502;
    throw error;
  }

  let bodyText = '';
  try {
    bodyText = await response.text();
  } catch {
    bodyText = '';
  }

  if (!response.ok) {
    let parsed;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      parsed = null;
    }

    const messageFromBody =
      parsed && typeof parsed.message === 'string' ? `: ${parsed.message}` : '';
    const error = new Error(
      `Telemetry API responded with ${response.status}${messageFromBody}`,
    );
    // Если телеметрия вернула понятный HTTP-код — пробрасываем его
    error.statusCode =
      response.status && Number.isInteger(response.status)
        ? response.status
        : 502;
    throw error;
  }

  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText);
  } catch (err) {
    const error = new Error(
      `Failed to parse Telemetry API JSON: ${err.message}`,
    );
    error.statusCode = 502;
    throw error;
  }
}

/**
 * Получение матрицы товаров из телеметрии (HTTP /api/matrix).
 * Ожидается, что telemetry-api.mjs отдаёт список ячеек
 * с полями вроде cellNumber, price, brandName, productName, imgPath и т.п.
 */
async function fetchProductMatrixFromTelemetry() {
  const matrix = await telemetryFetchJson('/api/matrix');

  if (!Array.isArray(matrix)) {
    const error = new Error('Telemetry /api/matrix must return an array');
    error.statusCode = 502;
    throw error;
  }

  return matrix;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Возвращает матрицу продуктов для фронта.
 * Теперь берём её не из локальной БД, а из модуля телеметрии.
 */
const getProductMatrix = async () => {
  const matrix = await fetchProductMatrixFromTelemetry();
  console.log(matrix);
  logEvent('client.getProductMatrix', {
    totalItems: Array.isArray(matrix) ? matrix.length : 0,
  });

  return matrix;
};

/**
 * Асинхронная валидация payload: проверяем cellNumber и ищем соответствующий
 * товар в матрице телеметрии.
 * @param {object} payload
 * @returns {Promise<object>} product
 */
const validatePayload = async (payload) => {
  if (!payload || typeof payload.cellNumber === 'undefined') {
    const error = new Error('cellNumber is required');
    error.statusCode = 400;
    throw error;
  }

  const { cellNumber } = payload;

  if (!Number.isInteger(cellNumber) || cellNumber < 1) {
    const error = new Error('cellNumber must be a positive integer');
    error.statusCode = 400;
    throw error;
  }

  // Берём актуальную матрицу из телеметрии и ищем товар по номеру ячейки
  const matrix = await fetchProductMatrixFromTelemetry();

  const product = matrix.find(
    (item) => Number(item.cellNumber) === Number(cellNumber),
  );

  if (!product) {
    const error = new Error('Product not found for the provided cellNumber');
    error.statusCode = 404;
    throw error;
  }

  return product;
};

/**
 * Старт продажи:
 *  - валидируем cellNumber через матрицу телеметрии,
 *  - имитируем задержку оплаты,
 *  - (как и раньше) искусственно отклоняем оплату для cellNumber === 1.
 */
const startSale = async (payload) => {
  logEvent('client.startSale', payload || {});

  const product = await validatePayload(payload);

  await delay(PAYMENT_DELAY_MS);

  if (Number(product.cellNumber) === 1) {
    const error = new Error('Оплата отклонена. Попробуйте выбрать другой товар.');
    error.statusCode = 402;
    logEvent('client.startSale.failed', {
      cellNumber: product.cellNumber,
      productId: product.id ?? null,
    });
    throw error;
  }

  logEvent('client.startSale.accepted', {
    cellNumber: product.cellNumber,
    productId: product.id ?? null,
  });

  return { success: true };
};

/**
 * Выдача товара:
 *  - валидируем cellNumber через матрицу телеметрии,
 *  - вызываем vendProduct у контроллера автомата.
 */
const issueProduct = async (payload) => {
  logEvent('client.issueProduct', payload || {});

  const product = await validatePayload(payload);

  try {
    const controllerResponse = await vendProduct({
      channel: Number(product.cellNumber),
    });

    logEvent('client.issueProduct.accepted', {
      cellNumber: product.cellNumber,
      productId: product.id ?? null,
      controllerChannel: controllerResponse?.channel ?? null,
      controllerRawHex: controllerResponse?.rawHex ?? null,
    });

    return { success: true };
  } catch (error) {
    logEvent('client.issueProduct.failed', {
      cellNumber: product.cellNumber,
      productId: product.id ?? null,
      message: error.message,
      code: error.code,
    });

    const wrappedError = new Error(error.message || 'Failed to issue product');
    wrappedError.statusCode =
      error.statusCode && Number.isInteger(error.statusCode)
        ? error.statusCode
        : 502;
    throw wrappedError;
  }
};

module.exports = {
  getProductMatrix,
  startSale,
  issueProduct,
};
