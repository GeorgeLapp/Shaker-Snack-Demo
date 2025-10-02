/**
 * Свойства компонента TablePageSettings
 */
export type TablePageSettingsProps = {
  /**
   * Длина массива элементов
   */
  fullLength: number;
  /**
   * Длина страниц
   */
  limit: number;
  /**
   * Номер страницы
   */
  page: number;
  /**
   * Обработчик нажатия на кнопку назад
   */
  onBackClick: () => void;
  /**
   * Обработчик нажатия на кнопку вперёд
   */
  onNextClick: () => void;
  /**
   * Изменение отображаемых на странице элементов
   *
   * @param limit количество отображаемых элементов
   */
  onLimitChange: (limit: number) => void;
};
