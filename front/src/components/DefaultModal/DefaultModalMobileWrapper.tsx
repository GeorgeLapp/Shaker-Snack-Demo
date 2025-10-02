import styles from './DefaultModal.module.scss';
import HorizontalContainer from '../HorizontalContainer';
import { Text } from '@consta/uikit/Text';
import React, { FC } from 'react';
import { IconClose } from '@consta/icons/IconClose';
import { Button } from '@consta/uikit/Button';
import { DefaultModalWrapperProps } from './wrapperProps';
import { Modal } from '@consta/uikit/Modal';
import VerticalContainer from '../VerticalContainer';
/**
 * Модальное окно
 * Мобильная версия
 */
const DefaultModalMobileWrapper: FC<DefaultModalWrapperProps> = ({
  isOpen,
  modalTitle,
  childrenModal,
  actions,
  onClose,
}) => {
  // render методы
  const renderHeader = () => (
    <HorizontalContainer isAutoSpace>
      <Text size="xl" weight="semibold">
        {modalTitle}
      </Text>
      <Button onlyIcon view="clear" size="m" iconLeft={IconClose} onClick={onClose} />
    </HorizontalContainer>
  );

  const renderBody = () => <div className={styles.card}>{childrenModal}</div>;

  const renderFooter = () =>
    actions ? (
      <HorizontalContainer space="s" justify="end" className={styles.actions}>
        {actions()}
      </HorizontalContainer>
    ) : null;

  const renderContent = () => (
    <VerticalContainer space="l" className={styles.main}>
      <VerticalContainer space="l">
        {renderHeader()}
        {renderBody()}
      </VerticalContainer>
      {renderFooter()}
    </VerticalContainer>
  );

  return (
    <Modal isOpen={isOpen} className={styles.DefaultModalMobile}>
      {renderContent()}
    </Modal>
  );
};

export default DefaultModalMobileWrapper;
