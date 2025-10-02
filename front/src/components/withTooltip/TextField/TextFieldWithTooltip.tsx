import { withTooltip } from '@consta/uikit/withTooltip';
import { TextField } from '@consta/uikit/TextField';

/**
 * Компонент TextField с тултипом
 */
const TextFieldWithTooltip = withTooltip({ direction: 'downCenter' })(TextField);

export default TextFieldWithTooltip;
