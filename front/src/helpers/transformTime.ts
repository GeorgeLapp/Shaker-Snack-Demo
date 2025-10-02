/**
 * Трансформация даты в формат HH:MM
 *
 * @param date дата
 */
export const transformTime = (date: Date | null): string => {
  const hours = date && date.getHours().toString().padStart(2, '0');
  const minutes = date && date.getMinutes().toString().padStart(2, '0');

  return `${hours}:${minutes}`;
};
