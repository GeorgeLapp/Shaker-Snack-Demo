/**
 * Свойства компонента BaseTableSettingsBarLeftSide
 */
export type BaseTableSettingsBarLeftSideProps = {
  /**
   * Внешний classname обёртки действий базовой таблицы
   */
  baseTableSettingsBarLeftSideClassName?: string;
  /**
   * Действия на левой части базовой таблицы
   */
  renderLeftSide?: () => React.ReactNode;
};
