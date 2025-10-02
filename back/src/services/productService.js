const { getAllProducts, getProductByCellNumber } = require('../repositories/productRepository');

const fetchProductMatrix = () => getAllProducts();

const findProductByCellNumber = (cellNumber) => getProductByCellNumber(cellNumber);

module.exports = {
  fetchProductMatrix,
  findProductByCellNumber,
};
