import ContextModal from '../../../../ContextModal';

import { IconFunnelFilled } from '../../../../../assets/icon/iconFunnelFilled';

import { FC, useRef, useState } from 'react';

import { BaseTableFilterButtonProps } from './types';

import classNames from 'classnames';
import styles from './BaseTableFilterButton.module.scss';

/**
 * Кнопка фильтрации базовой таблицы
 */
const BaseTableFilterButton: FC<BaseTableFilterButtonProps> = ({
  baseTableFilterButtonContextModalClassName = '',
  baseTableFilterButtonActiveClassName = '',
  baseTableFilterButtonClassName = '',
  activeFilter,
  withFilter,
  onFilterClick,
  renderFilterContextMenu,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  const withCustomFilter = !!renderFilterContextMenu;

  // Обработчики
  const handleCustomFilterOpen = () => {
    setIsOpen(true);
  };

  const handleCustomFilterClose = () => {
    setIsOpen(false);
  };

  if (!withFilter) return null;

  return (
    <div
      ref={ref}
      className={classNames(
        styles.BaseTableFilterButton,
        baseTableFilterButtonClassName,
        activeFilter && baseTableFilterButtonActiveClassName,
      )}
      onClick={withCustomFilter ? handleCustomFilterOpen : onFilterClick}
    >
      <IconFunnelFilled size="s" />
      {withCustomFilter && (
        <ContextModal
          className={baseTableFilterButtonContextModalClassName}
          currentRef={ref}
          isOpen={isOpen}
          onClickOutside={handleCustomFilterClose}
        >
          {renderFilterContextMenu()}
        </ContextModal>
      )}
    </div>
  );
};

export default BaseTableFilterButton;
