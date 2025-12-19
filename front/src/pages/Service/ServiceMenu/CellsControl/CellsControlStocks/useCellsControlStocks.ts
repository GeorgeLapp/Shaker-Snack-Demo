import { useAppSelector } from '../../../../../app/hooks/store';
import { selectProductMatrix } from '../../../../../state/client/selectors';

export const useCellsControlStocks = () => {
  const { state: productMatrix } = useAppSelector(selectProductMatrix());

  /*const snackRows = useMemo(() => {
    const cells = productMatrix || [];
    const rowsMap = new Map<number, typeof cells>();

    cells.forEach((cell) => {
      const row = cell.rowNumber;
      if (!rowsMap.has(row)) rowsMap.set(row, []);
      rowsMap.get(row)!.push(cell);
    });

    return Array.from(rowsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([rowNumber, rowCells]) => {
        const sorted = [...rowCells].sort((a, b) => a.cellNumber - b.cellNumber);

        const alertCellsLength = sorted.filter((c) => (c.volume || 0) === 0).length;
        const warningCellsLength = sorted.filter(
          (c) => (c.volume || 0) <= (c.minVolume || 0),
        ).length;
        const blockedCellsLength = sorted.filter((c) => !c.active).length;

        return {
          rowNumber,
          cells: sorted,
          alertCellsLength,
          warningCellsLength,
          blockedCellsLength,
        };
      });
  }, [snackCells]);*/
};
