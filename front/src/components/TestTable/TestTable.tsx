import BaseTable from '../BaseTable';

import { TestTableProps } from './types';

import { useMemo } from 'react';

import classNames from 'classnames';
import styles from './TestTable.module.scss';
import { Column } from '../BaseTable/types';

/**
 * Тестовая таблица
 */
const TestTable = <T,>({
  isLoading,

  tableContainerClassName = '',
  baseTableSettingsBarClassName = '',
  baseTableSettingsBarLeftSideClassName = '',
  baseTableSettingsBarRightSideClassName = '',
  baseTableHeaderClassName = '',
  gridContainerClassName = '',
  tableDataClassName = '',
  rowClassName = '',
  getRowClassName,

  rows,
  columns,
  renderLeftSide,
  renderRightSide,
}: TestTableProps<T> & { tableContainerClassName?: string }) => {
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
      })),
    [columns],
  );

  return (
    <div className={classNames(styles.tableContainer, tableContainerClassName)}>
      <BaseTable
        isLoading={isLoading}
        baseTableSettingsBarClassName={classNames(
          styles.baseTableSettingsBarClassName,
          baseTableSettingsBarClassName,
        )}
        baseTableSettingsBarLeftSideClassName={classNames(
          styles.baseTableSettingsBarActionsClassName,
          baseTableSettingsBarLeftSideClassName,
        )}
        baseTableSettingsBarRightSideClassName={classNames(
          styles.baseTableSettingsBarPaginationClassName,
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
        columns={formatedColumn}
        renderLeftSide={renderLeftSide}
        renderRightSide={renderRightSide}
      />
    </div>
  );
};

export default TestTable;
