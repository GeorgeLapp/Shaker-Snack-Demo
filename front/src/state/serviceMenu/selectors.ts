import { RootState } from '../../app/store';

/**
 * Селектор выбора вкладки в сервисном меню
 */
export const selectCellControlTab = () => (state: RootState) =>
  state.serviceMenu.selectedCellControlTab;

/**
 * Селектор открытия сервисного меню
 */
export const selectOpenSettings = () => (state: RootState) => state.serviceMenu.openSettings;

/**
 * Селектор получения конфига ячеек
 */
export const selectCellsConfig = () => (state: RootState) => state.serviceMenu.cellsConfig;

/**
 * Селектор получения остатков
 */
export const selectCellsStocks = () => (state: RootState) => state.serviceMenu.cellsStocks;

/**
 * Селектор получения цен
 */
export const selectCellsPrices = () => (state: RootState) => state.serviceMenu.cellsPrices;

/**
 * Селектор получения товаров
 */
export const selectCellsProducts = () => (state: RootState) => state.serviceMenu.cellsProducts;

/**
 * Селектор получения всех товаров
 */
export const selectChangeCellsProducts = () => (state: RootState) =>
  state.serviceMenu.changeCellsProducts;

/**
 * Селектор получения списка товаров
 */
export const selectOpenProductsList = () => (state: RootState) =>
  state.serviceMenu.openProductsList;

/**
 * Селектор получения списка ячеек для диагностики
 */
export const selectCellsTest = () => (state: RootState) => state.serviceMenu.cellsTest;
