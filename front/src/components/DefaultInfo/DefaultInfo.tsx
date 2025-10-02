import { FC, ReactNode } from 'react';
import styles from './DefaultInfo.module.scss';
import classNames from 'classnames';

/**
 * Свойства компонента DefaultInfo
 */
type DefaultInfoProps = {
  className?: string;
  children?: ReactNode;
};

/**
 * Универсальный компонент для использования на модалках информации
 *
 * @param className внешний класс для применения дополнительных стилей
 * @param children контент внутри информации
 */
const DefaultInfo: FC<DefaultInfoProps> = ({ className, children }) => {
  return <div className={classNames(styles.defaultInfo, className)}>{children}</div>;
};

export default DefaultInfo;
