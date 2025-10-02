import { Column } from '../../../types';

/**
 * Свойство компонента BaseTableDataRowCell
 */
export type BaseTableDataRowCellProps<T> = {
  /**
   * Индекс колонки
   */
  columnIndex: number;
  /**
   * Номер строки
   */
  rowIndex: number;
  /**
   * Строка таблицы
   */
  row: T;
  /**
   * Столбец
   */
  column: Column<T>;
  /**
   * Обработчик нажатия на ячейку
   *
   * @param e объект события, который содержит данные о нажатии мыши
   */
  onClick?: (e: React.MouseEvent<HTMLDivElement | HTMLSpanElement>) => void;
};
