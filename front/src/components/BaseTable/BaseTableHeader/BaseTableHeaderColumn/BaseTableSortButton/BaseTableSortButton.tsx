import ContextModal from '../../../../ContextModal';
import { IconSortDown } from '../../../../../assets/icon/iconSortDown';
import { IconSortUp } from '../../../../../assets/icon/iconSortUp';
import { IconUnSort } from '../../../../../assets/icon/iconUnSort';

import { BaseTableSortButtonProps } from './types';
import { SortDirection } from '../../../../../types/enums/sortDirection';

import { FC, useRef, useState } from 'react';

import classNames from 'classnames';
import styles from './BaseTableSortButton.module.scss';

const getSortIcon = (sortDirection: SortDirection | null | undefined) => {
  switch (sortDirection) {
    case SortDirection.ASC:
      return <IconSortUp size="s" />;
    case SortDirection.DESC:
      return <IconSortDown size="s" />;
    default:
      return <IconUnSort size="s" />;
  }
};

/**
 * Кнопка сортировки базовой таблицы
 */
const BaseTableSortButton: FC<BaseTableSortButtonProps> = ({
  withSort,

  baseTableSortButtonContextModelClassName,
  baseTableSortButtonClassName,

  sortDirection,

  onSortClick,
  renderSortContextMenu,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  const withCustomSort = !!renderSortContextMenu;

  // Обработчики
  const handleCustomSortOpen = () => {
    setIsOpen(true);
  };

  const handleCustomSortClose = () => {
    setIsOpen(false);
  };

  if (!withSort) return null;

  return (
    <div
      ref={ref}
      className={classNames(styles.BaseTableSortButton, baseTableSortButtonClassName)}
      onClick={withCustomSort ? handleCustomSortOpen : onSortClick}
    >
      {getSortIcon(sortDirection)}
      {withCustomSort && (
        <ContextModal
          className={baseTableSortButtonContextModelClassName}
          currentRef={ref}
          isOpen={isOpen}
          onClickOutside={handleCustomSortClose}
        >
          {renderSortContextMenu()}
        </ContextModal>
      )}
    </div>
  );
};

export default BaseTableSortButton;
