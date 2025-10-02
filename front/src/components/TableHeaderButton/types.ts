import { ButtonProps } from '@consta/uikit/__internal__/src/components/EventInterceptor/propsHandlers/useButtonEventHandler';

/**
 * Свойства компонента TableHeaderButton
 */
export type TableHeaderButtonProps = ButtonProps & {
  /**
   * Текст описание кнопки для вывода в tooltip
   */
  tooltipText?: string;
};
