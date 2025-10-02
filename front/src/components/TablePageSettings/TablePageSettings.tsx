import { FC, useRef, useState } from 'react';
import { Text } from '@consta/uikit/Text';
import styles from './TablePageSettings.module.scss';
import { Radio } from '@consta/uikit/Radio';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { TablePageSettingsProps } from './types';
import VerticalContainer from '../VerticalContainer';
import HorizontalContainer from '../HorizontalContainer';
import TableHeaderButton from '../TableHeaderButton';
import { IconArrowLeft } from '../../assets/icon/iconArrowLeft';
import { IconArrowRight } from '../../assets/icon/iconArrowRight';
import ContextModal from '../ContextModal';

const limitOptions = [10, 20, 50, 100];

/**
 * Кнопка в заголовке таблицы
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

  const firstPageIndex = fullLength === 0 ? 0 : page * limit + 1;
  const lastPageIndex = Math.min(firstPageIndex + limit - 1, fullLength);
  const pageInfoText = `${firstPageIndex}-${lastPageIndex} ${t('components.classicTable.tableHeader.outOf.label')} ${fullLength}`;
  const isBackDisabled = page === 0;
  const isNextDisabled = firstPageIndex + limit - 1 >= fullLength;

  // Обработчики
  const handlePageInfoTextClick = () => {
    setIsOpenContextModal((prevState) => !prevState);
  };

  // render методы
  const renderModalContent = () => (
    <VerticalContainer space="5xl">
      <Text>{t('components.classicTable.tableHeader.showBy.label')}</Text>
      <VerticalContainer space="s">
        {limitOptions.map((option) => (
          <Radio
            key={option}
            label={String(option)}
            checked={limit === option}
            onClick={() => onLimitChange(option)}
          />
        ))}
      </VerticalContainer>
    </VerticalContainer>
  );

  const renderNavigationButtons = () => (
    <>
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
          size="m"
          onlyIcon
          tooltipText={t('components.classicTable.tableHeader.previousPage.tooltip.text')}
          iconLeft={IconArrowLeft as any}
          onClick={onBackClick}
        />
        <TableHeaderButton
          disabled={isNextDisabled}
          size="m"
          onlyIcon
          tooltipText={t('components.classicTable.tableHeader.nextPage.tooltip.text')}
          iconLeft={IconArrowRight as any}
          onClick={onNextClick}
        />
      </HorizontalContainer>
    </>
  );

  const renderContextModal = () => (
    <ContextModal
      isOpen={isOpenContextModal}
      align="right"
      className={styles.TablePageSettingsContextModal}
      currentRef={pageButtonRef}
      onClickOutside={() => setIsOpenContextModal(false)}
    >
      {renderModalContent()}
    </ContextModal>
  );

  return (
    <HorizontalContainer space="2xs" align="center">
      {renderNavigationButtons()}
      {renderContextModal()}
    </HorizontalContainer>
  );
};

export default TablePageSettings;
