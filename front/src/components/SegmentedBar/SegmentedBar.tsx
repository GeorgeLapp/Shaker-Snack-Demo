import { FC, memo } from 'react';
import styles from './SegmentedBar.module.scss';
import { SegmentedBarItem, SegmentedBarItemColors, SegmentedBarProps } from './types';
import HorizontalContainer from '../HorizontalContainer';
import { Text } from '@consta/uikit/Text';
import classNames from 'classnames';

const getBarItemClassNameByStatus = (color: SegmentedBarItemColors) => {
  switch (color) {
    case SegmentedBarItemColors.SUCCESS:
      return styles.success;
    case SegmentedBarItemColors.WARNING:
      return styles.warning;
    case SegmentedBarItemColors.ERROR:
      return styles.error;
    case SegmentedBarItemColors.SYSTEM:
      return styles.system;
  }
};

/**
 * Горизонтальная составная шкала
 */
const SegmentedBar: FC<SegmentedBarProps> = ({ items }) => {
  const totalCount = items.reduce((acc, { value }) => {
    return acc + value;
  }, 0);

  // render методы
  const renderBarItem = ({ key, color, value }: SegmentedBarItem) => {
    const percent = totalCount ? ((value / totalCount) * 100).toFixed(2) : 0;

    return (
      <div
        key={key}
        style={{
          width: `${percent}%`,
        }}
        className={styles.barItem}
      >
        <HorizontalContainer space="2xs">
          <div className={styles.dashedLine} />
          <Text weight="semibold" size="l">
            {value}
          </Text>
        </HorizontalContainer>
        <div className={classNames(styles.statusBar, getBarItemClassNameByStatus(color))} />
      </div>
    );
  };

  return (
    <HorizontalContainer className={styles.SegmentedBar} isAutoWidth space="2xs">
      {items.map(renderBarItem)}
    </HorizontalContainer>
  );
};

export default memo(SegmentedBar);
