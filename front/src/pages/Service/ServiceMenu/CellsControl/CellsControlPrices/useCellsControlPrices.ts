import { useAppDispatch, useAppSelector } from '../../../../../app/hooks/store';
import { selectCellsPrices } from '../../../../../state/serviceMenu/selectors';
import { useEffect, useMemo } from 'react';
import { getCellsPricesAction } from '../../../../../state/serviceMenu/action';

/**
 * Хук для преобразования ячеек с ценами
 */
export const useCellsControlPrices = () => {
  const dispatch = useAppDispatch();

  const { state: cellsPrices, isReject: isRejectCellsPrices } = useAppSelector(selectCellsPrices());

  const cellsPricesRows = useMemo(() => {
    const cells = cellsPrices?.view.cells || [];
    const rows: (typeof cells)[] = [];

    cells.forEach((cell) => {
      const rowIndex = cell.row;

      if (!rows[rowIndex]) {
        rows[rowIndex] = [];
      }

      rows[rowIndex].push(cell);
    });

    return rows;
  }, [cellsPrices]);

  useEffect(() => {
    dispatch(getCellsPricesAction());
  }, [dispatch]);

  return { cellsPricesRows, isRejectCellsPrices: isRejectCellsPrices };
};
