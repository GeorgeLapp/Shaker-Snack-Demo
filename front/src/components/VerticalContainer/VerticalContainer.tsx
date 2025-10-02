import { FC, Fragment, ReactNode } from 'react';
import './VerticalContainer.scss';
import { Space } from '@consta/uikit/MixSpace';
import classNames from 'classnames';

/**
 * Свойства компонента VerticalContainer
 */
type VerticalContainerProps = {
  /**
   * Внешний класс
   */
  className?: string;
  /**
   * Дочерние элементы
   */
  children: ReactNode;
  /**
   * Отступ
   */
  space?: Space;
  /**
   * Выравнивание по горизонту
   */
  align?: 'stretch' | 'center' | 'start' | 'end';
  justify?: 'stretch' | 'center' | 'start' | 'end';
  /**
   * Растягивает на всю ширину
   */
  isAutoWidth?: boolean;
  /**
   * Растягивает на всю высоты
   */
  isAutoHeight?: boolean;
  /**
   * Аналог justify-content: space-between;
   */
  isAutoSpace?: boolean;
  /**
   * Обработчик нажатия
   */
  onClick?: (e?: React.MouseEvent<HTMLDivElement>) => void;
};

/**
 * Вертикальный контейнер
 */
const VerticalContainer: FC<VerticalContainerProps> = ({
  children = null,
  className,
  space = 'l',
  align = 'stretch',
  justify = 'stretch',
  isAutoSpace = false,
  isAutoWidth = false,
  isAutoHeight = false,
  onClick = () => {
    null;
  },
}) => {
  return (
    <div
      className={classNames(
        'VerticalContainer',
        className,
        `gap_${space}`,
        `align_${align}`,
        `justify_${justify}`,
        isAutoSpace && 'gap_auto',
        isAutoWidth && 'width_auto',
        isAutoHeight && 'height_auto',
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default VerticalContainer;
