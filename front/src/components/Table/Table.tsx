import BaseTable from '../BaseTable';

import { TableProps } from './types';

import { useMemo } from 'react';

import classNames from 'classnames';
import styles from './Table.module.scss';
import { Column } from '../BaseTable/types';

/**
 * Основная таблицы
 */
const Table = <T,>({
  isLoading,

  withoutSettingsBar,
  withoutHeader,
  withoutData,

  tableContainerClassName = '',
  baseTableSettingsBarClassName = '',
  baseTableSettingsBarLeftSideClassName = '',
  baseTableSettingsBarRightSideClassName = '',
  baseTableHeaderClassName = '',
  gridContainerClassName = '',
  tableDataClassName = '',

  rowHeight,
  rowClassName = '',
  getRowClassName,
  getHeaderClassName,
  baseTableDataLoaderClassName = '',
  baseTableClassName = '',

  rows,
  spaceIndexes,
  isRowSpaceIndexesHeader,
  columns,

  renderLeftSide,
  renderRightSide,
  onRowClick,
}: TableProps<T> & { tableContainerClassName?: string }) => {
  const formatedColumn = useMemo(
    () =>
      columns.map((column: Column<T>) => ({
        ...column,
        baseTableDataRowCellClassName: classNames(
          styles.baseTableDataRowCellClassName,
          column.baseTableDataRowCellClassName,
        ),
        baseTableHeaderColumnClassName: classNames(
          styles.baseTableHeaderColumnClassName,
          column.baseTableHeaderColumnClassName,
        ),
        baseTableHeaderColumnTitleClassName: classNames(
          styles.baseTableHeaderColumnTitleClassName,
          column.baseTableHeaderColumnTitleClassName,
        ),
        baseTableSortButtonClassName: classNames(
          styles.baseTableSortButtonClassName,
          column.baseTableSortButtonClassName,
        ),
        baseTableSortButtonContextModelClassName: classNames(
          styles.baseTableSortButtonContextModelClassName,
          column.baseTableSortButtonContextModelClassName,
        ),
        baseTableFilterButtonContextModalClassName: classNames(
          styles.baseTableFilterButtonContextModalClassName,
          column.baseTableFilterButtonContextModalClassName,
        ),
        baseTableFilterButtonClassName: classNames(
          styles.baseTableFilterButtonClassName,
          column.baseTableFilterButtonClassName,
        ),
        baseTableFilterButtonActiveClassName: classNames(
          styles.baseTableFilterButtonActiveClassName,
          column.baseTableFilterButtonActiveClassName,
        ),
      })),
    [columns],
  );

  return (
    <div
      className={classNames(
        styles.tableContainer,
        isLoading && styles.isLoading,
        tableContainerClassName,
      )}
    >
      <BaseTable
        getRowClassName={getRowClassName}
        getHeaderClassName={getHeaderClassName}
        rowHeight={rowHeight}
        isLoading={isLoading}
        withoutSettingsBar={withoutSettingsBar}
        withoutHeader={withoutHeader}
        withoutData={withoutData}
        baseTableDataLoaderClassName={classNames(
          styles.baseTableDataLoaderClassName,
          baseTableDataLoaderClassName,
        )}
        baseTableClassName={baseTableClassName}
        baseTableSettingsBarClassName={classNames(
          styles.baseTableSettingsBarClassName,
          baseTableSettingsBarClassName,
        )}
        baseTableSettingsBarLeftSideClassName={classNames(
          styles.baseTableSettingsBarLeftSideClassName,
          baseTableSettingsBarLeftSideClassName,
        )}
        baseTableSettingsBarRightSideClassName={classNames(
          styles.baseTableSettingsBarRightSideClassName,
          baseTableSettingsBarRightSideClassName,
        )}
        baseTableHeaderClassName={classNames(
          styles.baseTableHeaderClassName,
          baseTableHeaderClassName,
        )}
        gridContainerClassName={classNames(styles.gridContainerClassName, gridContainerClassName)}
        rowClassName={classNames(styles.rowClassName, rowClassName)}
        tableDataClassName={classNames(styles.tableDataClassName, tableDataClassName)}
        rows={rows}
        spaceIndexes={spaceIndexes}
        isRowSpaceIndexesHeader={isRowSpaceIndexesHeader}
        columns={formatedColumn}
        renderLeftSide={renderLeftSide}
        renderRightSide={renderRightSide}
        onRowClick={onRowClick}
      />
    </div>
  );
};

export default Table;
