const { fetchProductMatrix, findProductByCellNumber } = require('../services/productService');
const { logEvent } = require('../logger');

const getProductMatrix = () => {
  const matrix = fetchProductMatrix();

  logEvent('client.getProductMatrix', { totalItems: matrix.length });

  return matrix;
};

const startSale = (payload) => {
  logEvent('client.startSale', payload || {});

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

  logEvent('client.startSale.accepted', { cellNumber, productId: product.id });

  return { success: true };
};

const issueProduct = (payload) => {
  logEvent('client.issueProduct', payload || {});

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

  logEvent('client.issueProduct.accepted', { cellNumber, productId: product.id });

  return { success: true };
};

module.exports = {
  getProductMatrix,
  startSale,
  issueProduct,
};
