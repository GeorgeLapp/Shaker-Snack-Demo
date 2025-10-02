import { BaseTableSettingsBarLeftSideProps } from './types';

import { FC } from 'react';

import classNames from 'classnames';
import styles from './BaseTableSettingsBarLeftSide.module.scss';

/**
 * Действия базовой таблицы
 */
const BaseTableSettingsBarLeftSide: FC<BaseTableSettingsBarLeftSideProps> = ({
  baseTableSettingsBarLeftSideClassName,

  renderLeftSide = () => <></>,
}) => {
  return (
    <div
      className={classNames(
        styles.BaseTableSettingsBarLeftSide,
        baseTableSettingsBarLeftSideClassName,
      )}
    >
      {renderLeftSide()}
    </div>
  );
};

export default BaseTableSettingsBarLeftSide;
