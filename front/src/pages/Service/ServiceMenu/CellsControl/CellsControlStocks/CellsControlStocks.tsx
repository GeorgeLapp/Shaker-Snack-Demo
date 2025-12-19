import React, { FC } from 'react';
import { useAppSelector } from '../../../../../app/hooks/store';
import { selectProductMatrix } from '../../../../../state/client/selectors';
import { ProductMatrixItem } from '../../../../../types/serverInterface/ProductMatrixDTO';
import ContentCard from '../../../../../components/ContentCard';
import { Text } from '@consta/uikit/Text';
import HorizontalContainer from '../../../../../components/HorizontalContainer';
import styles from '../CellsControl.module.scss';

const cellGap = 7.2;
const rowGap = 16;

/**
 * Управление ячейками: остатки
 */
const CellsControlStocks: FC = () => {
  const { state: productMatrix } = useAppSelector(selectProductMatrix());

  const sortedProductMatrix = productMatrix || [];

  const renderRowTitle = () => (
    <HorizontalContainer isAutoWidth isAutoSpace>
      <Text></Text>
    </HorizontalContainer>
  );

  const renderCellNumber = (data: ProductMatrixItem) => (
    <ContentCard className={styles.cellNumberCard}>
      <Text size="s" weight="semibold" view="system">
        № {data.cellNumber}
      </Text>
    </ContentCard>
  );

  /*const renderCellVolume = (cell: ProductMatrixItem) => {
    const status = getSnackCellStatus(cell);

    return (
      <ContentCard
        className={classNames(
          styles.amountCellCard,
          status === 'alert' && styles.alert,
          status === 'warning' && styles.warning,
        )}
      >
        <Text size="s" weight="semibold" view={status}>
          {cell.volume}/{cell.maxVolume}
        </Text>
      </ContentCard>
    );
  };

  const renderCellPlaceholder = (data: ProductMatrixItem) => {
    const product = data.productId ? productMap?.[data.productId] : null;

    if (!product) return null;

    const imgPath = product.imgPath;

    return (
      <ContentCard className={styles.mainPartCard}>
        <img
          src={imgPath}
          alt={product.taste ?? 'product image'}
          loading="lazy"
          decoding="async"
          className={styles.img}
        />
      </ContentCard>
    );
  };

  const renderCellPrice = (data: ProductMatrixItem) => (
    <ContentCard className={styles.priceCellCard}>
      <Text size="s" weight="semibold" view="system">
        {data.price} {currency}
      </Text>
    </ContentCard>
  );

  const renderCellProductName = (data: ProductMatrixItem) => {
    const product = data.productId ? productMap?.[data.productId] : null;

    if (!product) return null;

    return (
      <Text
        size="xs"
        className={styles.productNameText}
      >{`${product?.goodBrand.name} ${product?.taste}`}</Text>
    );
  };*/

  /*const renderCell = ({ data }: GridCellProps<ProductMatrixItem>) => (
    <VerticalContainer space="2xs" isAutoWidth>
      <VerticalContainer space={0}>
        {renderCellNumber(data)}
        {renderCellPlaceholder(data)}
        {renderCellVolume(data)}
        {renderCellPrice(data)}
      </VerticalContainer>
      {renderCellProductName(data)}
    </VerticalContainer>
  );*/

  /*const renderSnackTable = () => (
    <GridTable
      data={sortedProductMatrix}
      cellComponent={renderCell}
      rowHeaderHeight={rowHeaderHeight}
      getRowTitle={renderRowTitle}
      rowGap={rowGap}
      cellGap={cellGap}
    />
  );*/

  return <div></div>;
};

export default CellsControlStocks;
