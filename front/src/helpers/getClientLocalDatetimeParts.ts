/**
 * Тип, описывающий допустимые значения для даты
 * - Date: объект даты
 * - string: строковое представление даты (например, ISO)
 * - number: метка времени (timestamp)
 * - null или undefined: отсутствие значения
 */
export type NullableDateLike = Date | string | number | null | undefined;

/**
 * Преобразует входящее значение даты (или null/undefined) в локальные строковые части даты и времени
 *
 * @param dateInput Значение даты (Date, строка даты, timestamp, null или undefined)
 * @returns Объект с полями saleDay (дата в формате 'DD.MM.YYYY') и saleTime (время в формате 'HH:MM')
 * Если дата невалидна или отсутствует — возвращаются пустые строки.
 */
export const getClientLocalDatetimeParts = (dateInput: NullableDateLike) => {
  // Если входное значение отсутствует — возвращаем пустые строки
  if (!dateInput) {
    return { saleDay: '', saleTime: '' };
  }
  // Если значение — строка или число, создаём новый объект Date, иначе считаем что это уже Date
  const date =
    typeof dateInput === 'string' || typeof dateInput === 'number'
      ? new Date(dateInput)
      : dateInput; // если уже Date, используем её

  // Проверка на корректность созданной даты
  if (isNaN(date.getTime())) {
    return { saleDay: '', saleTime: '' };
  }

  // Вспомогательная функция для добавления ведущего нуля
  const pad = (n: number) => n.toString().padStart(2, '0');
  // Форматируем день продажи: 'DD.MM.YYYY'
  const saleDay = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  // Форматируем время продажи: 'HH:MM'
  const saleTime = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return { saleDay, saleTime };
};
