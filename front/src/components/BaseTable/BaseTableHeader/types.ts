import { Column } from '../types';

/**
 * Свойства компонента BaseTableHeader
 */
export type BaseTableHeaderProps<T> = {
  /**
   * Внешний className для grid контейнера таблицы
   */
  gridContainerClassName?: string;
  /**
   * Внешний className шапки таблицы
   */
  baseTableHeaderClassName?: string;
  /**
   * Столбцы таблицы
   */
  columns: Column<T>[];
};
