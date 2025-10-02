import { FC, ReactNode, RefObject } from 'react';
import { Modal } from '@consta/uikit/Modal';

/**
 * Свойства компонента ContextModal
 */
type ContextModalProps = {
  // Список дополнять по необходимости
  /**
   * ref к какому элементу привязать контекстную модалку
   */
  currentRef: RefObject<HTMLDivElement | HTMLButtonElement>;
  /**
   * Флаг открытия
   */
  isOpen: boolean;
  /**
   * Содержимое модального окна
   */
  children?: ReactNode;
  /**
   * Внешний className
   */
  className?: string;
  /**
   * Положение
   */
  align?: 'left' | 'center' | 'right' | 'topLeft';
  /**
   * Закрытие модального окна по клику на него
   */
  onClose?: () => void;
  /**
   * Обработчик клика вне модального окна
   *
   * @param event событие мыши
   */
  onClickOutside?: (event: MouseEvent) => void;
};

/**
 * Контекстное модальное окно
 */
const ContextModal: FC<ContextModalProps> = ({
  currentRef,
  className,
  children,
  isOpen,
  align = 'left',
  onClickOutside,
  onClose,
}) => {
  const buttonRef = currentRef.current;
  if (!buttonRef) return null;

  const buttonRect = buttonRef.getBoundingClientRect();
  const buttonTop = buttonRect.top;
  const buttonBottom = buttonRect.bottom;
  const modalRight = window.innerWidth - buttonRect.right;
  const modalLeft = buttonRect.left;
  const buttonWidth = buttonRect.width;

  const getPosition = () => {
    switch (align) {
      case 'left':
        return {
          top: `${buttonBottom + 8}px`,
          left: `${modalLeft}px`,
        };
      case 'right':
        return {
          top: `${buttonBottom + 8}px`,
          right: `${modalRight}px`,
        };
      case 'center':
        return {
          top: `${buttonBottom + 8}px`,
          left: `${modalLeft}px`,
          width: `${buttonWidth}px`,
          padding: '0',
        };
      case 'topLeft':
        return {
          top: `${buttonTop}px`,
          left: `${modalLeft - buttonWidth + 104}px`,
        };
    }
  };

  return (
    <Modal
      className={className}
      hasOverlay={false}
      isOpen={isOpen}
      style={getPosition()}
      onClose={onClose}
      onClickOutside={onClickOutside}
    >
      {children}
    </Modal>
  );
};

export default ContextModal;
