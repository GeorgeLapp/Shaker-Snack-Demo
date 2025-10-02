import { SidebarPropSize } from '@consta/uikit/Sidebar';

/**
 * Свойства компонента DefaultSidebar
 */
export type DefaultSidebarProps = {
  /**
   * Внешний className
   */
  className?: string;
  /**
   * Флаг открытия всплывающего окна
   */
  isOpen?: boolean;
  /**
   * Заголовок всплывающего окна
   */
  modalTitle: string;
  // TODO: импортировать SidebarPropPosition
  /**
   * Расположение всплывающего окна
   */
  position?: 'right' | 'bottom' | 'left' | 'top';
  /**
   * Размер всплывающего окна
   */
  size?: SidebarPropSize;
  /**
   * Обработчик закрытия всплывающего окна
   */
  onClose?: () => void;
  /**
   * Рендер метод для кнопок управления в нижней части всплывающего окна
   */
  renderActions?: () => React.ReactNode;
  /**
   * Контент всплывающего окна
   */
  children?: React.ReactNode;
};
