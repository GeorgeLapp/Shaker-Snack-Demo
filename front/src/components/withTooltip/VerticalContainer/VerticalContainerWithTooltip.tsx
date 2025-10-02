import { withTooltip } from '@consta/uikit/withTooltip';
import VerticalContainer from '../../VerticalContainer';

/**
 * Компонент VerticalContainer с тултипом
 */
const VerticalContainerWithTooltip = withTooltip({ direction: 'downCenter' })(VerticalContainer);

export default VerticalContainerWithTooltip;
