import { withTooltip } from '@consta/uikit/withTooltip';
import { Text } from '@consta/uikit/Text';

/**
 * Компонент Text с тултипом
 */
const TextWithTooltip = withTooltip({ direction: 'downCenter' })(Text);

export default TextWithTooltip;
