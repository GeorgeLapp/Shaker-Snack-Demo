import BaseTableDataRowCell from './BaseTableDataRowCell';

import { BaseTableDataRowProps } from './types';

import { useMemo } from 'react';

import classNames from 'classnames';
import styles from './BaseTableDataRow.module.scss';

const defaultOnRowClick = () => {};

/**
 * Строка базовой таблицы
 */
const BaseTableDataRow = <T,>({
  row,
  isSpaceBeforeRow,
  isRowSpaceIndexesHeader,
  columns,
  rowIndex,
  rowClassName = '',
  gridContainerClassName = '',
  onRowClick,
  getRowClassName = () => '',
  getHeaderClassName = () => <></>,
}: BaseTableDataRowProps<T>) => {
  const gridTemplateColumnsStyle = useMemo(
    () => columns.map(({ columnWidth = '1fr' }) => columnWidth).join(' '),
    [columns],
  );

  // Обработчики
  const handleCellClick =
    (column: (typeof columns)[number]) =>
    (e: React.MouseEvent<HTMLDivElement | HTMLSpanElement>) => {
      e.stopPropagation();
      column.onCellClick?.(row);
    };

  // render методы
  const renderCells = () =>
    columns.map((column, columnIndex) => (
      <BaseTableDataRowCell
        key={columnIndex}
        row={row}
        column={column}
        rowIndex={rowIndex}
        columnIndex={columnIndex}
        onClick={column.onCellClick ? handleCellClick(column) : undefined}
      />
    ));

  return (
    <>
      {isSpaceBeforeRow && <div className={styles.space} />}
      {isRowSpaceIndexesHeader && (
        <div className={styles.rowHeader}>{getHeaderClassName(row, rowIndex)}</div>
      )}
      <div
        className={classNames(
          styles.BaseTableDataRow,
          onRowClick && styles.pointer,
          gridContainerClassName,
          rowClassName,
          getRowClassName(row, rowIndex),
        )}
        style={{ gridTemplateColumns: gridTemplateColumnsStyle }}
        onClick={onRowClick ? () => onRowClick(row, rowIndex) : defaultOnRowClick}
      >
        {renderCells()}
      </div>
    </>
  );
};

export default BaseTableDataRow;
