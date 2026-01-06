// back/controllers/clientController.js

const { logEvent } = require('../logger');
const { vendProduct } = require('../services/vendingControllerClient');
const { processPayment } = require('../services/paymentDevice');
const PRICE_SCALE = 100;

// Support Node < 18, where global fetch may be missing
const fetchImpl =
  typeof fetch === 'function'
    ? fetch
    : (...args) =>
        import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));

// Базовый URL HTTP-сервиса телеметрии (telemetry-api.mjs)
// Например, если там HTTP_PORT = 3001, то: http://localhost:3001
// Базовый URL HTTP-API телеметрии (telemetry-api.mjs).
// По умолчанию совпадает с HTTP_PORT из telemetry-config.mjs (3002).
const TELEMETRY_API_BASE_URL =
  process.env.TELEMETRY_API_BASE_URL || 'http://localhost:3002';

/**
 * Небольшой helper для запросов к телеметрии.
 * Бросает осмысленные ошибки с корректным statusCode.
 * @param {string} path - относительный путь, например "/api/matrix"
 * @returns {Promise<any>}
 */
async function telemetryFetchJson(path) {
  const url = `${TELEMETRY_API_BASE_URL}${path}`;

  // На всякий случай проверим наличие fetch (Node 18+)
  let response;
  try {
    response = await fetchImpl(url, {
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

async function fetchCatalogFromTelemetry() {
  const catalog = await telemetryFetchJson('/api/catalog');
  if (!Array.isArray(catalog)) {
    return [];
  }
  return catalog;
}

const toNumberOrNull = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const calcRowNumber = (rawRowNumber, cellNumber) => {
  const normalizedRow = toNumberOrNull(rawRowNumber);
  if (normalizedRow !== null) {
    return normalizedRow;
  }

  if (cellNumber !== null) {
    return Math.floor((cellNumber - 1) / 10) + 1;
  }

  return 0;
};

const normalizeImagePath = (rawPath) => {
  if (!rawPath) return '';
  const httpPattern = /^https?:\/\//i;
  if (httpPattern.test(rawPath)) {
    return rawPath;
  }
  const parts = String(rawPath).split(/[/\\]+/);
  return parts[parts.length - 1] || '';
};

const normalizeMatrixPayload = (matrixRows, catalogRows) => {
  const catalogMap = new Map();
  for (const product of catalogRows || []) {
    const productId =
      toNumberOrNull(product?.id) ??
      toNumberOrNull(product?.good_id) ??
      toNumberOrNull(product?.goodId);

    if (productId !== null) {
      catalogMap.set(productId, product);
    }
  }

  if (!Array.isArray(matrixRows)) {
    return [];
  }

  return matrixRows
    .filter((row) => row && row.enabled !== 0)
    .map((row) => {
      const cellNumber =
        toNumberOrNull(row?.cell_number) ?? toNumberOrNull(row?.cellNumber);
      const productId =
        toNumberOrNull(row?.good_id) ??
        toNumberOrNull(row?.goodId) ??
        toNumberOrNull(row?.id);
      const product = productId !== null ? catalogMap.get(productId) : null;

      const priceMinor =
        toNumberOrNull(row?.price_minor) ??
        toNumberOrNull(row?.priceMinor) ??
        toNumberOrNull(product?.price_minor) ??
        toNumberOrNull(product?.priceMinor);

      const explicitPrice = toNumberOrNull(row?.price);
      const price =
        explicitPrice !== null
          ? explicitPrice
          : priceMinor !== null
          ? priceMinor / PRICE_SCALE
          : 0;

      const imgCandidate =
        row?.imgPath ??
        row?.img_url ??
        row?.imgUrl ??
        row?.product_img ??
        row?.productImg ??
        product?.img_url ??
        product?.imgUrl;

      return {
        id: cellNumber ?? 0,
        productId: productId ?? null,
        cellNumber: cellNumber ?? 0,
        rowNumber: calcRowNumber(row?.row_number ?? row?.rowNumber, cellNumber),
        price,
        imgPath: normalizeImagePath(imgCandidate),
        brandName: product?.brand_name ?? product?.brandName ?? '',
        productName:
          row?.product_name ?? row?.productName ?? product?.taste ?? '',
        description: product?.description ?? row?.description ?? '',
        calories: toNumberOrNull(product?.calories ?? row?.calories),
        proteins: toNumberOrNull(product?.proteins ?? row?.proteins),
        fats: toNumberOrNull(product?.fats ?? row?.fats),
        carbohydrates: toNumberOrNull(
          product?.carbohydrates ?? row?.carbohydrates,
        ),
      };
    })
    .filter((item) => item.cellNumber);
};


/**
 * Возвращает матрицу продуктов для фронта.
 * Теперь берём её не из локальной БД, а из модуля телеметрии.
 */
const getProductMatrix = async () => {
  const [matrix, catalog] = await Promise.all([
    fetchProductMatrixFromTelemetry(),
    fetchCatalogFromTelemetry().catch(() => []),
  ]);

  const normalized = normalizeMatrixPayload(matrix, catalog);
  logEvent('client.getProductMatrix', {
    totalItems: normalized.length,
  });

  return normalized;
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
  const [matrix, catalog] = await Promise.all([
    fetchProductMatrixFromTelemetry(),
    fetchCatalogFromTelemetry().catch(() => []),
  ]);

  const product = normalizeMatrixPayload(matrix, catalog).find(
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

  try {
    await processPayment({
      cellNumber: Number(product.cellNumber),
      price: product.price,
      productId: product.productId ?? null,
    });
  } catch (error) {
    const statusCode =
      error?.statusCode && Number.isInteger(error.statusCode)
        ? error.statusCode
        : 402;
    const message = error?.message || 'Payment failed';

    logEvent('client.startSale.failed', {
      cellNumber: product.cellNumber,
      productId: product.productId ?? null,
      message,
      code: error?.code ?? null,
    });

    const wrappedError = new Error(message);
    wrappedError.statusCode = statusCode;
    wrappedError.code = error?.code;
    throw wrappedError;
  }

  logEvent('client.startSale.accepted', {
    cellNumber: product.cellNumber,
    productId: product.productId ?? null,
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
      productId: product.productId ?? null,
      controllerChannel: controllerResponse?.channel ?? null,
      controllerRawHex: controllerResponse?.rawHex ?? null,
    });

    return { success: true };
  } catch (error) {
    logEvent('client.issueProduct.failed', {
      cellNumber: product.cellNumber,
      productId: product.productId ?? null,
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
