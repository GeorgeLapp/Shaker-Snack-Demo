/**
 * Элемент матрицы продуктов
 */
export type ProductMatrixItem = {
  /**
   * id ячейки (из телеметрии)
   */
  id: number;
  /**
   * Номер ячейки
   */
  cellNumber: number;
  /**
   * Номер ряда
   */
  rowNumber: number;
  /**
   * стоимость товара в ячейке
   */
  price: number;
  /**
   * Ссылка на картинку
   */
  imgPath: string;
  /**
   * Название бренда
   */
  brandName: string;
  /**
   * Название продукта
   */
  productName: string;
  /**
   * Описание товара
   */
  description?: string;
  /**
   * Калории
   */
  calories?: number;
  /**
   * Белок
   */
  proteins?: number;
  /**
   * Жиры
   */
  fats?: number;
  /**
   * Углеводы
   */
  carbohydrates?: number;
};

/**
 * DTO матрицы продуктов
 */
export type ProductMatrixDTO = ProductMatrixItem[];

/**
 * Матрица продуктов для отображения
 */
export type ProductMatrixUi = ProductMatrixItem[][];
