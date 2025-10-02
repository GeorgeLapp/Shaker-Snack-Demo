import { ReactNode } from 'react';

/**
 * Свойства компонента DefaultModalMobileWrapper
 */
export type DefaultModalWrapperProps = {
  /**
   * Флаг открытия модального окна
   */
  isOpen?: boolean;
  /**
   * Заголовок модального окна
   */
  modalTitle?: string;
  /**
   * Контент модального окна
   */
  childrenModal?: ReactNode;
  /**
   * Рендер метод для кнопок управления в нижней части модального окна
   */
  actions?: () => ReactNode;
  /**
   * Обработчик закрытия модального окна
   */
  onClose?: () => void;
};
