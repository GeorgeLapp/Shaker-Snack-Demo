import React, { FC, ReactNode } from 'react';
import styles from './ContentCard.module.scss';
import classNames from 'classnames';

type ContentCardProps = {
  tabIndex?: number;
  /**
   * Контент внутри карточки
   */
  children: ReactNode;
  /**
   * ClassName контейнера карточки
   */
  className?: string;
  /**
   * Обработчик клика по карточке
   */
  onClick?: (() => void) | React.EventHandler<React.MouseEvent>;
  /**
   * Обработчик наведения мыши на карточку
   */
  onMouseEnter?: (() => void) | React.MouseEventHandler;
  /**
   * Обработчик, вызываемый при выходе мыши из области карточки
   */
  onMouseLeave?: (() => void) | React.MouseEventHandler;
};

// TODO: посмотреть как при фокусе onClick сделать на нажатие enter Маша
/**
 * Карточка для контента
 */
const ContentCard: FC<ContentCardProps> = ({
  tabIndex = -1,
  children,
  className,
  onClick = () => {
    null;
  },
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <div
      className={classNames(styles.contentCard, className)}
      tabIndex={tabIndex}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
};

export default ContentCard;
