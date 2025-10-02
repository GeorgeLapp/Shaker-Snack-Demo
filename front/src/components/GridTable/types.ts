/**
 * Свойства, которые получает компонент ячейки.
 * Этот тип используется для определения пропсов,
 * которые будут переданы в `cellComponent`.
 */
export type GridCellProps<T> = {
  /**
   * данные конкретной ячейки (элемент из исходного массива `data`)
   */
  data: T;
  /**
   * индекс ряда, к которому принадлежит ячейка
   */
  rowIndex: number;
  /**
   * индекс ячейки внутри ряда
   */
  cellIndex: number;
};

/**
 * Свойства компонента GridTable
 */
export type GridTableProps<T> = {
  /**
   * Данные для отображения - массив массивов (ряды)
   */
  data: T[][];
  /**
   * Компонент для рендера ячейки
   */
  cellComponent: (props: GridCellProps<T>) => JSX.Element;
  /**
   * Высота заголовка ряда (в пикселях)
   */
  rowHeaderHeight?: number;
  /**
   * Высота основной части ряда (в пикселях)
   */
  rowContentHeight?: number;
  /**
   * Функция для генерации заголовка ряда
   */
  getRowTitle?: (rowIndex: number, rowData?: T[]) => JSX.Element;
  /**
   * Отступы между рядами (в пикселях)
   */
  rowGap?: number;
  /**
   * Отступы между ячейками (в пикселях)
   */
  cellGap?: number;
  /**
   * Показывать ли заголовки рядов
   */
  showRowHeaders?: boolean;
};
