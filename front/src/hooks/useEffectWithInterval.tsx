import { useEffect } from 'react';

/**
 * Кастомный хук для выполнения функции с интервалом.
 *
 * @param fetchFunction - Функция, которую нужно вызывать в заданный интервал.
 * @param dependencies - Массив зависимостей, при изменении которых будет выполнена функция.
 * @param interval - Интервал в миллисекундах (по умолчанию 60000).
 */
const useEffectWithInterval = (
  fetchFunction: () => void,
  dependencies: unknown[] = [],
  interval: number = 60000,
) => {
  useEffect(() => {
    const fetchData = () => {
      fetchFunction();
    };

    fetchData();

    const id = setInterval(fetchData, interval);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
};

export default useEffectWithInterval;
