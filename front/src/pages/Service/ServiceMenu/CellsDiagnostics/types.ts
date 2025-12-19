/**
 * Тип для табов в "Диагностике"
 */
export enum DiagnosticsEnum {
  /**
   * Ошибки
   */
  ERRORS = 'ERRORS',
  /**
   * Логи
   */
  LOGS = 'LOGS',
  /**
   * Информация
   */
  INFORMATION = 'INFORMATION',
  /**
   * Тест ячеек
   */
  CELLS_TEST = 'CELLS_TEST',
}

/**
 * Массив табов
 */
export type DiagnosticsTab = {
  /**
   * Заголовок
   */
  label: string;
  /**
   * Значение
   */
  value: DiagnosticsEnum;
};
