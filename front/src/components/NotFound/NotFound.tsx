import React from 'react';
import { IconSearch } from '../../assets/icon/IconSearch';
import VerticalContainer from '../VerticalContainer';
import { Text } from '@consta/uikit/Text';
import styles from './NotFound.module.scss';
import { NotFoundProps } from './types';

/**
 * Компонент для отображения ненайденных данных
 */
const NotFound = ({ label, description }: NotFoundProps) => {
  return (
    <>
      <div className={styles.ellipse}>
        <IconSearch size="m" className={styles.iconSearch} />
      </div>
      <VerticalContainer space="s" align="center">
        <Text size="2xl" weight="semibold" view="primary">
          {label}
        </Text>
        {description && <Text size="l">{description}</Text>}
      </VerticalContainer>
    </>
  );
};

export default NotFound;
