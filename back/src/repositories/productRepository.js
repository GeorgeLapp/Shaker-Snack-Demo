const { getDb } = require('../db/connection');

const MINOR_UNITS_FACTOR = 100;

const toNumberOrUndefined = (value) =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? undefined : Number(value);

const normalizePrice = (minorUnits) => {
  const numeric = Number(minorUnits);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric / MINOR_UNITS_FACTOR;
};

const mapRowToProduct = (row) => {
  if (!row) {
    return null;
  }

  const cellNumber = Number(row.cellNumber);
  const rowNumber =
    row.rowNumber === null || row.rowNumber === undefined
      ? Math.ceil(cellNumber / 5)
      : Number(row.rowNumber);

  return {
    id: Number(row.cellNumber),
    rowNumber,
    cellNumber,
    price: normalizePrice(row.priceMinor),
    imgPath: row.imgUrl || '',
    brandName: row.brandName || '',
    productName: row.productName || '',
    description: row.description ?? undefined,
    calories: toNumberOrUndefined(row.calories),
    proteins: toNumberOrUndefined(row.proteins),
    fats: toNumberOrUndefined(row.fats),
    carbohydrates: toNumberOrUndefined(row.carbohydrates),
  };
};

const BASE_SELECT = `
  SELECT
    cfg.cell_number AS cellNumber,
    cfg.row_number AS rowNumber,
    cfg.price_minor AS priceMinor,
    prod.taste AS productName,
    prod.img_url AS imgUrl,
    prod.description AS description,
    prod.calories AS calories,
    prod.proteins AS proteins,
    prod.fats AS fats,
    prod.carbohydrates AS carbohydrates,
    brand.name AS brandName
  FROM matrix_cell_config AS cfg
  LEFT JOIN catalog_product AS prod ON prod.id = cfg.good_id
  LEFT JOIN catalog_brand AS brand ON brand.id = prod.brand_id
  WHERE cfg.enabled = 1
    AND cfg.good_id IS NOT NULL
    AND prod.id IS NOT NULL
`;

const getAllProducts = () => {
  const db = getDb();
  const statement = db.prepare(`${BASE_SELECT} ORDER BY cfg.row_number ASC, cfg.cell_number ASC`);
  return statement
    .all()
    .map(mapRowToProduct)
    .filter(Boolean);
};

const getProductByCellNumber = (cellNumber) => {
  const db = getDb();
  const statement = db.prepare(`${BASE_SELECT} AND cfg.cell_number = ? LIMIT 1`);
  return mapRowToProduct(statement.get(cellNumber));
};

module.exports = {
  getAllProducts,
  getProductByCellNumber,
};
