import styles from './TableHeader.module.scss';
import { Text } from '@consta/uikit/Text';
import {
  Column,
  ColumnCustomSort,
  ColumnDefaultSort,
  ColumnWithSortable,
  TableHeaderProps,
} from '../types';
import { Grid, GridItem } from '@consta/uikit/Grid';
import classNames from 'classnames';
import { Button } from '@consta/uikit/Button';
import { useRef, useState } from 'react';
import ContextModal from '../../ContextModal';
import { SortDirection } from '../../../types/enums/sortDirection';
import { IconSortUp } from '../../../assets/icon/iconSortUp';
import { IconSortDown } from '../../../assets/icon/iconSortDown';
import { IconHamburger } from '../../../assets/icon/iconHamburger';

/**
 * Элемент списка столбцов
 */
type ConvertListType<T extends Record<string, any>, K extends keyof T> = {
  /**
   * Ключ поля
   */
  key: K;
  /**
   * Заголовок
   */
  title: string;
  /**
   * Выравнивание
   */
  alignment: 'left' | 'right';
  /**
   * Наличие сортировки
   */
  sortable?: boolean;
  /**
   * Тип сортировки
   * false - нет сортировки
   * default - стандартная сортировка. Потребуется обработчик
   * custom - кастомная сортировка. Необходим render метод модалки сортировки
   */
  sortType?: false | 'default' | 'custom';
  /**
   * Не показывать столбец
   */
  isNoRender?: boolean;
  /**
   * Внешний className ячейки
   */
  className?: string;
  /**
   * Обработчик нажатия на сортировку
   * Только для sortType === 'default'
   */
  onSortClick?: () => void;
  /**
   * Рендер метод контекстного меню сортировки
   * Только для sortType === 'custom'
   */
  renderSort: () => React.ReactNode;
};

/**
 * Трансформация объекта столбцов в массив столбцов
 *
 * @param columns объект столбцов таблицы
 */
function convertRecordToArray<T extends Record<string, any>, K extends keyof T>(
  columns: Record<K, Column<T>>,
) {
  const columnsList: ConvertListType<T, K>[] = [];
  let count = 0;

  for (const key in columns) {
    if (columns.hasOwnProperty(key)) {
      if (!columns[key]?.multi) {
        const column = {
          key,
          title: columns[key].title,
          alignment: columns[key].alignment || 'left',
          sortable: columns[key].sortable,
          className: columns[key].className,
          isNoRender: columns[key].isNoRender,
          sortType: columns[key].sortable && (columns[key] as ColumnWithSortable).type,
          renderSort: () => {
            if (columns[key].sortable) {
              const column = columns[key] as ColumnWithSortable;

              if (column.type === 'custom') {
                return (column as ColumnCustomSort).renderSort();
              }
            }
          },
          onSortClick: () => {
            if (columns[key].sortable) {
              const column = columns[key] as ColumnWithSortable;

              if (column.type === 'default') {
                return (column as ColumnDefaultSort).onSortClick();
              }
            }
          },
        };
        columnsList.push(column);
        count = count + (columns[key]?.isNoRender ? 0 : 1);
      } else {
        const columnCount = columns[key].count as number;

        for (let i = 0; i < columnCount; i++) {
          const column = {
            key,
            title: columns[key].title + ' ' + (i + 1),
            alignment: columns[key].alignment || 'left',
            sortable: columns[key].sortable,
            isNoRender: columns[key].isNoRender,
            sortType: columns[key].sortable && (columns[key] as ColumnWithSortable).type,
            renderSort: () => {
              if (columns[key].sortable) {
                const column = columns[key] as ColumnWithSortable;

                if (column.type === 'custom') {
                  return (column as ColumnCustomSort).renderSort();
                }
              }
            },
            onSortClick: () => {
              if (columns[key].sortable) {
                const column = columns[key] as ColumnWithSortable;

                if (column.type === 'default') {
                  return (column as ColumnDefaultSort).onSortClick();
                }
              }
            },
          };
          columnsList.push(column);
        }

        count = count + (columns[key]?.isNoRender ? 0 : columnCount);
      }
    }
  }

  return { columnsList, count };
}

/**
 * Компонент шапки таблицы вида "карточки"
 *
 * @param columns колонки таблицы
 * @param sortOrder направление сортировки для столбцов
 * @param onSortClick обработчик изменения направления сортировки
 */
const TableHeader = <T extends Record<string, any>, K extends keyof T>({
  columns,
  sortOrder,
}: TableHeaderProps<T, K>) => {
  const { columnsList, count } = convertRecordToArray(columns);

  // render методы
  const renderDefaultSortButton = (
    data: ConvertListType<T, K>,
    sortOrder: Record<K, SortDirection | null>,
  ) => (
    <Button
      size="s"
      onlyIcon
      view="clear"
      iconLeft={() => {
        switch (sortOrder[data.key]) {
          case SortDirection.ASC:
            return <IconSortUp />;
          case SortDirection.DESC:
            return <IconSortDown />;
          default:
            return <IconHamburger />;
        }
      }}
      onClick={() => {
        data.sortable && (data as any).onSortClick(data.key as K);
      }}
    />
  );

  // Пришлось написать с большой буквы, что-бы получилось применить useRef внутри
  const RenderCustomSortButton = (
    data: ConvertListType<T, K>,
    sortOrder: Record<K, SortDirection | null>,
  ) => {
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const [isOpenContextModal, setIsOpenContextModal] = useState(false);

    // Обработчики
    const handleOpenContextModalClick = () => {
      setIsOpenContextModal(true);
    };

    const handleCloseContextModalClick = () => {
      setIsOpenContextModal(false);
    };

    // render методы
    const renderButton = () => (
      <Button
        className={classNames(isOpenContextModal && styles.selectedSortButton)}
        ref={buttonRef}
        onlyIcon
        size="s"
        view="clear"
        iconLeft={() => {
          switch (sortOrder[data.key]) {
            case SortDirection.ASC:
              return <IconSortUp />;
            case SortDirection.DESC:
              return <IconSortDown />;
            default:
              return <IconHamburger />;
          }
        }}
        onClick={handleOpenContextModalClick}
      />
    );

    const renderContextModal = () => (
      <ContextModal
        className={styles.sortContextMenu}
        currentRef={buttonRef}
        align="right"
        isOpen={isOpenContextModal}
        onClickOutside={handleCloseContextModalClick}
      >
        {data?.renderSort() || <>Нет render метода для кастомной сортировки</>}
      </ContextModal>
    );

    return (
      <>
        {renderButton()}
        {renderContextModal()}
      </>
    );
  };

  const renderSortButton = (data: ConvertListType<T, K>) => {
    if (data.sortable && sortOrder) {
      return data.sortType === 'custom'
        ? RenderCustomSortButton(data, sortOrder)
        : renderDefaultSortButton(data, sortOrder);
    }

    return null;
  };

  return (
    <div className={styles.TableHeader}>
      <Grid cols={count} colGap="4xl">
        {columnsList.map(
          (data) =>
            !data.isNoRender && (
              <GridItem
                key={String(data.title)}
                className={classNames(
                  styles.columnTitle,
                  data.alignment === 'right' && styles.cellRight,
                  data?.className,
                )}
              >
                <Text>{String(data.title)}</Text>
                {renderSortButton(data)}
              </GridItem>
            ),
        )}
      </Grid>
    </div>
  );
};

export default TableHeader;
