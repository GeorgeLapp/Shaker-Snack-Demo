import React, { FC, useEffect, useMemo, useState } from 'react';
import ContentCard from '../../../../../../components/ContentCard';
import VerticalContainer from '../../../../../../components/VerticalContainer';
import { Text } from '@consta/uikit/Text';
import HorizontalContainer from '../../../../../../components/HorizontalContainer';
import { TextField } from '@consta/uikit/TextField';
import { IconSearch } from '../../../../../../assets/icon/IconSearch';
import { Button } from '@consta/uikit/Button';
import {
  assignProductToCellAction,
  assignProductToRowAction,
  backToServiceMenuAction,
  getOpenProductsListAction,
} from '../../../../../../state/serviceMenu/action';
import { useAppDispatch, useAppSelector } from '../../../../../../app/hooks/store';
import { IconArrowLeft } from '../../../../../../assets/icon/iconArrowLeft';
import { IconArrowRight } from '../../../../../../assets/icon/iconArrowRight';
import { IconMeatball } from '../../../../../../assets/icon/iconMeatball';
import {
  selectChangeCellsProducts,
  selectOpenProductsList,
} from '../../../../../../state/serviceMenu/selectors';
import styles from './ChangeCellsControlProducts.module.scss';
import { useNavigate } from 'react-router-dom';
import { GridCellProps } from '../../../../../../components/GridTable/types';
import GridTable from '../../../../../../components/GridTable';
import {
  ChangeCellsModeEnum,
  OpenListItem,
  ProductToCellDTO,
  ProductToRowDTO,
} from '../../../../../../types/serverInterface/serviceMenuDTO';
import { resetChangeCellsProducts } from '../../../../../../state/serviceMenu/slice';
import Error from '../../../../../../components/Error';

const cellGap = 16;
const rowContentHeight = 158;

/**
 * Компонент для изменения продукта в ряду / ячейке
 */
export const ChangeCellsControlProducts: FC = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { mode, row, cell, productName } = useAppSelector(selectChangeCellsProducts());
  const { state: openProductsList, isReject: isRejectOpenProductList } =
    useAppSelector(selectOpenProductsList());

  const [searchValue, setSearchValue] = useState<string>('');

  const filteredMatrix = useMemo(() => {
    const source = openProductsList?.view.products || [];

    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return [source];
    }

    const filtered = source.filter((item: OpenListItem) => {
      const name = (item.name ?? '').toLowerCase();
      return name.includes(query);
    });

    return [filtered];
  }, [openProductsList, searchValue]);

  useEffect(() => {
    dispatch(getOpenProductsListAction());
  }, [dispatch]);

  // Обработчики
  const handleBackClick = () => {
    dispatch(backToServiceMenuAction()).then(() => navigate('/menu/cellControl'));
  };

  const handleSearchChange = (value: string | null) => {
    setSearchValue(value || '');
  };

  const handleAssignProduct = (data: OpenListItem) => {
    if (mode === ChangeCellsModeEnum.CELL && cell !== null) {
      const productToCell: ProductToCellDTO = {
        cellId: cell,
        productId: data.id,
      };

      dispatch(assignProductToCellAction(productToCell))
        .then(() => dispatch(resetChangeCellsProducts()))
        .then(() => handleBackClick());
    }

    if (mode === ChangeCellsModeEnum.ROW && row !== null) {
      const productToRow: ProductToRowDTO = {
        row: row,
        productId: data.id,
        scope: 'all',
      };

      dispatch(assignProductToRowAction(productToRow))
        .then(() => dispatch(resetChangeCellsProducts()))
        .then(() => handleBackClick());
    }
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
        <Button size="l" view="clear" onlyIcon iconLeft={IconMeatball} />
        <IconArrowRight size="m" />
        <Text size="3xl" weight="semibold">
          Изменить товар
        </Text>
      </HorizontalContainer>
    </HorizontalContainer>
  );

  const renderChangeProductCard = () => (
    <ContentCard className={styles.productContentCard}>
      <VerticalContainer space="m" isAutoWidth>
        <VerticalContainer space="2xs">
          {mode === ChangeCellsModeEnum.ROW ? (
            <Text size="2xl">Изменить товары на {row} полке</Text>
          ) : (
            <>
              <Text size="2xl">Изменить товар в ячейке №{cell}</Text>
              <Text size="2xl" view="secondary">
                Текущее значение: {productName}
              </Text>
            </>
          )}
        </VerticalContainer>
        <TextField
          size="l"
          width="full"
          leftSide={IconSearch}
          placeholder="Поиск товара"
          onChange={handleSearchChange}
        />
      </VerticalContainer>
    </ContentCard>
  );

  const renderCellPlaceholder = (cell: OpenListItem) => {
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

  const renderProductName = (cell: OpenListItem) => (
    <Text size="xs" className={styles.productNameText}>
      {cell.name}
    </Text>
  );

  const renderCell = ({ data }: GridCellProps<OpenListItem>) => (
    <VerticalContainer space="2xs" isAutoWidth onClick={() => handleAssignProduct(data)}>
      {renderCellPlaceholder(data)}
      {renderProductName(data)}
    </VerticalContainer>
  );

  const renderGridTable = () => {
    const hasProducts = filteredMatrix.length > 0;

    return (
      <ContentCard className={styles.gridContainerContentCard}>
        {hasProducts ? (
          <GridTable
            rowContentClassName={styles.rowContentClassName}
            showRowHeaders={false}
            data={filteredMatrix}
            layout="wrap"
            cellGap={cellGap}
            rowContentHeight={rowContentHeight}
            cellComponent={renderCell}
          />
        ) : (
          <VerticalContainer space="m" align="center">
            <Text size="xl">Товары не найдены</Text>
          </VerticalContainer>
        )}
      </ContentCard>
    );
  };

  const renderError = () => <Error />;

  if (isRejectOpenProductList) return renderError();

  return (
    <VerticalContainer space="l" className={styles.ChangeCellsControlProducts}>
      {renderHeader()}
      {renderChangeProductCard()}
      {renderGridTable()}
    </VerticalContainer>
  );
};

export default ChangeCellsControlProducts;
