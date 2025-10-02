import { FC } from 'react';
import { PercentBadgeProps } from './types';
import { IconArrowUpFilled } from '../../assets/icon/iconArrowUpFilled';
import { IconArrowDownFilled } from '../../assets/icon/iconArrowDownFilled';
import { Badge } from '@consta/uikit/Badge';

const getStatus = (percent: number, hasInversion?: boolean) => {
  const value = hasInversion ? -percent : percent;
  return value > 0 ? 'success' : value < 0 ? 'alert' : 'system';
};

/**
 * Компонент отображения процента в Badge
 */
const PercentBadge: FC<PercentBadgeProps> = ({ percent = 0, hasInversion }) => {
  return (
    <Badge
      status={getStatus(percent, hasInversion)}
      iconLeft={percent > 0 ? IconArrowUpFilled : percent < 0 ? IconArrowDownFilled : undefined}
      label={`${Math.round(Math.abs(percent))} %`}
    />
  );
};

export default PercentBadge;
