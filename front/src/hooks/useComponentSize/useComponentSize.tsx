import { useMemo } from 'react';

import { useResizeObserved } from '../useResizeObserved';

import { getElementSize } from './getElementSize';
import { ComponentSize } from './types';

/**
 * Хук для получения размера компонента, на который ссылается переданный реф.
 *
 * @param {React.RefObject<HTMLElement | SVGGraphicsElement>} ref - Реф на элемент, размер которого нужно получить.
 *
 * @returns {ComponentSize} Объект, содержащий размеры компонента (ширину и высоту).
 *
 * @example
 * const size = useComponentSize(myRef);
 */
export function useComponentSize(
  ref: React.RefObject<HTMLElement | SVGGraphicsElement>,
): ComponentSize {
  const refs = useMemo(
    () => [ref],
    // Если реф начал указывать на другой элемент, нужно обновить подписки
    [ref.current],
  );
  return useResizeObserved(refs, getElementSize)[0];
}
