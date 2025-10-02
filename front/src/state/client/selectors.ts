import { RootState } from '../../app/store';

/**
 * Селектор получения матрицы продуктов.
 *
 * Возвращает значение `state.client.productMatrix` — структуру, описывающую
 * доступные товары и их расположение в автомате.
 *
 * @returns {(state: RootState) => ProductMatrixDTO | null | undefined} Селектор, который
 *          при применении к `state` вернёт объект матрицы продуктов или `null`/`undefined`,
 *          если данные ещё не загружены.
 *
 * @example
 * const productMatrix = useSelector(selectProductMatrix());
 */
export const selectProductMatrix = () => (state: RootState) => state.client.productMatrix;

/**
 * Селектор получения данных ячейки продукта по её `id`.
 *
 * Возвращает `state.client.productCellMap[id]` или `null`, если `id` равен `null`
 * либо соответствующая ячейка не найдена.
 *
 * @param {number | null} id — идентификатор ячейки. Если `null`, селектор вернёт `null`.
 * @returns {(state: RootState) => ProductCellDTO | null} Селектор, который при применении
 *          к `state` вернёт данные ячейки или `null`.
 *
 * @example
 * const cell = useSelector(selectProductCellById(selectedCellId));
 */
export const selectProductCellById = (id: number | null) => (state: RootState) =>
  (id && state.client.productCellMap?.[id]) || null;

/**
 * Селектор получения текущего статуса workflow продажи.
 *
 * Возвращает значение из `state.client.saleWorkflowStatus`, например одно из значений
 * `SaleWorkflowStatus` или `null`/`undefined`, если статус не установлен.
 *
 * @returns {(state: RootState) => SaleWorkflowStatus | null | undefined} Селектор,
 *          который при применении к `state` вернёт текущий статус workflow.
 *
 * @example
 * const status = useSelector(selectSaleWorkflowStatus());
 */
export const selectSaleWorkflowStatus = () => (state: RootState) => state.client.saleWorkflowStatus;
