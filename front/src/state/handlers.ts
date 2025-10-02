import { InformerPropStatus } from '@consta/uikit/Informer';
import { generateUUID } from '../helpers/generateUUID';

/**
 * Тип уведомления
 */
export type NotificationType = {
  uuid: string;
  /**
   * Описание
   */
  text: string | undefined;
  /**
   * Статус
   */
  status: InformerPropStatus;
};

/**
 * Обработчик ошибок
 *
 * @param res ошибка
 */
export const errorHandler =
  (res: { error: { message?: string } }) =>
  (addNotification: (notification: NotificationType) => void) => {
    addNotification({
      uuid: generateUUID(),
      text: 'error.server.' + res.error?.message,
      status: 'alert',
    });
  };
