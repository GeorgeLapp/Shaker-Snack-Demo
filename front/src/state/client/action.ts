import { AppDispatch } from '../../app/store';
import { getProductMatrixThunk, issueProductThunk, startSaleThunk } from './thunk';
import { IssueProductDTO } from '../../types/serverInterface/IssueProductDTO';
import { StartSaleDTO } from '../../types/serverInterface/StartSaleDTO';

/**
 * Действие для получения матрицы продуктов.
 *
 * Запускает `getProductMatrixThunk`, который выполняет асинхронный запрос на сервер
 * для получения конфигурации товаров в автомате.
 *
 * @returns {Function} Thunk-функция, принимающая `dispatch: AppDispatch` и возвращающая результат выполнения `getProductMatrixThunk`.
 *                    Как правило это промис, который резолвится данными `ProductMatrixDTO`.
 * @example
 * dispatch(getProductMatrixAction());
 */
export const getProductMatrixAction = () => (dispatch: AppDispatch) =>
  dispatch(getProductMatrixThunk());

/**
 * Запускает полный workflow продажи: сначала инициация продажи, затем выдача товара.
 *
 * Последовательность:
 * 1. Диспатчится `startSaleThunk(data)` — инициация/регистрация продажи на сервере.
 * 2. По успешному завершению `startSaleThunk` выполняется `issueProductThunk(data)` — запрос на выдачу товара.
 *
 * Обратите внимание:
 * - Если `startSaleThunk` отклонён (reject), `issueProductThunk` не будет запущен.
 * - Рекомендуется обрабатывать возможные ошибки (reject) при вызове `startSaleWorkflow`.
 *
 * @param {IssueProductDTO & StartSaleDTO} data — объединённые данные, необходимые и для старта продажи, и для запроса выдачи.
 *                                              Обычно содержит `saleId`/`productId`/ячейку/сумму и т.п.
 * @returns {Function} Thunk-функция, принимающая `dispatch: AppDispatch` и возвращающая промис цепочки:
 *                     результат `startSaleThunk(data)` затем `issueProductThunk(data)`.
 *                     В случае ошибки промис будет отклонён с причиной от соответствующего thunk.
 * @example
 * dispatch(startSaleWorkflow({ saleId: '...', productId: 'A1', price: 100 }));
 */
export const startSaleWorkflow =
  (data: IssueProductDTO & StartSaleDTO) => (dispatch: AppDispatch) =>
    dispatch(startSaleThunk(data)).then(() => dispatch(issueProductThunk(data)));
