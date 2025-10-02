import { withTooltip } from '@consta/uikit/withTooltip';
import ContentCard from '../../ContentCard';

/**
 * Компонент ContentCard с тултипом
 */
const ContentCardWithTooltip = withTooltip({ direction: 'upCenter' })(ContentCard);

export default ContentCardWithTooltip;
