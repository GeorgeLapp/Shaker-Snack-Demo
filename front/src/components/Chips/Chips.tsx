import { FC } from 'react';
import styles from './Chips.module.scss';
import { Text } from '@consta/uikit/Text';
import classNames from 'classnames';
import { FieldErrorStatus } from '../../types/types';

/**
 * Свойства компонента Chips
 */
type ChipsProps = {
  /**
   * Заголовок
   */
  label: string;
  /**
   * Название (ключ)
   */
  name: string;
  /**
   * Флаг выбранного
   */
  isSelect: boolean;
  /**
   * Статус
   */
  status?: FieldErrorStatus;
  /**
   * Обработчик нажатия
   *
   * @param name название (ключ)
   */
  onClick: (name: string) => void;
};

/**
 * Компактные элементы, представляющие входные данные.
 */
const Chips: FC<ChipsProps> = ({ label, name, isSelect, status = undefined, onClick }) => {
  const isAlert = status === 'alert';
  const isWarning = status === 'warning';

  // Обработчики
  const handleClick = () => {
    onClick(name);
  };

  return (
    <div
      className={classNames(
        styles.chips,
        isSelect && styles.selected,
        isWarning && styles.warning,
        isAlert && styles.alert,
      )}
      onClick={handleClick}
    >
      <Text className={styles.text}>{label}</Text>
    </div>
  );
};

export default Chips;
