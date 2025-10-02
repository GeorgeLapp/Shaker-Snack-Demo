import React, { FC, useMemo, useState } from 'react';
import styles from './Notification.module.scss';
import { SnackBar } from '@consta/uikit/SnackBar';
import { IconAlert } from '../../assets/icon/iconAlert';
import { useTranslation } from 'react-i18next';

/**
 * Компонент списка уведомлений
 */
const NotificationsList: FC = () => {
  const { t } = useTranslation();

  // const notificationsList = useAppSelector(selectNotificationsList());
  const notificationsList = [] as {uuid: string, status: string, text: string }[]

  const [closedNotificationUuid, setClosedNotificationUuid] = useState<Record<string, boolean>>({});

  const formatedNotificationList = useMemo(
    () => notificationsList.filter(({ uuid }) => !closedNotificationUuid?.[uuid]),
    [notificationsList, closedNotificationUuid],
  );

  return (
    <div className={styles.list}>
      <SnackBar
        items={formatedNotificationList}
        getItemKey={({ uuid }) => uuid}
        getItemStatus={({ status }) => 'normal'}
        getItemMessage={({ text = '' }) => t(text)}
        getItemAutoClose={() => 5}
        getItemIcon={() => IconAlert as any}
        getItemShowProgress={() => 'line'}
        onItemAutoClose={({ uuid }) => {
          setClosedNotificationUuid((prevState) => ({ ...prevState, [uuid]: true }));
        }}
        onItemClose={({ uuid }) => {
          setClosedNotificationUuid((prevState) => ({ ...prevState, [uuid]: true }));
        }}
      />
    </div>
  );
};

export default NotificationsList;
