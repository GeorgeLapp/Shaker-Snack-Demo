import TableHeader from './TableHeader';
import TableRow from './TableRow';
import styles from './TableCard.module.scss';
import { TableCardProps } from './types';
import { useMemo } from 'react';
import classNames from 'classnames';

/**
 * Компонент таблицы вида "карточки"
 *
 * @param rows данные таблицы
 * @param columns колонки таблицы
 * @param onRowClick обработчик клика по строке
 * @param className внешний className
 * @param sortOrder направление сортировки
 * @param withHeader наличие шапки таблицы
 */
const TableCard = <T extends Record<string, any>, K extends keyof T>({
  className,
  rowClassName,
  rows,
  columns,
  withHeader = true,
  onRowClick,
  sortOrder,
}: TableCardProps<T, K>) => {
  const tableRows = useMemo(() => {
    return rows.map((data, index) => ({ ...data, index }));
  }, [rows]);

  return (
    <div className={classNames(styles.TableCard, className)}>
      {withHeader && <TableHeader columns={columns} sortOrder={sortOrder} />}
      <div className={styles.TableContent}>
        {tableRows.map((data) => (
          <TableRow
            key={data.index}
            rowIndex={data.index}
            rowClassName={rowClassName}
            data={data}
            columns={columns}
            onRowClick={onRowClick}
          />
        ))}
      </div>
    </div>
  );
};

export default TableCard;
