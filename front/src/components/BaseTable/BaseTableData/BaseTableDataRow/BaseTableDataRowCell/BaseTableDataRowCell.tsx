import { BaseTableDataRowCellProps } from './types';

import classNames from 'classnames';
import styles from './BaseTableDataRowCell.module.scss';
import { Text } from '@consta/uikit/Text';

const getJustifyClassName = (align: 'left' | 'center' | 'right') => {
  switch (align) {
    case 'left':
      return styles.left;
    case 'center':
      return styles.center;
    case 'right':
      return styles.right;
  }
};

/**
 * Ячейка базовой таблицы
 */
const BaseTableDataRowCell = <T,>({
  row,
  column,
  columnIndex,
  rowIndex,
  onClick,
}: BaseTableDataRowCellProps<T>) => {
  const { baseTableDataRowCellClassName = '', justify = 'left' } = column;

  return (
    <Text
      className={classNames(
        styles.BaseTableDataRowCell,
        baseTableDataRowCellClassName,
        getJustifyClassName(justify),
      )}
      onClick={onClick}
    >
      {column.renderCell(row, rowIndex)}
    </Text>
  );
};

export default BaseTableDataRowCell;
