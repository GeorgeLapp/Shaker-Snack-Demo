/**
 * Получение значения для поля ввода с типом number
 *
 * @param value значение
 */
export const getInputNumberValue = (value: number | undefined | null) =>
  value === 0 || value ? String(value) : null;

/**
 * Получить значение для поля ввода, большее, чем какое-либо число, и меньшее, чем какое-либо число, или null
 *
 * @param value значение
 * @param min минимальное значение
 * @param max максимальное значение
 */
export const getLimitedInputNumberOrNull = (
  value: number | string | null,
  min: number,
  max: number,
): string | null => {
  return value === null || value === ''
    ? null
    : isNaN(Number(value))
      ? null
      : String(Math.min(Math.max(Number(value), min), max));
};
