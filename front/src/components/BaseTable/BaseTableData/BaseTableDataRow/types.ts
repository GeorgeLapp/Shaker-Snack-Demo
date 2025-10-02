import { Column } from '../../types';

/**
 * Свойства компонента BaseTableDataRow
 */
export type BaseTableDataRowProps<T> = {
  /**
   * index строки
   */
  rowIndex: number;
  /**
   * Нужен ли промежуток между рядами
   */
  isSpaceBeforeRow?: boolean;
  /**
   * Нужен ли заголовок перед рядом
   */
  isRowSpaceIndexesHeader?: boolean;
  /**
   * Внешний className строки таблицы
   */
  rowClassName?: string;
  /**
   * Внешний className для grid контейнера таблицы
   */
  gridContainerClassName?: string;
  /**
   * Столбцы таблицы
   */
  columns: Column<T>[];
  /**
   * Строка таблицы
   */
  row: T;
  /**
   * Внешний className для одной конкретной строки
   */
  getRowClassName?: (row: T, index: number) => string;
  /**
   * Элемент для дополнительных заголовков
   */
  getHeaderClassName?: (row: T, index: number) => JSX.Element;
  /**
   * Обработчик нажатия на строку
   */
  onRowClick?: (row: T, index: number) => void;
};
