import { FC, useMemo } from 'react';
import { CounterProps } from './types';
import styles from './Counter.module.scss';
import classNames from 'classnames';

/**
 * Счётчик
 */
const Counter: FC<CounterProps> = ({ size, status, label, className }) => {
  const sizeClassName = useMemo(() => {
    switch (size) {
      case 'm':
        return styles.Size_m;
      case 's':
        return styles.Size_s;
      default:
        return null;
    }
  }, [size]);

  const statusClassName = useMemo(() => {
    switch (status) {
      case 'success':
        return styles.success;
      case 'error':
        return styles.error;
      case 'system':
        return styles.success;
      case 'warning':
        return styles.warning;
      default:
        return styles.default;
    }
  }, [status]);

  return (
    <div className={classNames(styles.Counter, sizeClassName, statusClassName, className)}>
      <div className={styles.text}>{label}</div>
    </div>
  );
};

export default Counter;
