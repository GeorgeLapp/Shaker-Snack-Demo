/**
 * Дефолтный для телеметрии тип данных в combobox
 */
export type DefaultComboboxItem = {
  name: string | null;
  id: number;
};

/**
 * Статус ошибки поля ввода
 */
export type FieldErrorStatus = 'success' | 'alert' | 'warning' | undefined;

/**
 * Ошибка
 */
export type FieldError = {
  /**
   * Флаг, обозначающий, что есть ошибка в этом поле
   */
  isError: boolean;
  /**
   * Сообщение для поля
   */
  label: string | undefined;
  /**
   * Код ошибки для понимания в коде, какая ошибка произошла
   */
  errorKey?: string;
  /**
   * Статус поля
   */
  status: FieldErrorStatus;
  /**
   * Объект для локализации
   */
  optionsObj?: Record<string, any>;
};

/**
 * Страницы списка
 */
export type Pagination = {
  /**
   * Ограничение элементов на странице
   */
  limit: number;
  /**
   * Номер страницы
   */
  page: number;
  /**
   * Общее количество элементов
   */
  qty: number;
};

/**
 * Общее количество элементов
 */
export type PaginationQtyRes = {
  qty: number;
};
