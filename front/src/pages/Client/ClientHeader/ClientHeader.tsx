import { FC } from 'react';
import { IconLogoShaker } from '../../../assets/icon/iconLogo';
import HorizontalContainer from '../../../components/HorizontalContainer';
import styles from './ClientHeader.module.scss';
import { ClientHeaderProps } from './types';

const defaultRenderMethod = () => <div />;

const ClientHeader: FC<ClientHeaderProps> = ({
  renderLeftSide = defaultRenderMethod,
  renderRightSide = defaultRenderMethod,
}) => {
  console.log('renderLeftSide, ', renderLeftSide());

  return (
    <HorizontalContainer className={styles.ClientHeader}>
      {renderLeftSide()}
      <IconLogoShaker className={styles.icon} />
      {renderRightSide()}
    </HorizontalContainer>
  );
};

export default ClientHeader;
