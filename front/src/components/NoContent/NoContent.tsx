import { FC } from 'react';
import { IconNoContent } from '../../assets/icon/iconNoContent';
import styles from './NoContent.module.scss';

const NoContent: FC = () => {
  return (
    <div className={styles.noContent}>
      <IconNoContent className={styles.icon} />
    </div>
  );
};

export default NoContent;
