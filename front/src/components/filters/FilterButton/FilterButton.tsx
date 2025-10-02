import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@consta/uikit/Button';
import { Modal } from '@consta/uikit/Modal';
import styles from './FilterButton.module.scss';
import { Text } from '@consta/uikit/Text';
import classNames from 'classnames';
import { IconArrowDown } from '../../../assets/icon/iconArrowDown';

type FilterButtonProps = {
  size?: 'm' | 'l';
  label: string;
  modalChildren?: () => ReactNode;
};

const FilterButton: FC<FilterButtonProps> = ({
  size = 'm',
  label,
  modalChildren = () => <Text>NoContent</Text>,
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Обработчики
  const handleFilterClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Останавливаем всплытие события
    setIsModalOpen((prevState) => !prevState);
  };

  const handleOutsideClick = (event: MouseEvent) => {
    if (ref.current && !ref.current.contains(event.target as Node)) {
      setIsModalOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Рендер методы
  const renderModal = () => {
    const buttonRef = ref.current;
    if (!buttonRef) return null;

    const buttonRect = buttonRef.getBoundingClientRect();
    const modalTop = buttonRect.bottom;
    const modalRight = window.innerWidth - buttonRect.right;

    return (
      <Modal
        className={styles.modal}
        hasOverlay={false}
        isOpen={isModalOpen}
        style={{
          top: `${modalTop + 8}px`,
          right: `${modalRight}px`,
        }}
        onClickOutside={handleOutsideClick}
      >
        {modalChildren()}
      </Modal>
    );
  };

  // TODO: тут потребуется выводить значение выбранного фильтра прям в кнопку (в рамках задачи 9271)
  return (
    <>
      <Button
        size={size}
        className={classNames(styles.filter, isModalOpen && styles.select)}
        ref={ref}
        label={label}
        view="ghost"
        iconRight={IconArrowDown}
        onClick={handleFilterClick}
      />
      {renderModal()}
    </>
  );
};

export default FilterButton;
