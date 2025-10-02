import { GridTableProps } from './types';
import styles from './GridTable.module.scss';

/**
 * Таблица типа grid
 */
const GridTable = <T,>({
  data,
  cellComponent: CellComponent,
  rowHeaderHeight = 36,
  rowContentHeight = 120,
  getRowTitle,
  rowGap = 16,
  cellGap = 8,
  showRowHeaders = true,
}: GridTableProps<T>) => {
  return (
    <div className={styles.gridTable} style={{ gap: rowGap }}>
      {data.map((rowData, rowIndex) => (
        <div key={rowIndex} className={styles.gridRow}>
          {showRowHeaders && getRowTitle && (
            <div className={styles.rowHeader} style={{ height: rowHeaderHeight }}>
              {getRowTitle(rowIndex, rowData)}
            </div>
          )}

          <div
            className={styles.rowContent}
            style={{
              height: rowContentHeight,
              gridTemplateColumns: `repeat(${rowData.length}, 1fr)`,
              gap: cellGap,
            }}
          >
            {rowData.map((cellData, cellIndex) => (
              <div key={cellIndex} className={styles.gridCell}>
                <CellComponent data={cellData} rowIndex={rowIndex} cellIndex={cellIndex} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default GridTable;
