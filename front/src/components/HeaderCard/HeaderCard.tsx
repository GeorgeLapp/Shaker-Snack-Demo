import { FC, ReactNode } from 'react';
import styles from './HeaderCard.module.scss';
import classNames from 'classnames';

type HeaderCardProps = {
  children?: ReactNode;
  className?: string;
};

/**
 * Компонент карточки для шапки страницы
 *
 * @param children содержимое карточки
 * @param className внешний className
 */
const HeaderCard: FC<HeaderCardProps> = ({ children, className }) => {
  return <div className={classNames(styles.headerCard, className)}>{children}</div>;
};

export default HeaderCard;
