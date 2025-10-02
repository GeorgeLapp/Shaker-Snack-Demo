/**
 * Переданный размер TabsBadge
 */
type Size = 'xs' | 's' | 'm';

/**
 * Длина и ширина, которая будет передаваться в SkeletonBrick
 */
export type SizeDimensions = {
  /**
   * ClassName для SkeletonBrick
   */
  className: string;
  /**
   * Высота SkeletonBrick
   */
  height: number;
  /**
   * Ширина SkeletonBrick
   */
  width: number;
};

/**
 * Объект с размерами и классами для каждого размера
 */
const sizeDimensions: Record<Size, SizeDimensions> = {
  xs: { className: 'skeleton-xs', height: 24, width: 69 },
  s: { className: 'skeleton-s', height: 32, width: 78 },
  m: { className: 'skeleton-m', height: 40, width: 127 },
};

/**
 * Функция для получения длины, ширины и className по переданному size
 */
export const getSizeDimensions = (size: Size): SizeDimensions => sizeDimensions[size];
