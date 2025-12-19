import React, { FC } from 'react';
import { Text } from '@consta/uikit/Text';
import { Button } from '@consta/uikit/Button';
import { useAppDispatch } from '../../app/hooks/store';
import { retryAction } from '../../state/serviceMenu/action';

/**
 * Компонент с ошибкой
 */
const Error: FC = () => {
  const dispatch = useAppDispatch();

  const handleRetry = () => {
    dispatch(retryAction());
  };

  return (
    <>
      <Text size="6xl" align="center">
        Ошибка
      </Text>
      <Button label="Повторить" onClick={handleRetry} />
    </>
  );
};

export default Error;
