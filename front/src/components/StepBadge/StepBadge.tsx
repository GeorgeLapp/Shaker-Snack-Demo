import { FC } from 'react';
import { Badge } from '@consta/uikit/Badge';
import styles from './StepBadge.module.scss';
import { useTranslation } from 'react-i18next';

/**
 * Свойства компонента StepBadge
 */
type StepBadgeProps = {
  /**
   * Номер шага
   */
  stepNumber: number;
};

/**
 * Компонент отображения номера шага
 */
const StepBadge: FC<StepBadgeProps> = ({ stepNumber }) => {
  const { t } = useTranslation();

  return (
    <Badge
      className={styles.stepBadge}
      size="l"
      label={t('components.stepBadge.label', { stepNumber })}
    />
  );
};

export default StepBadge;
