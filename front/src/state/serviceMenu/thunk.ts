import { createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../app/api';
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
} from '../../types/serverInterface/serviceMenuDTO';

/**
 * Открытие сервисного меню
 */
export const getOpenSettingsThunk = createAsyncThunk('getOpenSettings', async () => {
  return await api.serviceMenu.getOpenSettings();
});

/**
 * Авторизация по PIN
 *
 * @param pin PIN
 */
export const authSubmitPinThunk = createAsyncThunk<ServiceMenuAuthorizationDTO, Pin>(
  'authSubmitPin',
  async (pin) => {
    return api.serviceMenu.authSubmitPin(pin);
  },
);

/**
 * Получение конфига ячеек
 */
export const getCellsConfigThunk = createAsyncThunk<ServiceMenuConfigDTO, undefined>(
  'getCellsConfig',
  async () => {
    return await api.serviceMenu.getCellsConfig();
  },
);

/**
 * Получение остатков
 */
export const getCellsStocksThunk = createAsyncThunk('getCellsStocks', async () => {
  return await api.serviceMenu.getCellsStocks();
});

/**
 * Получение цен
 */
export const getCellsPricesThunk = createAsyncThunk<ServiceMenuPricesDTO, undefined>(
  'getCellsPrices',
  async () => {
    return await api.serviceMenu.getCellsPrices();
  },
);

/**
 * Получение товаров
 */
export const getCellsProductsThunk = createAsyncThunk<ServiceMenuProductsDTO, undefined>(
  'getCellsProducts',
  async () => {
    return await api.serviceMenu.getCellsProducts();
  },
);

/**
 * Получение диагностики ячеек
 */
export const getCellsTestThunk = createAsyncThunk<DiagnosticsTestDTO, undefined>(
  'getCellsTest',
  async () => {
    return await api.serviceMenu.getCellsTest();
  },
);

/**
 * Получение состояния моторов
 */
export const loadCalibrationThunk = createAsyncThunk<LoadCalibrationDTO, undefined>(
  'loadCalibration',
  async () => {
    return await api.serviceMenu.loadCalibration();
  },
);

/**
 * Получение начала калибровки
 */
export const startCalibrationThunk = createAsyncThunk<StartCalibrationDTO, undefined>(
  'startCalibration',
  async () => {
    return await api.serviceMenu.startCalibration();
  },
);

/**
 * Получение состояния калибровки
 */
export const pollCalibrationThunk = createAsyncThunk<PollCalibrationDTO, undefined>(
  'pollCalibration',
  async () => {
    return await api.serviceMenu.pollCalibration();
  },
);

/**
 * Изменение цены во всем ряду
 */
export const changeCellsPricesRowThunk = createAsyncThunk<ServiceMenuPricesDTO, CellsPricesRowDTO>(
  'changeCellsPricesRow',
  async (cellsPricesRow) => {
    return await api.serviceMenu.changeCellsPricesRow(cellsPricesRow);
  },
);

/**
 * Изменение цены в ячейке
 */
export const changeCellPriceThunk = createAsyncThunk<ServiceMenuPricesDTO, CellPriceDTO>(
  'changeCellPrice',
  async (cellPrice) => {
    return await api.serviceMenu.changeCellPrice(cellPrice);
  },
);

/**
 * Получение списка товаров
 */
export const getOpenProductsListThunk = createAsyncThunk<OpenProductListDTO, undefined>(
  'getOpenProductsList',
  async () => {
    return await api.serviceMenu.getOpenProductsList();
  },
);

/**
 *  Присвоение товара ячейке
 */
export const assignProductToCellThunk = createAsyncThunk<ServiceMenuProductsDTO, ProductToCellDTO>(
  'assignProductToCell',
  async (productToCell) => {
    return api.serviceMenu.assignProductToCell(productToCell);
  },
);

/**
 *  Присвоение товара ряду
 */
export const assignProductToRowThunk = createAsyncThunk<ServiceMenuProductsDTO, ProductToRowDTO>(
  'assignProductToRow',
  async (assignProductToRow) => {
    return await api.serviceMenu.assignProductToRow(assignProductToRow);
  },
);

/**
 * Включение/выключение ячеек
 */
export const turnOnOffCellsThunk = createAsyncThunk<ServiceMenuConfigDTO, TurnOnOffCellsDTO>(
  'turnOnOffCells',
  async (turnOnOffCells) => {
    return await api.serviceMenu.turnOnOffCells(turnOnOffCells);
  },
);

/**
 * Объединение ячеек
 */
export const mergeCellsThunk = createAsyncThunk<ServiceMenuConfigDTO, MergeCellsDTO>(
  'mergeCells',
  async (mergeCells) => {
    return await api.serviceMenu.mergeCells(mergeCells);
  },
);

/**
 * Разъединение ячеек
 */
export const splitCellsThunk = createAsyncThunk<ServiceMenuConfigDTO, SplitCellsDTO>(
  'splitCells',
  async (splitCells) => {
    return await api.serviceMenu.splitCells(splitCells);
  },
);

/**
 * Изменение типа ячеек
 */
export const changeCellsTypeThunk = createAsyncThunk<ServiceMenuConfigDTO, ChangeCellsTypeDTO>(
  'changeCellsType',
  async (changeCellsType) => {
    return await api.serviceMenu.changeCellsType(changeCellsType);
  },
);

/**
 * Тест ячеек
 */
export const runDiagnosticsThunk = createAsyncThunk<undefined, RunDiagnosticsDTO>(
  'runDiagnostics',
  async (runDiagnostics) => {
    return await api.serviceMenu.runDiagnostics(runDiagnostics);
  },
);

/**
 * Перезапуск теста ячеек
 */
export const rerunDiagnosticsThunk = createAsyncThunk<undefined, RerunDiagnosticsDTO>(
  'rerunDiagnostics',
  async (rerunDiagnostics) => {
    return await api.serviceMenu.rerunDiagnostics(rerunDiagnostics);
  },
);

/**
 * Переход к сервисному меню
 */
export const backToServiceMenuThunk = createAsyncThunk('backToServiceMenu', async () => {
  return await api.serviceMenu.backToServiceMenu();
});

/**
 * Повтор после ошибки
 */
export const retryThunk = createAsyncThunk('retry', async () => {
  return await api.serviceMenu.retry();
});
