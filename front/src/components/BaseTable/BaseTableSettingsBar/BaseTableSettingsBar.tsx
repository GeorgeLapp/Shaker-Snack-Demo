import BaseTableSettingsBarRightSide from './BaseTableSettingsBarRightSide';
import BaseTableSettingsBarLeftSide from './BaseTableSettingsBarLeftSide';

import { BaseTableSettingsBarProps } from './types';

import { FC } from 'react';

import classNames from 'classnames';
import styles from './BaseTableSettingsBar.module.scss';

/**
 * Дополнительные настройки таблицы (пагинация, экспорт импорт данных)
 */
const BaseTableSettingsBar: FC<BaseTableSettingsBarProps> = ({
  baseTableSettingsBarClassName = '',
  baseTableSettingsBarLeftSideClassName,
  baseTableSettingsBarRightSideClassName,

  renderLeftSide,
  renderRightSide,
}) => {
  return (
    <div className={classNames(styles.BaseTableSettingsBar, baseTableSettingsBarClassName)}>
      <BaseTableSettingsBarLeftSide
        renderLeftSide={renderLeftSide}
        baseTableSettingsBarLeftSideClassName={baseTableSettingsBarLeftSideClassName}
      />
      <BaseTableSettingsBarRightSide
        renderRightSide={renderRightSide}
        baseTableSettingsBarRightSideClassName={baseTableSettingsBarRightSideClassName}
      />
    </div>
  );
};

export default BaseTableSettingsBar;
