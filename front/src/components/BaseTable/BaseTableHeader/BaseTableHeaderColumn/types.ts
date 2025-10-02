import { Column } from '../../types';

/**
 * Свойства компонента BaseTableHeaderColumn
 */
export type BaseTableHeaderColumnProps<T> = {
  /**
   * Столбец
   */
  column: Column<T>;
};
