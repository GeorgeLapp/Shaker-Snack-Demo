import React, { FC } from 'react';
import ContentCard from '../../../../../components/ContentCard';
import VerticalContainer from '../../../../../components/VerticalContainer';
import HorizontalContainer from '../../../../../components/HorizontalContainer';
import { Button } from '@consta/uikit/Button';
import { Text } from '@consta/uikit/Text';
import GridTable from '../../../../../components/GridTable';
import { useCellsControlProducts } from './useCellsControlProducts';
import { GridCellProps } from '../../../../../components/GridTable/types';
import styles from './CellsControlProducts.module.scss';
import { setChangeCellsProducts } from '../../../../../state/serviceMenu/slice';
import { useNavigate } from 'react-router-dom';
import {
  CellPrice,
  CellStatusEnum,
  ChangeCellsModeEnum,
} from '../../../../../types/serverInterface/serviceMenuDTO';
import Error from '../../../../../components/Error';
import { useAppDispatch } from '../../../../../app/hooks/store';
import { IconPowerOff } from '../../../../../assets/icon/iconPowerOff';

const cellGap = 7.2;
const rowGap = 12;
const rowContentHeight = 222;
const cellWidth = 100;

/**
 * Управление ячейками: товары
 */
const CellsControlProducts: FC = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { cellsProductsRows, isRejectCellsProducts } = useCellsControlProducts();

  // Обработчики
  const handleChangeRowProductsOpen = (index: number) => {
    dispatch(
      setChangeCellsProducts({
        mode: ChangeCellsModeEnum.ROW,
        row: index,
        cell: null,
        productName: null,
      }),
    );

    navigate('/menu/cellControl/changeProducts');
  };

  const handleChangeCellProductOpen = (cell: CellPrice) => {
    dispatch(
      setChangeCellsProducts({
        mode: ChangeCellsModeEnum.CELL,
        row: null,
        cell: cell.id,
        productName: `${cell.brandName} ${cell.productName}`,
      }),
    );

    navigate('/menu/cellControl/changeProducts');
  };

  // render методы
  const renderRowTitle = (index: number) => (
    <HorizontalContainer isAutoWidth isAutoSpace>
      <Text>{index} полка</Text>
      <Button
        label="Изменить товары для всех ячеек в полке"
        size="s"
        view="clear"
        onClick={() => handleChangeRowProductsOpen(index)}
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

  const renderProductName = (cell: CellPrice) => (
    <Text
      size="xs"
      className={styles.productNameText}
    >{`${cell.brandName} ${cell.productName}`}</Text>
  );

  const renderCell = ({ data }: GridCellProps<CellPrice>) => (
    <VerticalContainer space="2xs" isAutoWidth onClick={() => handleChangeCellProductOpen(data)}>
      <VerticalContainer space={0}>
        {renderCellNumber(data)}
        {renderCellPlaceholder(data)}
      </VerticalContainer>
      {renderProductName(data)}
    </VerticalContainer>
  );

  const renderGridTable = () => (
    <GridTable
      rowContentClassName={styles.rowContentClassName}
      data={cellsProductsRows || []}
      cellComponent={renderCell}
      rowContentHeight={rowContentHeight}
      getRowTitle={renderRowTitle}
      rowGap={rowGap}
      cellGap={cellGap}
      cellWidth={cellWidth}
    />
  );

  const renderError = () => <Error />;

  if (isRejectCellsProducts) return renderError();

  return (
    <VerticalContainer space="l" className={styles.CellsControlProducts}>
      {renderGridTable()}
    </VerticalContainer>
  );
};

export default CellsControlProducts;
