import React, { FC, useEffect } from 'react';
import { Modal } from '@consta/uikit/Modal';
import styles from './DefaultModal.module.scss';
import { Text } from '@consta/uikit/Text';
import { Button } from '@consta/uikit/Button';
import classNames from 'classnames';
import HorizontalContainer from '../HorizontalContainer';
import VerticalContainer from '../VerticalContainer';
import { IconClose } from '@consta/icons/IconClose';
import { DefaultModalProps } from './types';
import DefaultModalMobileWrapper from './DefaultModalMobileWrapper';

/**
 * Модальное окно
 */
const DefaultModal: FC<DefaultModalProps> = ({
  className,
  modalContainerClassName,
  isOpen = true,
  isPrint = false,
  withHeader = true,
  modalTitle,
  position = 'top',
  onClose,
  renderActions,
  renderHeaderRight,
  children,
}) => {

  const mobileActions = renderActions || renderHeaderRight;

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalBackground = document.body.style.backgroundColor;
      document.body.style.overflow = 'hidden';

      const theme = localStorage.getItem('theme');
      // var(--bg-split-tone)
      document.body.style.backgroundColor = '#0c1113d9';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.backgroundColor = originalBackground;
      };
    }
  }, [isOpen]);

  // Обработчики
  const handleClose = () => {
    onClose && onClose();
  };

  // render методы
  const renderHeader = () =>
    !isPrint && withHeader ? (
      <HorizontalContainer className={styles.header} align="center" isAutoSpace>
        <Text size="xl" weight="semibold">
          {modalTitle}
        </Text>
        <HorizontalContainer space="m">
          {renderHeaderRight && renderHeaderRight()}
        </HorizontalContainer>
      </HorizontalContainer>
    ) : null;

  const renderBody = () => <div className={styles.contentContainer}>{children}</div>;

  const renderFooter = () =>
    !isPrint && renderActions ? (
      <HorizontalContainer space="s" justify="end" isAutoWidth className={styles.actions}>
        {renderActions()}
      </HorizontalContainer>
    ) : null;

  const renderDesktopBody = () => (
    <HorizontalContainer space="5xl" className={styles.horizontalContainer} align="stretch">
      <VerticalContainer
        isAutoWidth
        justify="start"
        space="xl"
        className={classNames(styles.defaultModal, isPrint && styles.isPrint, className)}
      >
        {renderHeader()}
        {renderBody()}
        {renderFooter()}
      </VerticalContainer>

      <Button
        onlyIcon
        view="ghost"
        size="m"
        className={styles.closeButton}
        iconLeft={IconClose}
        onClick={handleClose}
      />
    </HorizontalContainer>
  );

  const renderDesktopModal = () => (
    <Modal
      position={position}
      isOpen={isOpen}
      onEsc={handleClose}
      className={classNames(styles.DefaultModal, modalContainerClassName)}
    >
      {renderDesktopBody()}
    </Modal>
  );

  return renderDesktopModal();
};

export default DefaultModal;
