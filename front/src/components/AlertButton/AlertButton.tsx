import { FC } from 'react';
import { Button } from '@consta/uikit/Button';
import styles from './AlertButton.module.scss';
import classNames from 'classnames';
import { ButtonProps } from '@consta/uikit/__internal__/src/components/EventInterceptor/propsHandlers/useButtonEventHandler';

const AlertButton: FC<ButtonProps & { className?: string }> = (props) => {
  return <Button {...props} className={classNames(styles.AlertButton, props.className)} />;
};

export default AlertButton;
