import { CellControlEnum, CellControlTab } from './types';

/**
 * Набор табов для управления ячейками
 */
export const cellControlTabs: CellControlTab[] = [
  /* {
    label: 'Остатки',
    value: CellControlEnum.STOCKS,
  },
  {
    label: 'Глубина',
    value: CellControlEnum.DEPTH,
  },*/
  {
    label: 'Цены',
    value: CellControlEnum.PRICES,
  },
  {
    label: 'Товары',
    value: CellControlEnum.PRODUCTS,
  },
  {
    label: 'Конфиг. ячеек',
    value: CellControlEnum.CONFIG,
  },
];
