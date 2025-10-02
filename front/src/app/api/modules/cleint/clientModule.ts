import { AbstractApiModule } from '../../abstractApiModule';
import { ProductMatrixDTO } from '../../../../types/serverInterface/ProductMatrixDTO';
import { getDataFromServer } from '../../../../helpers/getDataFromServer';
import { productMatrix } from './mockData';
import { StartSaleDTO, StartSaleRes } from '../../../../types/serverInterface/StartSaleDTO';
import {
  IssueProductDTO,
  IssueProductRes,
} from '../../../../types/serverInterface/IssueProductDTO';

/**
 * API клиентской части приложения.
 * Класс `ClientModule` инкапсулирует методы для взаимодействия с бекендом вендингового автомата:
 * - получение матрицы продуктов
 * - запуск продажи
 * - запрос на выдачу продукта.
 *
 * Методы возвращают промисы и в реальном приложении должны обрабатывать сетевые/серверные ошибки,
 * а также возвращать структурированные DTO-ответы. В примере используется вспомогательная функция
 * `getDataFromServer` (заглушка), поэтому методы симулируют асинхронный ответ.
 */
export class ClientModule extends AbstractApiModule {
  /**
   * Получить матрицу продуктов (список доступных позиций/ячееек автомата).
   *
   * Используется при инициализации интерфейса, для отображения доступных товаров и их расположения.
   *
   * @returns {Promise<ProductMatrixDTO>} Промис, который резолвится объектом `ProductMatrixDTO`,
   *                                      содержащим текущую конфигурацию товаров в автомате.
   * @throws {Error} В случае сетевой или серверной ошибки (в реальной реализации).
   */
  getProductMatrix(): Promise<ProductMatrixDTO> {
    return getDataFromServer(productMatrix, 1000);
  }

  /**
   * Инициация продажи/транзакции.
   *
   * Отправляет на сервер данные о начале продажи (например, выбранная позиция, цена, дополнительные
   * параметры) и получает в ответ информацию для дальнейшей обработки платежа/транзакции.
   *
   * @param {StartSaleDTO} startSaleData — данные для старта продажи (выбранный товар, сумма и т.д.).
   * @returns {Promise<StartSaleRes>} Промис с результатом старта продажи. Обычно содержит `saleId`,
   *                                  состояние транзакции и, при необходимости, данные для оплаты.
   * @throws {Error} В случае валидации входных данных, сетевой или серверной ошибки.
   */
  startSale(startSaleData: StartSaleDTO): Promise<StartSaleRes> {
    return getDataFromServer({ success: true }, 10000);
  }

  /**
   * Запрос на выдачу продукта по завершённой или подтверждённой оплате.
   *
   * Вызывается после успешной оплаты (или когда система готова к выдаче). Сервер должен инициировать
   * механическую выдачу товара и вернуть результат операции.
   *
   * @param {IssueProductDTO} issueProductData — данные для запроса выдачи (обычно `saleId`, id ячейки и т.д.).
   * @returns {Promise<IssueProductRes>} Промис с результатом операции выдачи: успешность, коды ошибок,
   *                                    статус механики и т.п.
   * @throws {Error} В случае проблем с выдачей (механика, таймауты), сетевой или серверной ошибки.
   */
  issueProduct(issueProductData: IssueProductDTO): Promise<IssueProductRes> {
    return getDataFromServer({ success: true }, 10000);
  }
}
