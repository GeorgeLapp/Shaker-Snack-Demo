const { fetchProductMatrix, findProductByCellNumber } = require('../services/productService');
const { logEvent } = require('../logger');

const PAYMENT_DELAY_MS = 5000;
const DISPENSE_DELAY_MS = 7000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getProductMatrix = () => {
  const matrix = fetchProductMatrix();

  logEvent('client.getProductMatrix', { totalItems: matrix.length });

  return matrix;
};

const validatePayload = (payload) => {
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

  const product = findProductByCellNumber(cellNumber);

  if (!product) {
    const error = new Error('Product not found for the provided cellNumber');
    error.statusCode = 404;
    throw error;
  }

  return product;
};

const startSale = async (payload) => {
  logEvent('client.startSale', payload || {});

  const product = validatePayload(payload);

  await delay(PAYMENT_DELAY_MS);

  if (product.cellNumber === 1) {
    const error = new Error('Оплата отклонена. Попробуйте выбрать другой товар.');
    error.statusCode = 402;
    logEvent('client.startSale.failed', { cellNumber: product.cellNumber, productId: product.id });
    throw error;
  }

  logEvent('client.startSale.accepted', { cellNumber: product.cellNumber, productId: product.id });

  return { success: true };
};

const issueProduct = async (payload) => {
  logEvent('client.issueProduct', payload || {});

  const product = validatePayload(payload);

  await delay(DISPENSE_DELAY_MS);

  if (product.cellNumber === 2) {
    const error = new Error('Выдача товара не удалась. Обратитесь к обслуживанию автомата.');
    error.statusCode = 500;
    logEvent('client.issueProduct.failed', { cellNumber: product.cellNumber, productId: product.id });
    throw error;
  }

  logEvent('client.issueProduct.accepted', { cellNumber: product.cellNumber, productId: product.id });

  return { success: true };
};

module.exports = {
  getProductMatrix,
  startSale,
  issueProduct,
};
