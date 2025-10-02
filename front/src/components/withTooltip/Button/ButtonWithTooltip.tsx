import { withTooltip } from '@consta/uikit/withTooltip';
import { Button } from '@consta/uikit/Button';

/**
 * Компонент Button с тултипом
 */
const ButtonWithTooltip = withTooltip({ direction: 'downCenter' })(Button);

export default ButtonWithTooltip;
