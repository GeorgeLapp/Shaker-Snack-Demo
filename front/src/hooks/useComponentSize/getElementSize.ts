import { ComponentSize } from './types';

const defaultSize: ComponentSize = { width: 0, height: 0 };

/**
 * Получение размера элемента
 *
 * @param el элемент
 */
export const getElementSize = (el: HTMLElement | SVGGraphicsElement | null): ComponentSize => {
  if (!el) {
    return defaultSize;
  }

  const { width, height } = el.getBoundingClientRect();

  return {
    width,
    height,
  };
};
