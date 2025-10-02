import { SkeletonBrick } from '@consta/uikit/Skeleton';

import { BaseTableDataLoaderProps } from './types';

import { FC, useLayoutEffect, useRef, useState } from 'react';

import classNames from 'classnames';
import styles from './BaseTableDataLoader.module.scss';

const defaultRowHeight = 32;

/**
 * Загрузка данных базовой таблицы
 */
const BaseTableDataLoader: FC<BaseTableDataLoaderProps> = ({
  baseTableDataLoaderClassName = '',
  rowHeight = defaultRowHeight,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [loaderRowCount, setLoaderRowCount] = useState<number>(0);

  useLayoutEffect(() => {
    if (containerRef.current) {
      const containerHeight = containerRef.current.clientHeight;

      if (containerHeight > 0) {
        const count = Math.floor(containerHeight / (rowHeight + 8));

        setLoaderRowCount(count);
      }
    }
  }, [rowHeight]);

  return (
    <div
      ref={containerRef}
      className={classNames(styles.BaseTableDataLoader, baseTableDataLoaderClassName)}
    >
      {Array.from({ length: loaderRowCount }).map((_, index) => (
        <SkeletonBrick className={styles.loaderRow} key={index} height={rowHeight} />
      ))}
    </div>
  );
};

export default BaseTableDataLoader;
