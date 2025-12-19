import { FC } from 'react';
import { IconLogoShaker } from '../../../assets/icon/iconLogo';
import HorizontalContainer from '../../../components/HorizontalContainer';
import styles from './ClientHeader.module.scss';
import { ClientHeaderProps } from './types';

const defaultRenderMethod = () => null;

/**
 * Клиентский заголовок
 */
const ClientHeader: FC<ClientHeaderProps> = ({
  renderLeftSide = defaultRenderMethod,
  renderRightSide = defaultRenderMethod,
}) => {
  return (
    <HorizontalContainer className={styles.ClientHeader} align="center">
      <HorizontalContainer className={styles.sideLeft} justify="start">
        {renderLeftSide()}
      </HorizontalContainer>
      <HorizontalContainer className={styles.center} justify="center">
        <IconLogoShaker className={styles.icon} />
      </HorizontalContainer>
      <HorizontalContainer className={styles.sideRight} justify="end">
        {renderRightSide()}
      </HorizontalContainer>
    </HorizontalContainer>
  );
};

export default ClientHeader;
