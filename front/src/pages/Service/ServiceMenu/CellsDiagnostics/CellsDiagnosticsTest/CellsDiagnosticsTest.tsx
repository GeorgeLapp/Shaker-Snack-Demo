import React, { FC, useState } from 'react';
import VerticalContainer from '../../../../../components/VerticalContainer';
import styles from './CellsDiagnosticsTest.module.scss';
import ContentCard from '../../../../../components/ContentCard';
import { Text } from '@consta/uikit/Text';
import HorizontalContainer from '../../../../../components/HorizontalContainer';
import { Button } from '@consta/uikit/Button';
import { useAppDispatch } from '../../../../../app/hooks/store';
import {
  loadCalibrationAction,
  pollCalibrationAction,
  startCalibrationAction,
} from '../../../../../state/serviceMenu/action';
import {
  CellDiagnostics,
  CellDiagnosticsUI,
  CellStatusPollCalibrationEnum,
} from '../../../../../types/serverInterface/serviceMenuDTO';
import { GridCellProps } from '../../../../../components/GridTable/types';
import GridTable from '../../../../../components/GridTable';
import { useCellsDiagnosticsTest } from './useCellsDiagnosticsTest';
import { IconQuestion } from '../../../../../assets/icon/iconQuestion';
import classNames from 'classnames';
import { IconCheckFilled } from '../../../../../assets/icon/IconCheckFilled';
import { IconAlert } from '../../../../../assets/icon/iconAlert';

const cellGap = 7.2;
const rowGap = 12;
const rowContentHeight = 222;

/**
 * Диагностика: тест ячеек
 */
const CellsDiagnosticsTest: FC = () => {
  const dispatch = useAppDispatch();

  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [isCalibrationClicked, setIsCalibrationClicked] = useState(false);

  const { cellsTestRows, isRejectCellsTest } = useCellsDiagnosticsTest(isCalibrationClicked);

  console.log(cellsTestRows);

  // Вспомогательные функции
  const getAllCellIds = () => cellsTestRows.flatMap((row) => row.map((cell) => cell.id));

  const getStatusIcon = (loadingStatus: CellStatusPollCalibrationEnum) => {
    switch (loadingStatus) {
      case CellStatusPollCalibrationEnum.SUCCESS:
        return <IconCheckFilled size="m" className={styles.iconSuccess} />;
      case CellStatusPollCalibrationEnum.PENDING:
        return <IconQuestion size="m" className={styles.iconQuestion} />;
      default:
        return <IconAlert size="m" className={styles.iconAlert} />;
    }
  };

  // Обработчики
  const handleClickCalibration = () => {
    setIsCalibrationClicked(true);
    dispatch(loadCalibrationAction())
      .then(() => dispatch(startCalibrationAction()))
      .then(() => dispatch(pollCalibrationAction()));
  };

  /*const handleRunDiagnostics = () => {
    const cellsIds = selectedCells.length ? selectedCells : getAllCellIds();

    if (!cellsIds.length) return;

    const runDiagnostics: RunDiagnosticsDTO = {
      cellsIds,
    };

    dispatch(runDiagnosticsAction(runDiagnostics)).then(() =>
      dispatch(rerunDiagnosticsAction(runDiagnostics)),
    );
  };

  const handleToggleCell = (cellId: number) => {
    setSelectedCells((prev) =>
      prev.includes(cellId) ? prev.filter((id) => id !== cellId) : [...prev, cellId],
    );
  };

  const handleSelectRow = (rowIndex: number) => {
    const row = cellsTestRows[rowIndex] || [];
    const rowIds = row.map((cell) => cell.id);

    const isRowSelected = rowIds.every((id) => selectedCells.includes(id));

    setSelectedCells((prev) =>
      isRowSelected
        ? prev.filter((id) => !rowIds.includes(id))
        : Array.from(new Set([...prev, ...rowIds])),
    );
  };

  const handleSelectAll = () => {
    const allIds = getAllCellIds();
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedCells.includes(id));

    setSelectedCells(isAllSelected ? [] : allIds);
  };*/

  // render методы
  const renderActionsContentCard = () => (
    <ContentCard className={styles.actionsCard}>
      <VerticalContainer space="m" align="start" isAutoWidth>
        <Text size="xl" weight="medium">
          Действия
        </Text>
        <HorizontalContainer isAutoWidth isAutoSpace>
          <HorizontalContainer space="s">
            <Button disabled size="l" label="Тест" />
            <Button
              size="l"
              view="secondary"
              label="Диагностика"
              onClick={handleClickCalibration}
              disabled={!getAllCellIds().length}
            />
          </HorizontalContainer>
          {/*<Button size="l" view="clear" label="Выбрать все" onClick={handleSelectAll} />*/}
        </HorizontalContainer>
      </VerticalContainer>
    </ContentCard>
  );

  const renderRowTitle = (index: number) => (
    <HorizontalContainer isAutoWidth isAutoSpace>
      <Text>{index} полка</Text>
      {/*<Button
        label="Выбрать всю полку"
        size="s"
        view="clear"
        onClick={() => handleSelectRow(index)}
      />*/}
    </HorizontalContainer>
  );

  const renderCellNumber = (cell: CellDiagnostics, isSelected: boolean) => (
    <ContentCard className={classNames(styles.cellNumberCard, isSelected && styles.isSelected)}>
      <Text size="s" weight="semibold" view="system" className={styles.text}>
        № {cell.id}
      </Text>
    </ContentCard>
  );

  const renderCellPlaceholder = (cell: CellDiagnostics, isSelected: boolean) => {
    const imgPath = cell.imgPath;

    return (
      <ContentCard className={classNames(styles.mainPartCard, isSelected && styles.isSelected)}>
        <img
          src={imgPath}
          className={styles.img}
          alt="product image"
          loading="lazy"
          decoding="async"
        />
      </ContentCard>
    );
  };

  const renderCellDiagnostics = (cell: CellDiagnosticsUI, isSelected: boolean) => (
    <ContentCard className={classNames(styles.motorCellCard, isSelected && styles.isSelected)}>
      <HorizontalContainer>{getStatusIcon(cell.loadingStatus)}</HorizontalContainer>
    </ContentCard>
  );

  const renderCell = ({ data }: GridCellProps<CellDiagnosticsUI>) => {
    const isSelected = selectedCells.includes(data.id);

    return (
      <VerticalContainer space={0}>
        {renderCellNumber(data, isSelected)}
        {renderCellPlaceholder(data, isSelected)}
        {renderCellDiagnostics(data, isSelected)}
      </VerticalContainer>
    );
  };

  const renderPricesTable = () => (
    <GridTable
      rowContentClassName={styles.rowContentClassName}
      data={cellsTestRows}
      cellComponent={renderCell}
      rowContentHeight={rowContentHeight}
      getRowTitle={renderRowTitle}
      rowGap={rowGap}
      cellGap={cellGap}
      layout="fit"
    />
  );

  return (
    <VerticalContainer space="l" className={styles.CellsDiagnosticsTest} isAutoWidth>
      {renderActionsContentCard()}
      {renderPricesTable()}
    </VerticalContainer>
  );
};

export default CellsDiagnosticsTest;
