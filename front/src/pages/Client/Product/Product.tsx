import React, { FC, useState } from 'react';
import ClientHeader from '../ClientHeader';
import VerticalContainer from '../../../components/VerticalContainer';
import styles from './Product.module.scss';
import { useAppSelector } from '../../../app/hooks/store';
import { selectProductCellById, selectSaleWorkflowStatus } from '../../../state/client/selectors';
import { useNavigate, useParams } from 'react-router-dom';
import { Text } from '@consta/uikit/Text';
import { Button } from '@consta/uikit/Button';
import { IconArrowLeft } from '../../../assets/icon/iconArrowLeft';
import classNames from 'classnames';
import HorizontalContainer from '../../../components/HorizontalContainer';
import SaleWorkflow from './SaleWorkflow';
import { SaleWorkflowStatus } from '../../../types/enums/SaleWorkflowStatus';

const Product: FC = () => {
  const { cellId } = useParams<{ cellId: string }>();
  const formattedCellId = Number(cellId) || null;
  const navigate = useNavigate();

  const cell = useAppSelector(selectProductCellById(formattedCellId));
  const saleWorkflowStatus = useAppSelector(selectSaleWorkflowStatus());

  const [isOpenSaleWorkflow, setIsOpenSaleWorkflow] = useState<boolean>(false);

  if (!cell) return <Text size="6xl">РЇС‡РµР№РєР° РЅРµ РЅР°Р№РґРµРЅР°</Text>;

  const renderGeneralCard = () => (
    <VerticalContainer className={classNames(styles.card, styles.general)} space={0}>
      <HorizontalContainer className={styles.imgWrapper} justify="center">
        <img className={styles.img} src={cell.imgPath} />
      </HorizontalContainer>
      <HorizontalContainer justify="center">
        <Text size="3xl" weight="semibold">{`${cell.brandName} ${cell.productName}`}</Text>
      </HorizontalContainer>
    </VerticalContainer>
  );

  const renderInfoItem = (title: string, value: string) => (
    <VerticalContainer space={0}>
      <Text size="xl" view="secondary">
        {title}
      </Text>
      <Text size="xl">{value}</Text>
    </VerticalContainer>
  );

  const renderInfoCard = () => (
    <VerticalContainer className={styles.card} space={0}>
      <HorizontalContainer className={styles.cardTitle}>
        <Text size="2xl">РџРёС‰РµРІР°СЏ С†РµРЅРЅРѕСЃС‚СЊ РЅР° 100 Рі</Text>
      </HorizontalContainer>
      <HorizontalContainer className={styles.cardContent} isAutoSpace>
        {typeof cell.calories === 'number' && renderInfoItem('Р­РЅРµСЂРіРёСЏ', `${cell.calories} РєРєР°Р»`)}
        {typeof cell.proteins === 'number' && renderInfoItem('Р‘РµР»РєРё', `${cell.proteins} Рі`)}
        {typeof cell.fats === 'number' && renderInfoItem('Р–РёСЂС‹', `${cell.fats} Рі`)}
        {typeof cell.calories === 'number' && renderInfoItem('РЈРіР»РµРІРѕРґС‹', `${cell.calories} Рі`)}
      </HorizontalContainer>
    </VerticalContainer>
  );

  const renderDescriptionCard = () => (
    <div className={styles.card}>
      <HorizontalContainer className={styles.cardTitle}>
        <Text size="2xl">РЎРѕСЃС‚Р°РІ</Text>
      </HorizontalContainer>
      <HorizontalContainer className={styles.cardContent} isAutoSpace>
        <Text size="xl">{cell.description}</Text>
      </HorizontalContainer>
    </div>
  );

  const renderAction = () => (
    <HorizontalContainer className={styles.actionBackground} align="center" justify="center">
      <HorizontalContainer
        className={styles.saleButton}
        align="center"
        justify="center"
        onClick={() => setIsOpenSaleWorkflow(true)}
      >
        <Text className={styles.text} size="4xl" weight="semibold">
          {`РћРїР»Р°С‚РёС‚СЊ ${cell.price} в‚Ѕ`}
        </Text>
      </HorizontalContainer>
    </HorizontalContainer>
  );

  return (
    <VerticalContainer className={styles.Product} space="m">
      <ClientHeader
        renderLeftSide={() => (
          <Button
            className={styles.back}
            iconSize="l"
            view="secondary"
            size="l"
            onlyIcon
            iconLeft={IconArrowLeft}
            onClick={() => navigate('/')}
          />
        )}
      />
      <VerticalContainer space="2xl">
        {renderGeneralCard()}
        {renderInfoCard()}
        {renderDescriptionCard()}
        <div className={styles.actionSpacer} />
      </VerticalContainer>
      {renderAction()}
      {isOpenSaleWorkflow && (
        <SaleWorkflow
          cell={cell}
          onClose={() => {
            setIsOpenSaleWorkflow(false);
            if (saleWorkflowStatus === SaleWorkflowStatus.Dispensed) {
              navigate('/');
            }
          }}
        />
      )}
    </VerticalContainer>
  );
};

export default Product;





