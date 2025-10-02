import { FC, ReactNode } from 'react';
import styles from './ChipsGroup.module.scss';

/**
 * Свойства компонента ChipsGroup
 */
type ChipsGroupProps = {
  /**
   * Контент внутри компонента
   */
  children?: ReactNode;
};

/**
 * Группа чипсов
 */
const ChipsGroup: FC<ChipsGroupProps> = ({ children }) => {
  return <div className={styles.chipsList}>{children}</div>;
};

export default ChipsGroup;
