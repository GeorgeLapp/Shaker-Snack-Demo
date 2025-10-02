import { BaseTableSettingsBarRightSideProps } from './types';

import { FC } from 'react';

import classNames from 'classnames';
import styles from './BaseTableSettingsBarRightSide.module.scss';

/**
 * Настройка страниц базовой таблицы
 */
const BaseTableSettingsBarRightSide: FC<BaseTableSettingsBarRightSideProps> = ({
  baseTableSettingsBarRightSideClassName = '',
  renderRightSide = () => <></>,
}) => {
  return (
    <div
      className={classNames(
        styles.BaseTableSettingsBarRightSide,
        baseTableSettingsBarRightSideClassName,
      )}
    >
      {renderRightSide()}
    </div>
  );
};

export default BaseTableSettingsBarRightSide;
