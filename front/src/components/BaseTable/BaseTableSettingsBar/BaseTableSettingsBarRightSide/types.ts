/**
 * Свойства компонента BaseTableSettingsBarRightSide
 */
export type BaseTableSettingsBarRightSideProps = {
  /**
   * Внешний className настройки страниц таблицы
   */
  baseTableSettingsBarRightSideClassName?: string;
  /**
   * Действия на правой части базовой таблицы
   */
  renderRightSide?: () => React.ReactNode;
};
