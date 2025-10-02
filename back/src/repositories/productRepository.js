const { getDb } = require('../db/connection');

const mapRowToProduct = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    rowNumber: Number(row.rowNumber),
    cellNumber: Number(row.cellNumber),
    price: Number(row.price),
    imgPath: row.imgPath,
    brandName: row.brandName,
    productName: row.productName,
    description: row.description ?? undefined,
    calories: row.calories === null || row.calories === undefined ? undefined : Number(row.calories),
    proteins: row.proteins === null || row.proteins === undefined ? undefined : Number(row.proteins),
    fats: row.fats === null || row.fats === undefined ? undefined : Number(row.fats),
    carbohydrates:
      row.carbohydrates === null || row.carbohydrates === undefined ? undefined : Number(row.carbohydrates),
  };
};

const getAllProducts = () => {
  const db = getDb();
  const statement = db.prepare(
    'SELECT id, rowNumber, cellNumber, price, imgPath, brandName, productName, description, calories, proteins, fats, carbohydrates FROM product_details ORDER BY rowNumber ASC, cellNumber ASC',
  );

  return statement.all().map(mapRowToProduct);
};

const getProductByCellNumber = (cellNumber) => {
  const db = getDb();
  const statement = db.prepare(
    'SELECT id, rowNumber, cellNumber, price, imgPath, brandName, productName, description, calories, proteins, fats, carbohydrates FROM product_details WHERE cellNumber = ? LIMIT 1',
  );

  return mapRowToProduct(statement.get(cellNumber));
};

module.exports = {
  getAllProducts,
  getProductByCellNumber,
};
