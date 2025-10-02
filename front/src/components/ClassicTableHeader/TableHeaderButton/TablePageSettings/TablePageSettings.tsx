import { FC, useRef, useState } from 'react';
import HorizontalContainer from '../../../HorizontalContainer';
import { Text } from '@consta/uikit/Text';
import TableHeaderButton from '../index';
import ContextModal from '../../../ContextModal';
import styles from './TablePageSettings.module.scss';
import VerticalContainer from '../../../VerticalContainer';
import { Radio } from '@consta/uikit/Radio';
import { IconArrowLeft } from '../../../../assets/icon/iconArrowLeft';
import { IconArrowRight } from '../../../../assets/icon/iconArrowRight';
import classNames from 'classnames';
import { TablePageSettingsProps } from '../../types';
import { useTranslation } from 'react-i18next';

/**
 * Настройка страниц таблицы
 */
const TablePageSettings: FC<TablePageSettingsProps> = ({
  fullLength,
  limit,
  page,
  onNextClick,
  onBackClick,
  onLimitChange,
}) => {
  const { t } = useTranslation();

  const [isOpenContextModal, setIsOpenContextModal] = useState(false);
  const pageButtonRef = useRef<HTMLDivElement>(null);

  const rawFirst = (page - 1) * limit + 1;
  const rawLast = Math.min(page * limit, fullLength);

  const firstPageIndex = fullLength === 0 ? 0 : rawFirst;
  const lastPageIndex = fullLength === 0 ? 0 : rawLast;
  const pageInfoText = `${firstPageIndex}-${lastPageIndex} ${t(
    'components.classicTable.tableHeader.outOf.label',
  )} ${fullLength}`;
  const isBackDisabled = firstPageIndex === 1;
  const isNextDisabled = firstPageIndex >= fullLength - limit;

  // Обработчики
  const handlePageInfoTextClick = () => {
    setIsOpenContextModal((prevState) => !prevState);
  };

  return (
    <HorizontalContainer space="xs" align="center">
      <div
        className={classNames(styles.pageButton, isOpenContextModal && styles.isOpen)}
        ref={pageButtonRef}
      >
        <Text className={styles.text} size="m" onClick={handlePageInfoTextClick}>
          {pageInfoText}
        </Text>
      </div>
      <HorizontalContainer space="3xs" align="center">
        <TableHeaderButton
          disabled={isBackDisabled}
          size="s"
          onlyIcon
          tooltipText={t('components.classicTable.tableHeader.previousPage.tooltip.text')}
          iconLeft={IconArrowLeft as any}
          onClick={onBackClick}
        />
        <TableHeaderButton
          disabled={isNextDisabled}
          size="s"
          onlyIcon
          tooltipText={t('components.classicTable.tableHeader.nextPage.tooltip.text')}
          iconLeft={IconArrowRight as any}
          onClick={onNextClick}
        />
      </HorizontalContainer>
      <ContextModal
        align="right"
        className={styles.TablePageSettingsContextModal}
        currentRef={pageButtonRef}
        onClickOutside={() => setIsOpenContextModal(false)}
        isOpen={isOpenContextModal}
      >
        <VerticalContainer space="5xl">
          <Text>{t('components.classicTable.tableHeader.showBy.label')}</Text>
          <VerticalContainer space="s">
            <Radio label="10" checked={limit === 10} onClick={() => onLimitChange(10)} />
            <Radio label="20" checked={limit === 20} onClick={() => onLimitChange(20)} />
            <Radio label="50" checked={limit === 50} onClick={() => onLimitChange(50)} />
            <Radio label="100" checked={limit === 100} onClick={() => onLimitChange(100)} />
          </VerticalContainer>
        </VerticalContainer>
      </ContextModal>
    </HorizontalContainer>
  );
};

export default TablePageSettings;
