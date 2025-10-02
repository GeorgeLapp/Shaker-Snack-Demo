import { withTooltip } from '@consta/uikit/withTooltip';
import { Text } from '@consta/uikit/Text';

/**
 * Компонент div с тултипом
 */
const DivWithTooltip = withTooltip({ direction: 'downCenter' })(Text);

export default DivWithTooltip;
