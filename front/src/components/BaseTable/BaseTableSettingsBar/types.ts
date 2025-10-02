import { BaseTableSettingsBarLeftSideProps } from './BaseTableSettingsBarLeftSide/types';
import { BaseTableSettingsBarRightSideProps } from './BaseTableSettingsBarRightSide/types';

/**
 * Свойства настроек базовой таблицы
 */
export type BaseTableSettingsBarProps = BaseTableSettingsBarLeftSideProps &
  BaseTableSettingsBarRightSideProps & {
    /**
     * Внешний className настройки таблицы
     */
    baseTableSettingsBarClassName?: string;
  };
