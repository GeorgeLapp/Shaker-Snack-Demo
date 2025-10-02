import { FC } from 'react';
import TabBadge from './TabBadge/TabBadge';
import HorizontalContainer from '../HorizontalContainer';
import { SkeletonBrick } from '@consta/uikit/Skeleton';
import { TabsBadgeProps } from './types';
import styles from './TabsBadge.module.scss';
import { getSizeDimensions } from './getSizeDimensions';

/**
 * Компонент табов
 */
const TabsBadge: FC<TabsBadgeProps> = ({ isLoading, disabled = false, size = 's', tabsList }) => {
  const { height, width, className } = getSizeDimensions(size);

  // render методы
  const renderTabBadges = () =>
    tabsList
      .filter((tab) => tab.isHidden !== true)
      .map((tab, index) => (
        <TabBadge key={tab.id || index} disabled={disabled} size={size} {...tab} />
      ));

  const renderSkeletonBadges = () =>
    tabsList.map((_, index) => (
      <SkeletonBrick key={index} width={width} height={height} className={styles[className]} />
    ));

  return (
    <HorizontalContainer
      className={styles.TabsBadge}
      space={size === 'xs' ? 'xs' : 's'}
      justify="start"
    >
      {!isLoading ? renderTabBadges() : renderSkeletonBadges()}
    </HorizontalContainer>
  );
};

export default TabsBadge;
