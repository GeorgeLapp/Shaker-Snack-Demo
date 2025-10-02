import { FC, useEffect, useMemo } from 'react';
import { SaleWorkflowProps } from './types';
import { Modal } from '@consta/uikit/Modal';
import styles from './SaleWorkflow.module.scss';
import { IconClose } from '@consta/icons/IconClose';
import HorizontalContainer from '../../../../components/HorizontalContainer';
import { useAppDispatch, useAppSelector } from '../../../../app/hooks/store';
import { cancelSaleWorkflow, startSaleWorkflow } from '../../../../state/client/action';
import { selectSaleWorkflowStatus } from '../../../../state/client/selectors';
import { SaleWorkflowStatus } from '../../../../types/enums/SaleWorkflowStatus';
import { Text } from '@consta/uikit/Text';
import VerticalContainer from '../../../../components/VerticalContainer';
import { IconAwaitingCard } from '../../../../assets/icon/iconAwaitindCard';
import { IconDispensed } from '../../../../assets/icon/iconDispensed';
import { IconPaymentFailed } from '../../../../assets/icon/iconPaymentFailed';
import classNames from 'classnames';

const SUCCESS_DESCRIPTION = 'Возьмите лакомство и наслаждайтесь!';

const ERROR_PAYMENT_DESCRIPTION =
  'Списание средств не удалось. Проверьте карту или попробуйте выбрать другой товар.';

const ERROR_DISPENSE_DESCRIPTION =
  'Товар не был выдан. Обратитесь в сервисную службу или выберите другой продукт.';

const SaleWorkflow: FC<SaleWorkflowProps> = ({ cell, onClose }) => {
  const dispatch = useAppDispatch();
  const workflowSaleStatus = useAppSelector(selectSaleWorkflowStatus());

  useEffect(() => {
    dispatch(startSaleWorkflow(cell));

    return () => {
      dispatch(cancelSaleWorkflow());
    };
  }, [dispatch, cell]);

  const handleClose = () => {
    dispatch(cancelSaleWorkflow());
    onClose();
  };

  const retryPayment = () => {
    dispatch(startSaleWorkflow(cell));
  };

  const isError =
    workflowSaleStatus === SaleWorkflowStatus.PaymentFailed ||
    workflowSaleStatus === SaleWorkflowStatus.DispenseFailed;

  const isCloseAllowed = useMemo(
    () =>
      [
        SaleWorkflowStatus.AwaitingCard,
        SaleWorkflowStatus.PaymentSuccess,
        SaleWorkflowStatus.Dispensed,
        SaleWorkflowStatus.PaymentFailed,
        SaleWorkflowStatus.DispenseFailed,
      ].includes(workflowSaleStatus),
    [workflowSaleStatus],
  );

  const renderModalHeader = () => (
    <HorizontalContainer className={styles.header} justify="end">
      {isCloseAllowed && (
        <HorizontalContainer
          className={styles.buttonClose}
          align="center"
          justify="center"
          onClick={handleClose}
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
          description: 'Держите карту у считывателя, пока мы подтверждаем оплату.',
          icon: <IconAwaitingCard className={classNames(styles.icon, styles.defaultIcon)} />,
        });
      case SaleWorkflowStatus.PaymentSuccess:
        return renderContentWrapper({
          title: 'Оплата прошла успешно',
          status: 'success',
          description: 'Готовим ваш товар к выдаче. Это займёт всего несколько секунд.',
          icon: <IconDispensed className={classNames(styles.icon, styles.successIcon)} />,
        });
      case SaleWorkflowStatus.Dispensed:
        return renderContentWrapper({
          title: 'Товар успешно выдан',
          status: 'success',
          description: SUCCESS_DESCRIPTION,
          icon: <IconDispensed className={classNames(styles.icon, styles.successIcon)} />,
        });
      case SaleWorkflowStatus.PaymentFailed:
        return renderContentWrapper({
          title: 'Ошибка оплаты',
          status: 'error',
          description: ERROR_PAYMENT_DESCRIPTION,
          icon: <IconPaymentFailed className={classNames(styles.icon, styles.errorIcon)} />,
        });
      case SaleWorkflowStatus.DispenseFailed:
        return renderContentWrapper({
          title: 'Ошибка выдачи товара',
          status: 'error',
          description: ERROR_DISPENSE_DESCRIPTION,
          icon: <IconPaymentFailed className={classNames(styles.icon, styles.errorIcon)} />,
        });
      default:
        return null;
    }
  };

  const renderAction = () => {
    if (workflowSaleStatus === SaleWorkflowStatus.PaymentFailed) {
      return (
        <HorizontalContainer className={styles.action} align="center" justify="center" onClick={retryPayment}>
          <Text className={styles.text} size="3xl">
            Повторить оплату
          </Text>
        </HorizontalContainer>
      );
    }

    if (workflowSaleStatus === SaleWorkflowStatus.DispenseFailed) {
      return (
        <HorizontalContainer className={styles.action} align="center" justify="center" onClick={handleClose}>
          <Text className={styles.text} size="3xl">
            Повторить попытку
          </Text>
        </HorizontalContainer>
      );
    }

    return null;
  };

  return (
    <Modal className={styles.SaleWorkflow} isOpen>
      {renderModalHeader()}
      {renderContent()}
      {isError && renderAction()}
    </Modal>
  );
};

export default SaleWorkflow;
