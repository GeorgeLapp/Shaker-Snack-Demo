import { ProductMatrixItem } from '../../../../types/serverInterface/ProductMatrixDTO';

/**
 * Свойства компонента SaleWorkflow
 */
export type SaleWorkflowProps = {
  /**
   * Ячейка в процессе покупки
   */
  cell: ProductMatrixItem;
  /**
   * Обработчик закрытия процесса покупки
   */
  onClose: () => void;
};
