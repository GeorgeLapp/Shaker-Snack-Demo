/**
 * Пропсы для компонента ClassicSlider
 */
export type ClassicSliderProps = {
  /**
   * Флаг блокировки
   */
  disabled: boolean;
  /**
   * Минимальное значение объема
   */
  min: number;
  /**
   * Максимальное значение объема
   */
  max: number;
  /**
   * Текущий объем
   */
  value: number;
  /**
   * Шаг для перемещения ползунка
   */
  step?: number;
  /**
   * Тип слайдера
   */
  isVertical?: boolean;
  /**
   * Флаг выбранной ячейки
   */
  isActiveStatus: boolean;
  /**
   * Флаг состояния hover на ячейке
   */
  isHoverStatus: boolean;
  /**
   * Флаг типа страницы
   */
  isEdit: boolean;
  /**
   * Для передачи внешних классов стилей
   */
  className?: string;
  /**
   * Обработчик нажатия на слайдер
   */
  onChange?: (newValue: number) => void;
};
