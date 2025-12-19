import { ReactNode } from 'react';

/**
 * Тип для пункта меню
 */
export type MenuItem = {
  /**
   * Заголовок
   */
  title: string;
  /**
   * Описание
   */
  description: string;
  /**
   * Иконка
   */
  icon: ReactNode;
  /**
   * Обработчик нажатия на карточку меню
   */
  onClick: () => void;
};
