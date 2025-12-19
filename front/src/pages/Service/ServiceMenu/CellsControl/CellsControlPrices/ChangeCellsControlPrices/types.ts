import { ChangeCellsModeEnum } from '../../../../../../types/serverInterface/serviceMenuDTO';

/**
 * Свойства компонента ChangeCellControlPrices
 */
export type ChangeCellControlPricesProps = {
  /**
   * Флаг открытия модального окна
   */
  isOpen: boolean;
  /**
   * Цена
   */
  cellRowPrice: number | null;
  /**
   * Номер ряда
   */
  row: number | null;
  /**
   * Номер ячейки
   */
  cell: number | null;
  /**
   * Режим изменения цен/продуктов
   */
  mode: ChangeCellsModeEnum;
  /**
   * Обработчик закрытия модального окна
   */
  onClose: () => void;
};
