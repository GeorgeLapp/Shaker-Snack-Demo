/**
 * Преобразует строку даты в заданный формат "ДД.ММ.ГГГГ ЧЧ:ММ".
 *
 * Функция принимает строку даты в формате ISO 8601 (например, "2024-09-18T13:08:28Z")
 * и возвращает строку, представляющую дату и время в формате "ДД.ММ.ГГГГ ЧЧ:ММ".
 *
 * @param dateString - Строка даты в формате ISO 8601.
 * @returns Строка, представляющая дату и время в формате "ДД.ММ.ГГГГ ЧЧ:ММ".
 *
 * @example
 * // Пример использования функции
 * const transformedDate = transformDate("2024-09-18T13:08:28Z");
 * console.log(transformedDate); // Выведет: "18.09.2024 13:08"
 */
export const transformDate = (dateString: string): string => {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
};
