import { FC, useEffect } from 'react';
import { SaleWorkflowProps } from './types';
import { Modal } from '@consta/uikit/Modal';
import styles from './SaleWorkflow.module.scss';
import { IconClose } from '@consta/icons/IconClose';
import HorizontalContainer from '../../../../components/HorizontalContainer';
import { useAppDispatch, useAppSelector } from '../../../../app/hooks/store';
import { startSaleWorkflow } from '../../../../state/client/action';
import { selectSaleWorkflowStatus } from '../../../../state/client/selectors';
import { SaleWorkflowStatus } from '../../../../types/enums/SaleWorkflowStatus';
import { Text } from '@consta/uikit/Text';
import VerticalContainer from '../../../../components/VerticalContainer';
import { IconAwaitingCard } from '../../../../assets/icon/iconAwaitindCard';
import { IconDispensing } from '../../../../assets/icon/iconDispensing';
import { IconDispensed } from '../../../../assets/icon/iconDispensed';
import { IconPaymentFailed } from '../../../../assets/icon/iconPaymentFailed';
import classNames from 'classnames';

/**
 * Процесс оплаты и выдачи товара
 */
const SaleWorkflow: FC<SaleWorkflowProps> = ({ cell, onClose }) => {
  const dispatch = useAppDispatch();

  const workflowSaleStatus = useAppSelector(selectSaleWorkflowStatus());

  const isError = [SaleWorkflowStatus.PaymentFailed, SaleWorkflowStatus.DispenseFailed].includes(
    workflowSaleStatus,
  );

  const isSHowCloseButton = [
    SaleWorkflowStatus.AwaitingCard,
    SaleWorkflowStatus.Dispensed,
    SaleWorkflowStatus.PaymentFailed,
    SaleWorkflowStatus.DispenseFailed,
  ].includes(workflowSaleStatus);

  useEffect(() => {
    dispatch(startSaleWorkflow(cell));
  }, [dispatch, cell]);

  // render методы
  const renderModalHeader = () => (
    <HorizontalContainer className={styles.header} justify="end">
      {isSHowCloseButton && (
        <HorizontalContainer
          className={styles.buttonClose}
          align="center"
          justify="center"
          onClick={onClose}
        >
          <IconClose className={styles.iconClose} />
        </HorizontalContainer>
      )}
    </HorizontalContainer>
  );

  const renderContentWrapper = ({
    title,
    status,
    description,
    icon,
  }: {
    title: string;
    status: 'default' | 'success' | 'error';
    description: string;
    icon: React.ReactNode;
  }) => (
    <VerticalContainer className={styles.content} space="2xl" align="center">
      {icon}
      <Text
        className={
          status === 'error'
            ? styles.errorText
            : status === 'success'
              ? styles.successText
              : styles.defaultText
        }
        size="4xl"
        weight="semibold"
        align="center"
      >
        {title}
      </Text>
      <Text size="2xl" view="secondary" align="center">
        {description}
      </Text>
    </VerticalContainer>
  );

  const renderContent = () => {
    switch (workflowSaleStatus) {
      case SaleWorkflowStatus.AwaitingCard:
        return renderContentWrapper({
          title: 'Приложите карту к терминалу',
          status: 'default',
          description: 'Либо дождитесь появления QR-кода для оплаты СБП',
          icon: <IconAwaitingCard className={classNames(styles.icon, styles.defaultIcon)} />,
        });
      case SaleWorkflowStatus.Dispensing:
        return renderContentWrapper({
          title: 'Оплата прошла успешно',
          status: 'default',
          description: 'Дождитесь выдачи товара',
          icon: <IconDispensing className={classNames(styles.icon, styles.defaultIcon)} />,
        });
      case SaleWorkflowStatus.Dispensed:
        return renderContentWrapper({
          title: 'Товар успешно выдан',
          status: 'success',
          description: 'Спасибо за покупку!',
          icon: <IconDispensed className={classNames(styles.icon, styles.successIcon)} />,
        });
      case SaleWorkflowStatus.PaymentFailed:
        return renderContentWrapper({
          title: 'Ошибка оплаты',
          status: 'error',
          description: 'Попробуйте повторно или проверьте баланс',
          icon: <IconPaymentFailed className={classNames(styles.icon, styles.errorIcon)} />,
        });
      case SaleWorkflowStatus.DispenseFailed:
        return renderContentWrapper({
          title: 'Ошибка выдачи товара',
          status: 'error',
          description: 'Вредства скоро вернуться на карту',
          icon: <IconAwaitingCard className={classNames(styles.icon, styles.errorIcon)} />,
        });
    }
  };

  const renderAction = () => (
    <HorizontalContainer
      className={styles.action}
      align="center"
      justify="center"
      onClick={() => dispatch(startSaleWorkflow(cell))}
    >
      <Text className={styles.text} size="3xl">
        Попробовать ещё раз
      </Text>
    </HorizontalContainer>
  );

  return (
    <Modal className={styles.SaleWorkflow} isOpen>
      {renderModalHeader()}
      {renderContent()}
      {isError && renderAction()}
    </Modal>
  );
};

export default SaleWorkflow;
