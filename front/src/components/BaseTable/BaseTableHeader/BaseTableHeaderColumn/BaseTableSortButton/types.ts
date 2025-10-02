import { SortDirection } from '../../../../../types/enums/sortDirection';

/**
 * Свойства компонента BaseTableSortButton
 */
export type BaseTableSortButtonProps = {
  /**
   * Флаг наличия сортировки
   */
  withSort?: boolean;
  /**
   * Внешний className контекстного модального окна сортировки
   */
  baseTableSortButtonContextModelClassName?: string;
  /**
   * Внешний className кнопки сортировки
   */
  baseTableSortButtonClassName?: string;
  /**
   * Направление сортировки
   */
  sortDirection?: SortDirection | null;
  /**
   * Обработчик нажатия на сортировку
   */
  onSortClick?: () => void;
  /**
   * render метод контекстного меню сортировки
   */
  renderSortContextMenu?: () => React.ReactNode;
};
