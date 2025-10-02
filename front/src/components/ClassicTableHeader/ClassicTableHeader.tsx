import styles from './ClassicTableHeader.module.scss';
import TablePageSettings from './TableHeaderButton/TablePageSettings';
import { Checkbox } from '@consta/uikit/Checkbox';
import HorizontalContainer from '../HorizontalContainer';
import classNames from 'classnames';
import { ClassicTableHeaderProps } from './types';

/**
 * Шапка таблицы
 */
const ClassicTableHeader = <T extends Record<string, any>, K extends keyof T>(
  props: ClassicTableHeaderProps<T, K>,
) => {
  return (
    <div className={styles.ClassicTableHeader}>
      <HorizontalContainer space="m">
        {props.withCheckbox && (
          <div className={styles.checkboxContainer}>
            <Checkbox checked={false} />
          </div>
        )}
        {props.withHeaderActions ? props.renderTableHeadActions() : <div />}
      </HorizontalContainer>
      {props.withPageSetting && <TablePageSettings {...props} />}
    </div>
  );
};

export default ClassicTableHeader;
