import { FC } from 'react';
import { TableHeaderButtonProps } from './types';
import ButtonWithTooltip from '../withTooltip/Button';

/**
 * Кнопка для таблицы
 */
const TableHeaderButton: FC<TableHeaderButtonProps> = (props) => {
  return (
    <ButtonWithTooltip
      view="clear"
      {...props}
      tooltipProps={{
        content: props.tooltipText,
        mode: 'mouseover',
      }}
    />
  );
};

export default TableHeaderButton;
