import { FC, ReactNode, RefObject } from 'react';
import './HorizontalContainer.scss';
import { Space } from '@consta/uikit/MixSpace';
import classNames from 'classnames';

/**
 * Свойства компонента HorizontalContainer
 */
type HorizontalContainerProps = {
  ref?: RefObject<HTMLDivElement>;
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
  /**
   * Выравнивание по вертикали
   */
  justify?: 'stretch' | 'center' | 'start' | 'end';
  /**
   * Растягивает на всю ширину
   */
  isAutoWidth?: boolean;
  /**
   * Аналог justify-content: space-between;
   */
  isAutoSpace?: boolean;
  /**
   * Обработчик нажатия
   */
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

/**
 * Горизонтальный контейнер
 */
const HorizontalContainer: FC<HorizontalContainerProps> = ({
  children,
  className,
  space = 'l',
  align = 'center',
  justify = 'stretch',
  isAutoSpace,
  isAutoWidth = false,
  ref,
  onClick = () => {
    null;
  },
  onMouseLeave = () => {
    null;
  },
  onMouseEnter = () => {
    null;
  },
}) => {
  return (
    <div
      className={classNames(
        'HorizontalContainer',
        className,
        `gap_${space}`,
        `align_${align}`,
        `justify_${justify}`,
        isAutoSpace && 'gap_auto',
        isAutoWidth && 'width_auto',
      )}
      ref={ref}
      onClick={onClick}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
    >
      {children}
    </div>
  );
};

export default HorizontalContainer;
