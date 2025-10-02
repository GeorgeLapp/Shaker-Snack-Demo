// Вспомогательный метод для получения часового пояса фронта (offset в часах относительно UTC)
export function getBrowserTimezoneOffset(): number {
  return -new Date().getTimezoneOffset() / 60;
}
