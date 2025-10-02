import React, { FC, useMemo, useRef, useState } from 'react';
import HorizontalContainer from '../../HorizontalContainer';
import { Text } from '@consta/uikit/Text';
import styles from './TabBadge.module.scss';
import classNames from 'classnames';
import Counter from '../../Counter';
import { TabBadgeProps } from './types';
import { Modal } from '@consta/uikit/Modal';

/**
 * Компонент таба
 */
const TabBadge: FC<TabBadgeProps> = ({
  modalChildren,
  size,
  isSelect,
  isModalChildrenRender = true,
  badgeLabelText,
  disabled,
  label,
  highlightedLabel,
  classNameModal,
  value,
  renderLeftIcon,
  renderRightIcon,
  onClick,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clickedOutside, setClickedOutside] = useState(false);

  const sizeClassName = useMemo(() => {
    switch (size) {
      case 'm':
        return styles.Size_m;
      case 's':
        return styles.Size_s;
      case 'xs':
        return styles.Size_xs;
      default:
        return null;
    }
  }, [size]);

  const tabView = useMemo(() => {
    if (disabled) return styles.disabled;
    if (isSelect) return styles.isSelect;
    return styles.default;
  }, [disabled, isSelect]);

  // Обработчики
  const handleBadgeClick = () => {
    setClickedOutside(false);

    if (modalChildren && !clickedOutside) {
      setIsModalOpen((open) => !open);
    }
    onClick?.();
  };

  const handelClose = () => {
    if (modalChildren) {
      setIsModalOpen(false);
      setClickedOutside(true);

      setTimeout(() => {
        setClickedOutside(false);
      }, 100);
    }

    onClick?.();
  };

  // render методЫ
  const renderModal = () => {
    if (!ref.current || !isModalChildrenRender || !modalChildren) return null;
    const { bottom, left } = ref.current.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;

    return (
      <Modal
        className={classNames(styles.Modal, classNameModal)}
        hasOverlay={false}
        isOpen={isModalOpen}
        style={{ top: bottom + scrollTop + 8, left: left }}
        onClickOutside={handelClose}
      >
        {modalChildren(handelClose)}
      </Modal>
    );
  };

  return (
    <div ref={ref} className={styles.TabBadgeWithLabel}>
      {modalChildren && renderModal()}
      <HorizontalContainer
        className={classNames(styles.TabBadge, sizeClassName, tabView)}
        space={size === 'm' ? 'xs' : '2xs'}
        align="center"
        onClick={handleBadgeClick}
      >
        {renderLeftIcon && renderLeftIcon()}
        <Text className={styles.text} weight="medium" size={size}>
          {label}
        </Text>
        {highlightedLabel && (
          <Text className={styles.highlightedText} weight="medium" size={size}>
            {highlightedLabel}
          </Text>
        )}
        {value && (
          <Text className={styles.valueText} weight="medium" size={size}>
            {value}
          </Text>
        )}
        {renderRightIcon && renderRightIcon()}
      </HorizontalContainer>
      {badgeLabelText && (
        <Counter status="error" size="s" label={badgeLabelText} className={styles.label} />
      )}
    </div>
  );
};

export default TabBadge;
