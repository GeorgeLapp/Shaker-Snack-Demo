/**
 * Свойства компонента BaseTableFilterButton
 */
export type BaseTableFilterButtonProps = {
  /**
   * Флаг наличия фильтрации
   */
  withFilter?: boolean;
  /**
   * Активный фильтр
   */
  activeFilter?: boolean;
  /**
   * Внешний className кнопки фильтра
   */
  baseTableFilterButtonClassName?: string;
  /**
   * Внешний className кнопки фильтра в активном состоянии
   */
  baseTableFilterButtonActiveClassName?: string;
  /**
   * Внешний className контекстного модального окна фильтра
   */
  baseTableFilterButtonContextModalClassName?: string;
  /**
   * Обработчик нажатия на фильтр
   */
  onFilterClick?: () => void;
  /**
   * render метод контекстного меню фильтра
   */
  renderFilterContextMenu?: () => React.ReactNode;
};
