import BaseTableDataRow from './BaseTableDataRow';
import BaseTableDataLoader from './BaseTableDataLoader';

import { BaseTableDataProps } from './types';

import classNames from 'classnames';
import styles from './BaseTableData.module.scss';

/**
 * Данные базовой таблицы без стилей
 */
const BaseTableData = <T,>({
  isLoading,

  rowClassName,
  tableDataClassName = '',
  gridContainerClassName = '',
  baseTableDataLoaderClassName,

  rowHeight,

  rows,
  spaceIndexes = [],
  isRowSpaceIndexesHeader,
  columns,

  getRowClassName,
  getHeaderClassName,
  onRowClick,
}: BaseTableDataProps<T>) => {
  // render методы
  const renderRows = () =>
    rows.map((row, index) => (
      <BaseTableDataRow
        key={index}
        rowClassName={rowClassName}
        gridContainerClassName={gridContainerClassName}
        rowIndex={index}
        columns={columns}
        row={row}
        isSpaceBeforeRow={spaceIndexes.includes(index) && index !== 0}
        isRowSpaceIndexesHeader={isRowSpaceIndexesHeader && spaceIndexes.includes(index)}
        getRowClassName={getRowClassName}
        getHeaderClassName={getHeaderClassName}
        onRowClick={onRowClick}
      />
    ));

  if (isLoading)
    return (
      <BaseTableDataLoader
        rowHeight={rowHeight}
        baseTableDataLoaderClassName={baseTableDataLoaderClassName}
      />
    );

  return (
    <div className={classNames(styles.BaseTableData, gridContainerClassName, tableDataClassName)}>
      {renderRows()}
    </div>
  );
};

export default BaseTableData;
