/**
 * Свойство компонента AuthorizationModal
 */
export type AuthorizationModalProps = {
  /**
   * Флаг открытия модального окна
   */
  isOpen: boolean;
  /**
   * Обработчик закрытия модального окна
   */
  onClose: () => void;
};
