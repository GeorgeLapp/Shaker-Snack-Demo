import BaseTableHeaderColumn from './BaseTableHeaderColumn';

import { BaseTableHeaderProps } from './types';

import { useMemo } from 'react';

import classNames from 'classnames';
import styles from './BaseTableHeader.module.scss';

/**
 * Шапка базовой таблицы без стилей
 */
const BaseTableHeader = <T,>({
  gridContainerClassName = '',
  baseTableHeaderClassName = '',
  columns,
}: BaseTableHeaderProps<T>) => {
  const gridTemplateColumnsStyle = useMemo(
    () => columns.map(({ columnWidth = '1fr' }) => columnWidth).join(' '),
    [columns],
  );

  // render методы
  const renderColumns = () =>
    columns.map((column, index) => <BaseTableHeaderColumn key={index} column={column} />);

  return (
    <div
      className={classNames(
        styles.BaseTableHeader,
        gridContainerClassName,
        baseTableHeaderClassName,
      )}
      style={{ gridTemplateColumns: gridTemplateColumnsStyle }}
    >
      {renderColumns()}
    </div>
  );
};

export default BaseTableHeader;
