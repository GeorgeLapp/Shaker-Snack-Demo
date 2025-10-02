import BaseTableSettingsBar from './BaseTableSettingsBar';
import BaseTableHeader from './BaseTableHeader';
import BaseTableData from './BaseTableData';

import { BaseTableProps } from './types';

import classNames from 'classnames';
import styles from './BaseTable.module.scss';
import { useMemo } from 'react';

/**
 * Базовая таблица без стилей
 */
const BaseTable = <T,>({
  isLoading,
  withoutSettingsBar,
  withoutHeader,
  withoutData,

  rowClassName,
  getRowClassName,
  getHeaderClassName,
  tableDataClassName,
  baseTableSettingsBarClassName,
  baseTableSettingsBarLeftSideClassName,
  baseTableSettingsBarRightSideClassName,
  baseTableDataLoaderClassName,
  baseTableClassName,
  baseTableHeaderClassName,
  gridContainerClassName,

  rowHeight,

  rows,
  spaceIndexes,
  isRowSpaceIndexesHeader,
  columns,

  renderLeftSide,
  renderRightSide,
  onRowClick,
}: BaseTableProps<T>) => {
  const filteredColumns = useMemo(
    () => columns.filter(({ isNoRender }: { isNoRender?: boolean }) => !isNoRender),
    [columns],
  );

  // render методы
  const renderBaseTableSettingsBar = () =>
    !withoutSettingsBar && (
      <BaseTableSettingsBar
        renderLeftSide={renderLeftSide}
        renderRightSide={renderRightSide}
        baseTableSettingsBarClassName={baseTableSettingsBarClassName}
        baseTableSettingsBarLeftSideClassName={baseTableSettingsBarLeftSideClassName}
        baseTableSettingsBarRightSideClassName={baseTableSettingsBarRightSideClassName}
      />
    );

  const renderBaseTableHeader = () =>
    !withoutHeader && (
      <BaseTableHeader
        columns={filteredColumns}
        gridContainerClassName={gridContainerClassName}
        baseTableHeaderClassName={baseTableHeaderClassName}
      />
    );

  const renderBaseTableData = () =>
    !withoutData && (
      <BaseTableData
        rowHeight={rowHeight}
        baseTableDataLoaderClassName={baseTableDataLoaderClassName}
        isLoading={isLoading}
        tableDataClassName={tableDataClassName}
        rowClassName={rowClassName}
        getRowClassName={getRowClassName}
        getHeaderClassName={getHeaderClassName}
        gridContainerClassName={gridContainerClassName}
        rows={rows}
        spaceIndexes={spaceIndexes}
        isRowSpaceIndexesHeader={isRowSpaceIndexesHeader}
        columns={filteredColumns}
        onRowClick={onRowClick}
      />
    );

  return (
    <div
      className={classNames(styles.BaseTable, baseTableClassName, isLoading && styles.isLoading)}
    >
      {renderBaseTableSettingsBar()}
      {renderBaseTableHeader()}
      {renderBaseTableData()}
    </div>
  );
};

export default BaseTable;
