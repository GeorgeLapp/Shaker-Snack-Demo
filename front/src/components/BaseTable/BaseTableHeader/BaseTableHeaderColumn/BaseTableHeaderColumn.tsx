import BaseTableSortButton from './BaseTableSortButton';
import BaseTableFilterButton from './BaseTableFilterButton';
import { Text } from '@consta/uikit/Text';

import { BaseTableHeaderColumnProps } from './types';

import classNames from 'classnames';
import styles from './BaseTableHeaderColumn.module.scss';

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
 * Шапка базовой таблицы
 */
const BaseTableHeaderColumn = <T,>({ column }: BaseTableHeaderColumnProps<T>) => {
  const {
    withSort,
    withFilter,
    activeFilter,

    title = null,
    justify = 'left',
    titleTextProp = { weight: 'semibold', size: 'm', view: 'secondary' },
    sortDirection = null,

    baseTableHeaderColumnClassName = '',
    baseTableHeaderColumnTitleClassName = '',
    baseTableSortButtonClassName,
    baseTableFilterButtonContextModalClassName,
    baseTableSortButtonContextModelClassName,
    baseTableFilterButtonClassName,
    baseTableFilterButtonActiveClassName,

    onSortClick = () => {},
    renderSortContextMenu,
    renderFilterContextMenu,
    onFilterClick,
  } = column;

  // render методы
  const renderSortButton = () => (
    <BaseTableSortButton
      baseTableSortButtonContextModelClassName={baseTableSortButtonContextModelClassName}
      baseTableSortButtonClassName={baseTableSortButtonClassName}
      sortDirection={sortDirection}
      withSort={withSort}
      onSortClick={onSortClick}
      renderSortContextMenu={renderSortContextMenu}
    />
  );

  const renderFilterButton = () => (
    <BaseTableFilterButton
      baseTableFilterButtonActiveClassName={baseTableFilterButtonActiveClassName}
      baseTableFilterButtonClassName={baseTableFilterButtonClassName}
      baseTableFilterButtonContextModalClassName={baseTableFilterButtonContextModalClassName}
      withFilter={withFilter}
      activeFilter={activeFilter}
      onFilterClick={onFilterClick}
      renderFilterContextMenu={renderFilterContextMenu}
    />
  );

  return (
    <div
      className={classNames(
        styles.BaseTableHeaderColumn,
        baseTableHeaderColumnClassName,
        getJustifyClassName(justify),
      )}
    >
      {typeof title === 'string' ? (
        <Text className={baseTableHeaderColumnTitleClassName} {...titleTextProp}>
          {title}
        </Text>
      ) : (
        <div className={baseTableHeaderColumnTitleClassName}>{title}</div>
      )}
      {renderSortButton()}
      {renderFilterButton()}
    </div>
  );
};

export default BaseTableHeaderColumn;
