import { FC } from 'react';
import { DefaultSidebarProps } from './types';
import classNames from 'classnames';
import { Text } from '@consta/uikit/Text';
import { Button } from '@consta/uikit/Button';
import styles from './DefaultSidebar.module.scss';
import { Sidebar } from '@consta/uikit/Sidebar';
import { IconClose } from '@consta/icons/IconClose';

/**
 * Всплывающее окно с настроенными стилями
 */
const DefaultSidebar: FC<DefaultSidebarProps> = ({
  className,
  isOpen = true,
  modalTitle,
  position = 'right',
  onClose,
  renderActions,
  children,
  size,
}) => {
  // Обработчики
  const handleClose = onClose;

  return (
    <Sidebar
      className={classNames(styles.defaultSidebar, !size && styles.defaultSize, className)}
      position={position}
      isOpen={isOpen}
      size={size}
      onEsc={handleClose}
      onClickOutside={handleClose}
    >
      <div className={styles.header}>
        <Text size="2xl" weight="semibold">
          {modalTitle}
        </Text>
        <Button
          className={styles.closeButton}
          onlyIcon
          view="clear"
          size="m"
          iconLeft={IconClose as any}
          onClick={handleClose}
        />
      </div>
      <div className={styles.content}>{children}</div>

      {renderActions && <div className={styles.actions}>{renderActions()}</div>}
    </Sidebar>
  );
};

export default DefaultSidebar;
