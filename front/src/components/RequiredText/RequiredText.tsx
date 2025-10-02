import React, { FC } from 'react';
import { Text } from '@consta/uikit/Text';
import styles from './RequiredText.module.scss';
import HorizontalContainer from '../HorizontalContainer';
import { RequiredTextProps } from './types';

/**
 * Текст с красной звездочкой справа
 */
const RequiredText: FC<RequiredTextProps> = ({ children, ...props }) => {
  return (
    <HorizontalContainer space="2xs">
      <Text {...props}>{children}</Text>
      <Text size="l" weight="semibold" className={styles.alertText}>
        *
      </Text>
    </HorizontalContainer>
  );
};

export default RequiredText;
