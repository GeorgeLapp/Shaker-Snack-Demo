/**
 * Свойства компонента WidgetCard
 */
export type WidgetCardProps = {
  /**
   * Внешний className
   */
  className?: string;
  /**
   * Количество строк для виджета
   */
  rowSpan: number;
  /**
   * Количество столбцов для виджета
   */
  columnSpan: number;
  /**
   * Высота виджета
   */
  rowHeight?: number;
  /**
   * Дочерние компоненты
   */
  children?: React.ReactNode;
};
