import { withTooltip } from '@consta/uikit/withTooltip';
import { Combobox } from '@consta/uikit/Combobox';

/**
 * Компонент Combobox с тултипом
 */
const ComboboxWithTooltip = withTooltip({ direction: 'downCenter' })(Combobox);

export default ComboboxWithTooltip;
