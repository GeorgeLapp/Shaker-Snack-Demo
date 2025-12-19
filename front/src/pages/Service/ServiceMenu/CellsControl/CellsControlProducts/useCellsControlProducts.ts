import { useAppDispatch, useAppSelector } from '../../../../../app/hooks/store';
import { selectCellsProducts } from '../../../../../state/serviceMenu/selectors';
import { useEffect, useMemo } from 'react';
import { getCellsProductsAction } from '../../../../../state/serviceMenu/action';

/**
 * Хук для преобразования ячеек с товарами
 */
export const useCellsControlProducts = () => {
  const dispatch = useAppDispatch();

  const { state: cellsProducts, isReject: isRejectCellsProducts } =
    useAppSelector(selectCellsProducts());

  const cellsProductsRows = useMemo(() => {
    const cells = cellsProducts?.view.cells || [];
    const rows: (typeof cells)[] = [];

    cells.forEach((cell) => {
      const rowIndex = cell.row;

      if (!rows[rowIndex]) {
        rows[rowIndex] = [];
      }

      rows[rowIndex].push(cell);
    });

    return rows;
  }, [cellsProducts]);

  useEffect(() => {
    dispatch(getCellsProductsAction());
  }, [dispatch]);

  return {
    cellsProductsRows: cellsProductsRows,
    isRejectCellsProducts: isRejectCellsProducts,
  };
};
