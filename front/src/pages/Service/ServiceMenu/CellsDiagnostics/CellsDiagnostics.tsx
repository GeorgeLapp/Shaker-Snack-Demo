import React, { FC, useMemo, useState } from 'react';
import HorizontalContainer from '../../../../components/HorizontalContainer';
import { Button } from '@consta/uikit/Button';
import { Text } from '@consta/uikit/Text';
import { IconArrowRight } from '../../../../assets/icon/iconArrowRight';
import { IconArrowLeft } from '../../../../assets/icon/iconArrowLeft';
import { backToServiceMenuAction } from '../../../../state/serviceMenu/action';
import { useAppDispatch } from '../../../../app/hooks/store';
import { useNavigate } from 'react-router-dom';
import VerticalContainer from '../../../../components/VerticalContainer';
import styles from './CellsDiagnostics.module.scss';
import { DiagnosticsEnum } from './types';
import { TabProps } from '../../../../components/TabsBadge/TabBadge/types';
import { diagnosticsTabs } from './const';
import TabsBadge from '../../../../components/TabsBadge';
import CellsDiagnosticsTest from './CellsDiagnosticsTest';

/**
 *
 * Диагностика
 */
const CellsDiagnostics: FC = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const [selectedDiagnosticsTab, setSelectedDiagnosticsTab] = useState<DiagnosticsEnum>(
    DiagnosticsEnum.CELLS_TEST,
  );

  const tabsList = useMemo<TabProps[]>(
    () =>
      diagnosticsTabs.map((tab) => ({
        label: tab.label,
        isSelect: selectedDiagnosticsTab === tab.value,
        onClick: () => {},
      })),
    [selectedDiagnosticsTab],
  );

  // Обработчики
  function handleTabClick(value: DiagnosticsEnum) {
    dispatch(backToServiceMenuAction()).then(() => setSelectedDiagnosticsTab(value));
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
          Диагностика
        </Text>
      </HorizontalContainer>
    </HorizontalContainer>
  );

  const renderTabs = () => (
    <HorizontalContainer isAutoWidth isAutoSpace>
      <TabsBadge size="l" tabsList={tabsList} />
    </HorizontalContainer>
  );

  const renderMainPart = () => {
    switch (selectedDiagnosticsTab) {
      case DiagnosticsEnum.CELLS_TEST:
        return <CellsDiagnosticsTest />;
      default:
        return;
    }
  };

  return (
    <VerticalContainer space="l" className={styles.CellsDiagnostics}>
      {renderHeader()}
      {renderTabs()}
      {renderMainPart()}
    </VerticalContainer>
  );
};

export default CellsDiagnostics;
