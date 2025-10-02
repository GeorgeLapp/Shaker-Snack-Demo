import { FC, memo } from 'react';
import styles from './SegmentedBarLegend.module.scss';
import { SegmentedBarLegendProps } from './types';
import { SegmentedBarItem, SegmentedBarItemColors } from '../types';
import HorizontalContainer from '../../HorizontalContainer';
import { Text } from '@consta/uikit/Text';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

const getEllipseClassNameByStatus = (color: SegmentedBarItemColors) => {
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
 * Легенда графика SegmentedBar
 */
const SegmentedBarLegend: FC<SegmentedBarLegendProps> = ({ items }) => {
  const { t } = useTranslation();

  // render методы
  const renderLegendItem = ({ key, label, color }: SegmentedBarItem) => (
    <HorizontalContainer key={key} space="2xs" align="center">
      <div className={classNames(styles.ellipse, getEllipseClassNameByStatus(color))} />
      <Text size="m">{t(label)}</Text>
    </HorizontalContainer>
  );

  return (
    <HorizontalContainer
      className={styles.SegmentedBarLegend}
      space="l"
      justify="start"
      isAutoWidth
    >
      {items.map(renderLegendItem)}
    </HorizontalContainer>
  );
};

export default memo(SegmentedBarLegend);
