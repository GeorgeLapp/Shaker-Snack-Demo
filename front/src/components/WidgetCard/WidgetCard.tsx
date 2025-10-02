import { FC } from 'react';
import styles from './WidgetCard.module.scss';
import { WidgetCardProps } from './types';
import classNames from 'classnames';

/**
 * Карточка для виджета
 */
const WidgetCard: FC<WidgetCardProps> = (props) => {
  const { children, className, rowSpan, rowHeight, columnSpan } = props;

  return (
    <div
      className={classNames(styles.WidgetCard, className)}
      style={{
        gridColumn: `span ${columnSpan}`,
        gridRow: `span ${rowSpan}`,
        height: `${rowHeight}px`,
      }}
    >
      {children}
    </div>
  );
};

export default WidgetCard;
