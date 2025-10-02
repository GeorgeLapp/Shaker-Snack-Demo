import { FC, useMemo, useRef, useState } from 'react';
import styles from './TableContextMenu.module.scss';
import { Button } from '@consta/uikit/Button';
import { ContextMenu } from '@consta/uikit/ContextMenu';
import classNames from 'classnames';
import { ContextMenuPropGetItemOnClick } from '@consta/uikit/ContextMenu';
import { useTranslation } from 'react-i18next';

type TableContextMenuProps = {
  size?: 's' | 'm' | 'l';
  className?: string;
  buttonIcon?: any;
  buttonDisabled?: boolean;
  buttonLabel?: string;
  items: TableContextMenuItem[];
  onItemClick: (item: TableContextMenuItem) => void;
};

export type TableContextMenuItem = {
  name: string;
  label: string;
  iconLeft?: any;
  group: number;
};

// тут кнопка + contextMenu
// кнопку лучше прокинуть через render метод или иметь стандартную
const TableContextMenu: FC<TableContextMenuProps> = ({
  size = 'm',
  className,
  buttonLabel,
  buttonDisabled = false,
  buttonIcon,
  items,
  onItemClick,
}) => {
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const ref = useRef(null);

  const translationItems = useMemo(
    () => items.map((item) => ({ ...item, label: t(item.label) })),
    [items, t],
  );

  // Обработчики
  const handleItemClick: ContextMenuPropGetItemOnClick<TableContextMenuItem> = (
    item: TableContextMenuItem,
  ) => {
    onItemClick(item);

    return undefined;
  };

  return (
    <>
      <Button
        ref={ref}
        disabled={buttonDisabled}
        label={buttonLabel}
        iconLeft={buttonIcon}
        onlyIcon={!buttonLabel}
        view="clear"
        size={size}
        onClick={() => setIsOpen(!isOpen)}
      />
      <ContextMenu
        anchorRef={ref}
        className={classNames(styles.tableContextMenu, className || '')}
        direction="downStartLeft"
        size="l"
        isOpen={isOpen}
        items={translationItems}
        onClickOutside={() => setIsOpen(false)}
        getItemLabel={(item) => item.label}
        getItemLeftIcon={(item) => (item.iconLeft || null) as any}
        getItemGroupId={(item) => item.group}
        getItemOnClick={handleItemClick}
      />
    </>
  );
};

export default TableContextMenu;
