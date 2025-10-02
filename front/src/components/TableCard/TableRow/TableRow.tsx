import styles from './TableRow.module.scss';
import { Text } from '@consta/uikit/Text';
import { Column } from '../types';
import { useMemo } from 'react';
import { Grid, GridItem } from '@consta/uikit/Grid';
import classNames from 'classnames';

type TableRow<T extends Record<string, any>, K extends keyof T> = {
  rowClassName?: string;
  data: T;
  rowIndex: number;
  columns: Record<K, Column<T>>;
  onRowClick?: (data: T) => void;
};

/**
 * Компонент строки таблицы вида "карточки"
 */
const TableRow = <T extends Record<string, any>, K extends keyof T>({
  rowClassName,
  data,
  rowIndex,
  columns,
  onRowClick = () => null,
}: TableRow<T, K>) => {
  const { rowData, count } = useMemo(() => {
    const rowData: {
      cell: string | JSX.Element;
      alignment: 'left' | 'right';
      isNoRender?: boolean;
      className?: string;
    }[] = [];
    let count = 0;

    for (const key in columns) {
      if (columns.hasOwnProperty(key)) {
        if (!columns[key].multi) {
          rowData.push({
            cell: columns[key]?.renderCell?.(data, rowIndex) || (
              <Text>{columns[key].getItemLabel?.(data)}</Text>
            ),
            alignment: columns[key].alignment || 'left',
            isNoRender: columns[key].isNoRender,
            className: columns[key].className,
          });
          count = count + (columns[key]?.isNoRender ? 0 : 1);
        }

        if (columns[key].multi) {
          const multiColumn = columns[key];

          const columnCount = multiColumn.count || 0;
          count = count + (columns[key]?.isNoRender ? 0 : columnCount);
          for (let i = 0; i < columnCount; i++) {
            const renderMultiCell = multiColumn?.renderMultiCell;
            const cellData = data[key] as any[];

            renderMultiCell &&
              rowData.push({
                cell: renderMultiCell(cellData[i], rowIndex, i),
                alignment: columns[key].alignment || 'left',
                isNoRender: columns[key].isNoRender,
                className: columns[key].className,
              });
          }
        }
      }
    }

    return { rowData, count };
  }, [data, rowIndex, columns]);

  const handleRowClick = (data: T) => onRowClick(data);

  return (
    <div className={classNames(styles.TableRow, rowClassName)} onClick={() => handleRowClick(data)}>
      <Grid
        cols={count}
        colGap="m"
        yAlign="center"
        style={{ gridTemplateColumns: '3fr 1fr 3fr 1fr' }}
      >
        {rowData.map(
          ({ cell, alignment, className, isNoRender }, index) =>
            !isNoRender && (
              <GridItem
                key={index}
                className={classNames(alignment === 'right' && styles.cellRight, className)}
              >
                {cell}
              </GridItem>
            ),
        )}
      </Grid>
    </div>
  );
};

export default TableRow;
