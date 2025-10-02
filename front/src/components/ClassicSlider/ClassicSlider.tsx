import React, { FC, MouseEvent, useState, useEffect, useRef, useCallback } from 'react';
import { ClassicSliderProps } from './types';
import classNames from 'classnames';
import styles from './ClassicSlider.module.scss';

const thumbSize = 24;

/**
 * Компонент для отображения слайдера
 */
const ClassicSlider: FC<ClassicSliderProps> = ({
  disabled,
  min,
  max,
  value,
  step = 1,
  isVertical = false,
  isActiveStatus,
  isHoverStatus,
  isEdit,
  className,
  onChange = () => {
    null;
  },
}) => {
  const lineRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<boolean>(false);
  const [valuePercent, setValuePercent] = useState(0);

  const calculateNewValue = useCallback(
    (newValue: number) => {
      if (step > 0) {
        const stepDecimalPlaces = (step.toString().split('.')[1] || '').length;
        const precision = Math.pow(10, stepDecimalPlaces);
        newValue = Math.round(newValue / step) * step;
        newValue = Math.round(newValue * precision) / precision;
      }

      return Math.min(Math.max(newValue, min), max);
    },
    [step, min, max],
  );

  const calculateNewPercent = useCallback(
    (lineElement: HTMLDivElement, e: globalThis.MouseEvent | MouseEvent<HTMLDivElement>) => {
      const length = isVertical ? lineElement.clientHeight : lineElement.clientWidth;

      const pointLength = isVertical
        ? lineElement.offsetTop + lineElement.clientHeight - e.clientY
        : e.clientX - lineElement.offsetLeft;

      return pointLength / length;
    },
    [isVertical],
  );

  useEffect(() => {
    if (max > min) {
      const boundedValue = Math.min(Math.max(value, min), max);

      setValuePercent((boundedValue - min) / (max - min));
    }
  }, [min, max, value, isDragging.current]);

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (lineRef.current && isDragging.current) {
        const newPercent = calculateNewPercent(lineRef.current, e);

        const validatePercent = Math.max(0, Math.min(1, newPercent));

        setValuePercent(validatePercent);
      }
    };

    isDragging.current && window.addEventListener('mousemove', handleMouseMove);

    // Очистка обработчика при размонтировании
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging.current, lineRef.current, isVertical]);

  useEffect(() => {
    document.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (lineRef.current && isDragging.current) {
        isDragging.current = false;

        const newPercent = calculateNewPercent(lineRef.current, e);

        let newValue = (max - min) * newPercent - min;

        newValue = calculateNewValue(newValue);

        !disabled && onChange(newValue);
      }
    });

    return document.removeEventListener('mouseup', () => {
      // setIsDragging(false);
    });
  }, [
    isDragging,
    isVertical,
    min,
    max,
    calculateNewPercent,
    calculateNewValue,
    onChange,
    disabled,
  ]);

  // Обработчики
  const handleLineClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();

    if (isEdit) {
      handleChange(e);
    }
  };

  // Обработка начала перетаскивания
  const handleMouseDown = () => {
    if (disabled) return;
    if (isEdit) {
      isDragging.current = true;
    }
  };

  const handleChange = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (isEdit) {
      const rect = e.currentTarget.getBoundingClientRect();
      let clickPercent;

      const sliderLength = (isVertical ? rect.height : rect.width) - thumbSize / 2;
      const clickPosition = isVertical ? e.clientY - rect.top : e.clientX - rect.left;

      clickPercent = isVertical ? 1 - clickPosition / sliderLength : clickPosition / sliderLength;

      clickPercent = Math.max(0, Math.min(clickPercent, 1));

      let newValue = min + clickPercent * (max - min);

      newValue = calculateNewValue(newValue);

      onChange(newValue);
    }
  };

  return (
    <div
      className={classNames(
        styles.classicSlider,
        isVertical ? styles.vertical : styles.horizontal,
        className,
        disabled && styles.disabled,
      )}
    >
      <div
        ref={lineRef}
        className={classNames(
          styles.line,
          isHoverStatus && styles.hoverLine,
          isActiveStatus && styles.activeLine,
          isEdit && styles.lineIsEdit,
          disabled && styles.disabled,
        )}
        onMouseDown={handleLineClick}
        style={{
          ['--value-percent' as string]: `${valuePercent}`,
        }}
      >
        <div
          className={classNames(
            styles.lineSlider,
            disabled && styles.disabled,
            isEdit && styles.isEdit,
            isDragging.current && styles.isDragging,
          )}
        />
        <div
          className={classNames(
            styles.point,
            disabled && styles.disabled,
            isEdit && styles.isEdit,
            isDragging.current && styles.isDragging,
          )}
          onMouseDown={handleMouseDown}
        />
      </div>
    </div>
  );
};

export default ClassicSlider;
