import { withTooltip } from '@consta/uikit/withTooltip';
import { DatePicker } from '@consta/uikit/DatePicker';

/**
 * Компонент DatePicker с тултипом
 */
const DatePickerWithTooltip = withTooltip({ direction: 'downCenter' })(DatePicker);

export default DatePickerWithTooltip;
