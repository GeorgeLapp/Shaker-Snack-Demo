import { useEffect, useState } from 'react';

/**
 * Кастомный хук useDebounce
 *
 * Этот хук позволяет добавлять задержку к переданному значению.
 * Он полезен, когда нужно уменьшить частоту обновлений значения,
 * например, при вводе текста в поле поиска, чтобы избежать лишних запросов к серверу.
 *
 * @template T - Тип значения, которое будет задерживаться.
 *
 * @param {T} value - Текущее значение, которое нужно задерживать.
 * @param {number} delay - Период времени в миллисекундах, на который будет задерживаться значение.
 * @param {boolean} [isNoChange] - Флаг, указывающий, следует ли игнорировать изменение значения.
 *    Если true, значение не будет обновлено после задержки.
 *
 * @returns {T} - Значение, дебаунс которого произошло, т.е. обновленное с использованием задержки.
 *
 * Пример использования:
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 * Это обновит `debouncedSearchTerm` только через 500 миллисекунд после последнего изменения `searchTerm`.
 *
 * Замечание:
 * Используйте данный хук для оптимизации производительности при частых изменениях значений,
 * особенно когда обновление значения вызывает дорогостоящие операции, такие как HTTP-запросы.
 */
function useDebounce<T>(value: T, delay: number, isNoChange?: boolean): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      !isNoChange && setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay, isNoChange]);

  return debouncedValue;
}

export default useDebounce;
