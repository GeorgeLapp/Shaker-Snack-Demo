/**
 * Цвета графика SegmentedBar
 */
export enum SegmentedBarItemColors {
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SYSTEM = 'SYSTEM',
}

/**
 * Элемент списка графика SegmentedBar
 */
export type SegmentedBarItem = {
  /**
   * Ключ
   */
  key: string;
  /**
   * Название
   */
  label: string;
  /**
   * Значение
   */
  value: number;
  /**
   * Цвет
   */
  color: SegmentedBarItemColors;
};

/**
 * Свойства компонента SegmentedBar
 */
export type SegmentedBarProps = {
  items: SegmentedBarItem[];
};
