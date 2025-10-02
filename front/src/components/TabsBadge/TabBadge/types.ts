import { ReactNode } from 'react';

/**
 * Описание таба
 */
export type TabProps = {
  /**
   * id таба
   */
  id?: number;
  /**
   * Содержимое модального окна
   */
  modalChildren?: (closeModal: () => void) => ReactNode;
  /**
   * Заголовок таба
   */
  label?: string;
  /**
   * Заголовок синего цвета
   */
  highlightedLabel?: string;
  /**
   * Внешний className для модального окна
   */
  classNameModal?: string;
  /**
   * Дополнительное значение таба
   */
  value?: string | number;
  /**
   * Флаг выбранного таба
   */
  isSelect?: boolean;
  /**
   * Флаг, указывающий, нужно ли скрывать таб
   */
  isHidden?: boolean;
  /**
   * Флаг для рендера выпадающего модального окна
   */
  isModalChildrenRender?: boolean;
  /**
   * Текст для бейджа сверху
   */
  badgeLabelText?: string | null;
  /**
   * Рендер метод иконки c левой стороны
   */
  renderLeftIcon?: () => ReactNode;
  /**
   * Рендер метод иконки c левой стороны
   */
  renderRightIcon?: () => ReactNode;
  /**
   * Обработчик нажатия
   */
  onClick?: () => void;
};

/**
 * Свойства компонента TabBadge
 */
export type TabBadgeProps = TabProps & {
  /**
   * Размер таба
   */
  size: 'm' | 's' | 'xs';
  /**
   * Выключенный таб
   */
  disabled: boolean;
};
