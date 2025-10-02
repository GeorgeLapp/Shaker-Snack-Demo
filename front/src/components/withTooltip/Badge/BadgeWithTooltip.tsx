import { withTooltip } from '@consta/uikit/withTooltip';
import { Badge } from '@consta/uikit/Badge';

/**
 * Компонент Badge с тултипом
 */
const BadgeWithTooltip = withTooltip({ direction: 'downCenter' })(Badge);

export default BadgeWithTooltip;
