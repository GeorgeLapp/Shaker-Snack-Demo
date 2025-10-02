/**
 * Свойства компонента DefaultModal
 */
export type DefaultModalProps = {
  /**
   * Внешний className
   */
  className?: string;
  /**
   * Внешние className для контейнера
   */
  modalContainerClassName?: string;
  /**
   * Флаг открытия модального окна
   */
  isOpen?: boolean;
  /**
   * Флаг необходимости header
   */
  withHeader?: boolean;
  /**
   * Заголовок модального окна
   */
  modalTitle?: string;
  /**
   * Расположение модального окна
   */
  position?: 'center' | 'top';
  /**
   * Обработчик закрытия модального окна
   */
  onClose?: () => void;
  /**
   * Рендер метод для кнопок управления в нижней части модального окна
   */
  renderActions?: () => React.ReactNode;
  /**
   * Рендер метод правой части шапки модального окна
   */
  renderHeaderRight?: () => React.ReactNode;
  /**
   * Контент модального окна
   */
  children?: React.ReactNode;
  isPrint?: boolean;
};
