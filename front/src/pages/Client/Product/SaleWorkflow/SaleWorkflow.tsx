import { FC, ReactNode, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { IconLoading } from '../../../../assets/icon/iconLoading';

const SUCCESS_DESCRIPTION = 'Спасибо за покупку!';

const ERROR_PAYMENT_DESCRIPTION = 'Попробуйте повторно \n' + 'или проверьте баланс';

const ERROR_DISPENSE_DESCRIPTION = 'Средства скоро вернутся на карту';

/**
 * Модальные окна после нажатия кнопки оплатить
 */
const SaleWorkflow: FC<SaleWorkflowProps> = ({ cell, onClose }) => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const workflowSaleStatus = useAppSelector(selectSaleWorkflowStatus());

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

  useEffect(() => {
    dispatch(startSaleWorkflow(cell));

    return () => {
      dispatch(cancelSaleWorkflow());
    };
  }, [dispatch, cell]);

  // Обработчики
  const handleClose = () => {
    dispatch(cancelSaleWorkflow());
    onClose();

    if (workflowSaleStatus === SaleWorkflowStatus.Dispensed) {
      navigate('/');
    }
  };

  const retryPayment = () => {
    dispatch(startSaleWorkflow(cell));
  };

  // render методы
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
    title: string | ReactNode;
    status: 'default' | 'success' | 'error';
    description: string | ReactNode;
    icon: ReactNode;
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
          title: (
            <>
              Приложите карту
              <br />к терминалу
            </>
          ),
          status: 'default',
          description: (
            <>
              Либо дождитесь появления QR-кода
              <br />
              для оплаты СБП
            </>
          ),
          icon: <IconAwaitingCard className={classNames(styles.icon, styles.defaultIcon)} />,
        });
      case SaleWorkflowStatus.PaymentSuccess:
        return renderContentWrapper({
          title: 'Оплата прошла успешно',
          status: 'default',
          description: 'Дождитесь выдачи товара',
          icon: <IconLoading className={classNames(styles.icon, styles.defaultIcon)} />,
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
        <HorizontalContainer
          className={styles.action}
          align="center"
          justify="center"
          onClick={retryPayment}
        >
          <Text className={styles.text} size="3xl">
            Попробовать еще раз
          </Text>
        </HorizontalContainer>
      );
    }

    if (workflowSaleStatus === SaleWorkflowStatus.DispenseFailed) {
      return (
        <HorizontalContainer
          className={styles.action}
          align="center"
          justify="center"
          onClick={handleClose}
        >
          <Text className={styles.text} size="3xl">
            Попробовать еще раз
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
