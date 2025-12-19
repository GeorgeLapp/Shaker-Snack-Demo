import React, { FC, useMemo } from 'react';
import HorizontalContainer from '../../../../components/HorizontalContainer';
import VerticalContainer from '../../../../components/VerticalContainer';
import styles from './CellsControl.module.scss';
import { Button } from '@consta/uikit/Button';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '../../../../assets/icon/iconArrowLeft';
import { Text } from '@consta/uikit/Text';
import { IconArrowRight } from '../../../../assets/icon/iconArrowRight';
import TabsBadge from '../../../../components/TabsBadge';
import { TabProps } from '../../../../components/TabsBadge/TabBadge/types';
import { CellControlEnum } from './types';
import CellsControlPrices from './CellsControlPrices';
import { backToServiceMenuAction } from '../../../../state/serviceMenu/action';
import { useAppDispatch, useAppSelector } from '../../../../app/hooks/store';
import { cellControlTabs } from './const';
import CellsControlConfig from './CellsControlConfig';
import CellsControlProducts from './CellsControlProducts';
import { selectCellControlTab } from '../../../../state/serviceMenu/selectors';
import { setSelectedCellControlTab } from '../../../../state/serviceMenu/slice';

/**
 * Управление ячейками
 */
const CellsControl: FC = () => {
  const navigate = useNavigate();

  const dispatch = useAppDispatch();

  const selectedCellControlTab = useAppSelector(selectCellControlTab());

  const tabsList = useMemo<TabProps[]>(
    () =>
      cellControlTabs.map((tab) => ({
        label: tab.label,
        isSelect: selectedCellControlTab === tab.value,
        onClick: () => handleTabClick(tab.value),
      })),
    [selectedCellControlTab],
  );

  // Обработчики
  function handleTabClick(value: CellControlEnum) {
    dispatch(backToServiceMenuAction()).then(() => dispatch(setSelectedCellControlTab(value)));
  }

  const handleBackClick = () => {
    dispatch(backToServiceMenuAction()).then(() => navigate('/menu'));
  };

  // render методы
  const renderHeader = () => (
    <HorizontalContainer space="l">
      <Button
        view="secondary"
        size="l"
        onlyIcon
        iconLeft={IconArrowLeft}
        onClick={handleBackClick}
      />
      <HorizontalContainer space="2xs">
        <Text size="3xl" weight="semibold" view="secondary">
          Настройки
        </Text>
        <IconArrowRight size="m" />
        <Text size="3xl" weight="semibold">
          Управление ячейками
        </Text>
      </HorizontalContainer>
    </HorizontalContainer>
  );

  const renderTabs = () => (
    <HorizontalContainer isAutoWidth isAutoSpace>
      <TabsBadge size="l" tabsList={tabsList} />
      {/*<Button size="l" onlyIcon iconLeft={IconRevert} view="ghost" />*/}
    </HorizontalContainer>
  );

  const renderMainPart = () => {
    switch (selectedCellControlTab) {
      case CellControlEnum.PRICES:
        return <CellsControlPrices />;
      case CellControlEnum.PRODUCTS:
        return <CellsControlProducts />;
      case CellControlEnum.CONFIG:
        return <CellsControlConfig />;
      default:
        return null;
    }
  };

  return (
    <VerticalContainer space="l" className={styles.CellsControl}>
      {renderHeader()}
      {renderTabs()}
      {renderMainPart()}
    </VerticalContainer>
  );
};

export default CellsControl;
