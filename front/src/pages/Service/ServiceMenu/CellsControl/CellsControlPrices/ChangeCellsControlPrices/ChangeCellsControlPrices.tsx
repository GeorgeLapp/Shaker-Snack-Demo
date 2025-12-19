import { FC, useState } from 'react';
import { ChangeCellControlPricesProps } from './types';
import DefaultModal from '../../../../../../components/DefaultModal';
import HorizontalContainer from '../../../../../../components/HorizontalContainer';
import { Button } from '@consta/uikit/Button';
import {
  CellPriceDTO,
  CellsPricesRowDTO,
  ChangeCellsModeEnum,
} from '../../../../../../types/serverInterface/serviceMenuDTO';
import { useAppDispatch } from '../../../../../../app/hooks/store';
import {
  changeCellPriceAction,
  changeCellsPricesRowAction,
} from '../../../../../../state/serviceMenu/action';
import { TextField } from '@consta/uikit/TextField';
import { getInputNumberValue } from '../../../../../../helpers/inputHelpers';
import styles from './ChangeCellsControlPrice.module.scss';

/**
 * Модальное окно для изменения цены в ряду / ячейке
 */
const ChangeCellsControlPrices: FC<ChangeCellControlPricesProps> = ({
  isOpen,
  cellRowPrice,
  row,
  cell,
  mode,
  onClose,
}) => {
  const dispatch = useAppDispatch();

  const [price, setPrice] = useState<number | null>(cellRowPrice);

  // Обработчики
  const handleSubmit = () => {
    if (price === null) return;

    if (mode === ChangeCellsModeEnum.ROW && row !== null) {
      const cellsPricesRow: CellsPricesRowDTO = {
        row,
        price,
      };

      dispatch(changeCellsPricesRowAction(cellsPricesRow)).then(() => {
        onClose();
      });
    }

    if (mode === ChangeCellsModeEnum.CELL && cell !== null) {
      const cellPrice: CellPriceDTO = {
        cellId: cell,
        price,
      };

      dispatch(changeCellPriceAction(cellPrice)).then(() => {
        onClose();
      });
    }
  };

  const handleChangePrices = (value: string | null) => {
    setPrice(value ? Number(value) : null);
  };

  // render методы
  const renderTextField = () => (
    <TextField
      value={getInputNumberValue(price)}
      label="Цена"
      placeholder="0"
      width="full"
      size="m"
      rightSide="₽"
      onChange={handleChangePrices}
    />
  );

  const renderActions = () => (
    <HorizontalContainer space="m">
      <Button size="m" view="clear" label="Отменить" onClick={onClose} />
      <Button size="m" view="primary" label="Сохранить" onClick={handleSubmit} />
    </HorizontalContainer>
  );

  return (
    <DefaultModal
      className={styles.ChangeCellsControlPrice}
      isOpen={isOpen}
      modalTitle="Изменить цену"
      renderActions={renderActions}
      onClose={onClose}
    >
      {renderTextField()}
    </DefaultModal>
  );
};

export default ChangeCellsControlPrices;
