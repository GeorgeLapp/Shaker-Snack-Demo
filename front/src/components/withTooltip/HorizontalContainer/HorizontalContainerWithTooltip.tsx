import { withTooltip } from '@consta/uikit/withTooltip';
import HorizontalContainer from '../../HorizontalContainer';

/**
 * HorizontalContainer с tooltip
 */
const HorizontalContainerWithTooltip = withTooltip({ direction: 'downCenter' })(
  HorizontalContainer,
);

export default HorizontalContainerWithTooltip;
