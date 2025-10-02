import { FC, useState } from 'react';
import { Text } from '@consta/uikit/Text';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import styles from './DefaultInfoItem.module.scss';
import { withTooltip } from '@consta/uikit/withTooltip';

/**
 * Тип элемента на модалке информации
 */
export type InfoItem = { name: string; value: string | number | React.ReactNode };

/**
 * Свойства компонента DefaultInfoItem
 */
type DefaultInfoItemProps = {
  /**
   * Элемент на модалке информации
   */
  item: InfoItem;
  /**
   * Флаг, для обозначения длинного текста
   */
  isBig?: boolean;
  /**
   * Текст tooltip
   */
  tooltipText?: string;
  /**
   * Внешний класс для дополнительной стилизации
   */
  className?: string;
  /**
   * Внешний класс для дополнительной стилизации имени
   */
  nameClassName?: string;
  /**
   * Внешний класс для дополнительной стилизации значения
   */
  valueClassName?: string;
};

const TextWithTooltip = withTooltip({ direction: 'downCenter' })(Text);

/**
 * Элемент на модалке информации
 */
const DefaultInfoItem: FC<DefaultInfoItemProps> = ({
  item,
  isBig = false,
  tooltipText,
  className,
  nameClassName,
  valueClassName,
}) => {
  const { t } = useTranslation();

  const { name, value } = item;

  const [isOpenDescription, setIsOpenDescription] = useState(false);

  // Обработчики
  const handleOpenDescription = () => {
    setIsOpenDescription(true);
  };

  const renderBigItemValue = () => (
    <div className={styles.descriptionAction}>
      <Text className={classNames(styles.description, isOpenDescription && styles.openDescription)}>
        {value}
      </Text>
      {!isOpenDescription && value && (
        <Text className={styles.openDescriptionText} onClick={handleOpenDescription}>
          {t('components.defaultInfoItem.more')}
        </Text>
      )}
    </div>
  );

  return (
    <div className={classNames(styles.infoItem, className)}>
      {tooltipText ? (
        <TextWithTooltip tooltipProps={{ content: tooltipText }} view="ghost">
          {name}
        </TextWithTooltip>
      ) : (
        <Text size="s" view="ghost" className={nameClassName}>
          {name}
        </Text>
      )}

      {isBig ? (
        renderBigItemValue()
      ) : (
        <Text size="s" className={classNames(styles.value, valueClassName)}>
          {value}
        </Text>
      )}
    </div>
  );
};

export default DefaultInfoItem;
