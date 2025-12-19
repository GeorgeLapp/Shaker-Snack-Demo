import { AbstractApiModule } from '../../abstractApiModule';
import { serviceMenuBaseUrl } from '../../../../consts/env';
import {
  CellPriceDTO,
  CellsPricesRowDTO,
  ChangeCellsTypeDTO,
  DiagnosticsTestDTO,
  LoadCalibrationDTO,
  MergeCellsDTO,
  OpenProductListDTO,
  Pin,
  PollCalibrationDTO,
  ProductToCellDTO,
  ProductToRowDTO,
  RerunDiagnosticsDTO,
  RunDiagnosticsDTO,
  ServiceMenuAuthorizationDTO,
  ServiceMenuConfigDTO,
  ServiceMenuPricesDTO,
  ServiceMenuProductsDTO,
  SplitCellsDTO,
  StartCalibrationDTO,
  TurnOnOffCellsDTO,
} from '../../../../types/serverInterface/serviceMenuDTO';

export class ServiceMenuModule extends AbstractApiModule {
  /**
   * Открытие сервисного меню
   */
  getOpenSettings() {
    return this.request.post(`${serviceMenuBaseUrl}/bff/ui/open-settings`);
  }

  /**
   * Авторизация по PIN
   * @param pin PIN
   */
  authSubmitPin(pin: Pin) {
    return this.request.post<Pin, ServiceMenuAuthorizationDTO>(
      `${serviceMenuBaseUrl}/bff/auth/login`,
      pin,
    );
  }

  /**
   * Получение конфига ячеек
   */
  async getCellsConfig() {
    return await this.request.post<undefined, ServiceMenuConfigDTO>(
      `${serviceMenuBaseUrl}/bff/ui/nav/cells-config`,
    );
  }

  /**
   * Получение остатков
   */
  getCellsStocks() {
    return this.request.post(`${serviceMenuBaseUrl}/bff/ui/nav/cells-stocks`);
  }

  /**
   * Получение цен
   */
  async getCellsPrices() {
    return await this.request.post<undefined, ServiceMenuPricesDTO>(
      `${serviceMenuBaseUrl}/bff/ui/nav/cells-prices`,
    );
  }

  /**
   * Получение товаров
   */
  async getCellsProducts() {
    return await this.request.post<undefined, ServiceMenuProductsDTO>(
      `${serviceMenuBaseUrl}/bff/ui/nav/cells-products`,
    );
  }

  /**
   * Получение диагностики ячеек
   */
  async getCellsTest() {
    return await this.request.post<undefined, DiagnosticsTestDTO>(
      `${serviceMenuBaseUrl}/bff/ui/nav/diagnostics`,
    );
  }

  /**
   * Получение состояния моторов
   */
  loadCalibration() {
    return this.request.post<undefined, LoadCalibrationDTO>(
      `${serviceMenuBaseUrl}/bff/diagnostics/test-cells/load`,
    );
  }

  /**
   * Получение начала калибровки
   */
  startCalibration() {
    return this.request.post<undefined, StartCalibrationDTO>(
      `${serviceMenuBaseUrl}/bff/diagnostics/test-cells/calibration/start`,
    );
  }

  /**
   * Получение состояния калибровки
   */
  pollCalibration() {
    return this.request.post<undefined, PollCalibrationDTO>(
      `${serviceMenuBaseUrl}/bff/diagnostics/test-cells/calibration/poll`,
    );
  }

  /**
   * Изменение цены во всем ряду
   */
  changeCellsPricesRow(cellsPricesRow: CellsPricesRowDTO) {
    return this.request.post<CellsPricesRowDTO, ServiceMenuPricesDTO>(
      `${serviceMenuBaseUrl}/bff/cells/price/row`,
      cellsPricesRow,
    );
  }

  /**
   * Изменение цены в ячейке
   */
  changeCellPrice(cellPrice: CellPriceDTO) {
    return this.request.post<CellPriceDTO, ServiceMenuPricesDTO>(
      `${serviceMenuBaseUrl}/bff/cells/price/cell`,
      cellPrice,
    );
  }

  /**
   * Получение списка товаров
   */
  async getOpenProductsList() {
    return await this.request.post<undefined, OpenProductListDTO>(
      `${serviceMenuBaseUrl}/bff/products/open-list`,
    );
  }

  /**
   *  Присвоение товара ячейке
   */
  assignProductToCell(productToCell: ProductToCellDTO) {
    return this.request.post<ProductToCellDTO, ServiceMenuProductsDTO>(
      `${serviceMenuBaseUrl}/bff/products/assign`,
      productToCell,
    );
  }

  /**
   *  Присвоение товара ряду
   */
  assignProductToRow(productToRow: ProductToRowDTO) {
    return this.request.post<ProductToRowDTO, ServiceMenuProductsDTO>(
      `${serviceMenuBaseUrl}/bff/products/assign-row`,
      productToRow,
    );
  }

  /**
   * Включение/выключение ячеек
   */
  turnOnOffCells(turnOnOffCells: TurnOnOffCellsDTO) {
    return this.request.post<TurnOnOffCellsDTO, ServiceMenuConfigDTO>(
      `${serviceMenuBaseUrl}/bff/cells/status`,
      turnOnOffCells,
    );
  }

  /**
   * Объединение ячеек
   */
  mergeCells(mergeCells: MergeCellsDTO) {
    return this.request.post<MergeCellsDTO, ServiceMenuConfigDTO>(
      `${serviceMenuBaseUrl}/bff/cells/merge`,
      mergeCells,
    );
  }

  /**
   * Разъединение ячеек
   */
  splitCells(splitCells: SplitCellsDTO) {
    return this.request.post<SplitCellsDTO, ServiceMenuConfigDTO>(
      `${serviceMenuBaseUrl}/bff/cells/split`,
      splitCells,
    );
  }

  /**
   * Изменение типа ячеек
   */
  changeCellsType(cellsType: ChangeCellsTypeDTO) {
    return this.request.post<ChangeCellsTypeDTO, ServiceMenuConfigDTO>(
      `${serviceMenuBaseUrl}/bff/cells/type`,
      cellsType,
    );
  }

  /**
   * Тест ячеек
   */
  runDiagnostics(runDiagnostics: RunDiagnosticsDTO) {
    return this.request.post<RunDiagnosticsDTO, undefined>(
      `${serviceMenuBaseUrl}/bff/diagnostics/run`,
      runDiagnostics,
    );
  }

  /**
   * Перезапуск теста ячеек
   */
  rerunDiagnostics(rerunDiagnostics: RerunDiagnosticsDTO) {
    return this.request.post<RerunDiagnosticsDTO, undefined>(
      `${serviceMenuBaseUrl}/bff/diagnostics/rerun`,
      rerunDiagnostics,
    );
  }

  /**
   * Переход к сервисному меню
   */
  backToServiceMenu() {
    return this.request.post(`${serviceMenuBaseUrl}/bff/ui/back`);
  }

  /**
   * Повтор после ошибки
   */
  retry() {
    return this.request.post(`${serviceMenuBaseUrl}/bff/ui/retry`);
  }
}
