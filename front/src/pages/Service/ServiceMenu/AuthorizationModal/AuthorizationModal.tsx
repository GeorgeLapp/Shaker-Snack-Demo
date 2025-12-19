import { FC, useMemo, useState } from 'react';
import { AuthorizationModalProps } from './types';
import DefaultModal from '../../../../components/DefaultModal';
import HorizontalContainer from '../../../../components/HorizontalContainer';
import { Button } from '@consta/uikit/Button';
import { useAppDispatch } from '../../../../app/hooks/store';
import { authSubmitPinAction } from '../../../../state/serviceMenu/action';
import { TextField } from '@consta/uikit/TextField';
import { Pin } from '../../../../types/serverInterface/serviceMenuDTO';
import { useNavigate } from 'react-router-dom';

/**
 * Модальное окно с авторизацией
 */
const AuthorizationModal: FC<AuthorizationModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const dispatch = useAppDispatch();

  const [pin, setPin] = useState<string | null>(null);

  const isSubmitDisabled = useMemo(() => !pin || pin.trim().length === 0, [pin]);

  // Обработчики
  const handleSubmitPin = () => {
    if (isSubmitDisabled) return;

    const newPin: Pin = {
      pin: pin!.trim(),
    };

    dispatch(authSubmitPinAction(newPin)).then(() => {
      navigate('/menu');
    });
  };

  const handleChangePin = (value: string | null) => {
    setPin(value);
  };

  // render методы
  const renderTextField = () => (
    <TextField
      value={pin}
      label="Пин"
      placeholder="Введите пин"
      width="full"
      size="m"
      id="password"
      type="password"
      onChange={handleChangePin}
    />
  );

  const renderActions = () => (
    <HorizontalContainer space="m">
      <Button size="m" view="clear" label="Отменить" onClick={onClose} />
      <Button
        size="m"
        view="primary"
        label="Войти"
        onClick={handleSubmitPin}
        disabled={isSubmitDisabled}
      />
    </HorizontalContainer>
  );

  return (
    <DefaultModal
      isOpen={isOpen}
      modalTitle="Авторизация по PIN"
      renderActions={renderActions}
      onClose={onClose}
    >
      {renderTextField()}
    </DefaultModal>
  );
};

export default AuthorizationModal;
