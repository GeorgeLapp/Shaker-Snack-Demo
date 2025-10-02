import React, { RefObject, useLayoutEffect } from 'react';

/**
 * Хук для отслеживания изменений размеров элементов, переданных через рефы.
 *
 * @template ELEMENT - Тип элемента, который будет отслеживаться (HTMLElement или SVGGraphicsElement).
 * @template RETURN_TYPE - Тип возвращаемого значения от маппера.
 *
 * @param {Array<RefObject<ELEMENT>>} refs - Массив рефов на элементы, размеры которых необходимо отслеживать.
 * @param {(el: ELEMENT | null) => RETURN_TYPE} mapper - Функция, которая принимает элемент и возвращает значение,
 *        соответствующее размеру этого элемента, которое будет храняяся в состоянии.
 *
 * @returns {RETURN_TYPE[]} Массив значений, полученных из маппера для каждого отслеживаемого элемента.
 *
 * @example
 * const dimensions = useResizeObserved([ref1, ref2], el => el ? el.getBoundingClientRect() : null);
 */
export const useResizeObserved = <ELEMENT extends HTMLElement | SVGGraphicsElement, RETURN_TYPE>(
  refs: Array<RefObject<ELEMENT>>,
  mapper: (el: ELEMENT | null) => RETURN_TYPE,
): RETURN_TYPE[] => {
  const [dimensions, setDimensions] = React.useState<RETURN_TYPE[]>(() =>
    refs.map((ref) => mapper(ref.current)),
  );

  // Храним маппер в рефке, чтобы если его передадут инлайн-функцией, это не вызвало бесконечные перерендеры
  const mapperRef = React.useRef(mapper);
  useLayoutEffect(() => {
    mapperRef.current = mapper;
  }, [mapper]);

  useLayoutEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      setDimensions(refs.map((ref) => mapperRef.current(ref.current)));
    });

    for (const ref of refs) {
      ref.current && resizeObserver.observe(ref.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [refs]);

  return dimensions;
};
