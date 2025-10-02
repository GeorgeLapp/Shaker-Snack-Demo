/**
 * Свойства компонента Counter
 */
export type CounterProps = {
  /**
   * Размер badge Counter
   */
  size: 's' | 'm';
  /**
   * Внешний вид
   */
  status: 'success' | 'system' | 'error' | 'warning';
  /**
   * Текст внутри badge counter
   */
  label: string;
  /**
   * Внешний className
   */
  className?: string;
};
