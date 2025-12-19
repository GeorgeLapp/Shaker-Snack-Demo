import React, { FC, useState } from 'react';
import HorizontalContainer from '../../../../../components/HorizontalContainer';
import { Text } from '@consta/uikit/Text';
import { Button } from '@consta/uikit/Button';
import VerticalContainer from '../../../../../components/VerticalContainer';
import { GridCellProps } from '../../../../../components/GridTable/types';
import GridTable from '../../../../../components/GridTable';
import ContentCard from '../../../../../components/ContentCard';
import styles from './CellsControlPrices.module.scss';
import { useCellsControlPrices } from './useCellsControlPrices';
import {
  CellPrice,
  CellStatusEnum,
  ChangeCellsModeEnum,
} from '../../../../../types/serverInterface/serviceMenuDTO';
import ChangeCellsControlPrices from './ChangeCellsControlPrices';
import Error from '../../../../../components/Error';
import { IconPowerOff } from '../../../../../assets/icon/iconPowerOff';

const cellGap = 4;
const rowGap = 12;
const rowContentHeight = 222;
const cellWidth = 100;

/**
 * Управление ячейками: цены
 */
const CellsControlPrices: FC = () => {
  const { cellsPricesRows, isRejectCellsPrices } = useCellsControlPrices();

  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [changeMode, setChangeMode] = useState<ChangeCellsModeEnum | null>(null);
  const [isChangeCellsPricesOpen, setIsChangeCellsPricesOpen] = useState(false);
  const [cellRowPrice, setCellRowPrice] = useState<number | null>(null);

  // Обработчики
  const handleChangeCellsPricesRowOpen = (rowIndex: number) => {
    const row = cellsPricesRows[rowIndex] || [];

    let rowPrice: number | null = null;

    if (row.length > 0) {
      const firstPrice = row[0].price;
      const allSamePrice = row.every((cell) => cell.price === firstPrice);

      rowPrice = allSamePrice ? firstPrice : null;
    }

    setSelectedRow(rowIndex);
    setSelectedCell(null);
    setChangeMode(ChangeCellsModeEnum.ROW);
    setCellRowPrice(rowPrice);
    setIsChangeCellsPricesOpen(true);
  };

  const handleChangeCellPriceOpen = (cell: CellPrice) => {
    setSelectedCell(cell.id);
    setSelectedRow(null);
    setChangeMode(ChangeCellsModeEnum.CELL);
    setCellRowPrice(cell.price);
    setIsChangeCellsPricesOpen(true);
  };

  const handleChangeCellsPricesRowClose = () => {
    setSelectedRow(null);
    setSelectedCell(null);
    setChangeMode(null);
    setCellRowPrice(null);
    setIsChangeCellsPricesOpen(false);
  };

  // render методы
  const renderRowTitle = (index: number) => (
    <HorizontalContainer isAutoWidth isAutoSpace>
      <Text>{index} полка</Text>
      <Button
        label="Изменить цену всех ячеек в полке"
        size="s"
        view="clear"
        onClick={() => handleChangeCellsPricesRowOpen(index)}
      />
    </HorizontalContainer>
  );

  const renderCellNumber = (cell: CellPrice) => (
    <ContentCard className={styles.cellNumberCard}>
      {cell.status === CellStatusEnum.DISABLED ? (
        <IconPowerOff className={styles.iconPowerOff} />
      ) : (
        <Text size="s" weight="semibold" view="system">
          № {cell.id}
        </Text>
      )}
    </ContentCard>
  );

  const renderCellPlaceholder = (cell: CellPrice) => {
    const imgPath = cell.imgPath;

    return (
      <ContentCard className={styles.mainPartCard}>
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

  const renderCellPrice = (cell: CellPrice) => (
    <ContentCard className={styles.priceCellCard}>
      <Text size="s" weight="semibold" view="system">
        {cell.price} ₽
      </Text>
    </ContentCard>
  );

  const renderProductName = (cell: CellPrice) => (
    <Text
      size="xs"
      className={styles.productNameText}
    >{`${cell.brandName} ${cell.productName}`}</Text>
  );

  const renderCell = ({ data }: GridCellProps<CellPrice>) => (
    <VerticalContainer space="2xs" isAutoWidth onClick={() => handleChangeCellPriceOpen(data)}>
      <VerticalContainer space={0}>
        {renderCellNumber(data)}
        {renderCellPlaceholder(data)}
        {renderCellPrice(data)}
      </VerticalContainer>
      {renderProductName(data)}
    </VerticalContainer>
  );

  const renderPricesTable = () => (
    <GridTable
      rowContentClassName={styles.rowContentClassName}
      data={cellsPricesRows}
      cellComponent={renderCell}
      rowContentHeight={rowContentHeight}
      getRowTitle={renderRowTitle}
      rowGap={rowGap}
      cellGap={cellGap}
      cellWidth={cellWidth}
    />
  );

  const renderModal = () =>
    isChangeCellsPricesOpen &&
    changeMode && (
      <ChangeCellsControlPrices
        isOpen={isChangeCellsPricesOpen}
        cellRowPrice={cellRowPrice}
        row={selectedRow}
        cell={selectedCell}
        mode={changeMode}
        onClose={handleChangeCellsPricesRowClose}
      />
    );

  const renderError = () => <Error />;

  if (isRejectCellsPrices) return renderError();

  return (
    <VerticalContainer className={styles.CellsControlPrices}>
      {renderPricesTable()}
      {renderModal()}
    </VerticalContainer>
  );
};

export default CellsControlPrices;
