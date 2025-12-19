/**
 * Тип для табов в "Управлении ячейками"
 */
export enum CellControlEnum {
  /**
   * Остатки
   */
  STOCKS = 'STOCKS',
  /**
   * Глубина
   */
  DEPTH = 'DEPTH',
  /**
   * Цены
   */
  PRICES = 'PRICES',
  /**
   * Товары
   */
  PRODUCTS = 'PRODUCTS',
  /**
   * Конфиг
   */
  CONFIG = 'CONFIG',
}

/**
 * Массив табов
 */
export type CellControlTab = {
  /**
   * Заголовок
   */
  label: string;
  /**
   * Значение
   */
  value: CellControlEnum;
};
