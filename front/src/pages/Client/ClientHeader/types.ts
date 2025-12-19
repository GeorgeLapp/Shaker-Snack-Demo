import { ReactNode } from 'react';

/**
 * Свойства компонента ClientHeader
 */
export type ClientHeaderProps = {
  /**
   * Дополнительный рендер с левой стороны
   */
  renderLeftSide?: () => ReactNode;
  /**
   * Дополнительный рендер с правой стороны
   */
  renderRightSide?: () => ReactNode;
};
