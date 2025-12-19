import { TabProps } from './TabBadge/types';

/**
 * Свойства компонента TabsBadge
 */
export type TabsBadgeProps = {
  /**
   * Флаг загрузки
   */
  isLoading?: boolean;
  /**
   * Заблокировано
   */
  disabled?: boolean;
  /**
   * Размер таба
   */
  size?: 'l' | 'm' | 's' | 'xs';
  /**
   * Список табов
   */
  tabsList: TabProps[];
};
