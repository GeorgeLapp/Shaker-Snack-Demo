import React, { FC, useState } from 'react';
import ClientHeader from '../ClientHeader';
import VerticalContainer from '../../../components/VerticalContainer';
import styles from './Product.module.scss';
import { useAppSelector } from '../../../app/hooks/store';
import { selectProductCellById } from '../../../state/client/selectors';
import { useNavigate, useParams } from 'react-router-dom';
import { Text } from '@consta/uikit/Text';
import { Button } from '@consta/uikit/Button';
import { IconArrowLeft } from '../../../assets/icon/iconArrowLeft';
import classNames from 'classnames';
import HorizontalContainer from '../../../components/HorizontalContainer';
import SaleWorkflow from './SaleWorkflow';

/**
 * Страница продукта
 */
const Product: FC = () => {
  const navigate = useNavigate();

  const { cellId } = useParams<{ cellId: string }>();
  const formattedCellId = Number(cellId) || null;

  const cell = useAppSelector(selectProductCellById(formattedCellId));

  const [isOpenSaleWorkflow, setIsOpenSaleWorkflow] = useState<boolean>(false);

  if (!cell) return <Text size="6xl">Ячейка не найдена</Text>;

  // render методы
  const renderGeneralCard = () => (
    <VerticalContainer className={classNames(styles.card, styles.general)} space={0}>
      <HorizontalContainer
        className={styles.imgWrapper}
        justify="center"
        align="center"
        isAutoWidth
      >
        <img className={styles.img} src={cell.imgPath} />
      </HorizontalContainer>
      <HorizontalContainer justify="center" className={styles.textWrapper}>
        <Text size="3xl" weight="semibold">{`${cell.brandName} ${cell.productName}`}</Text>
      </HorizontalContainer>
    </VerticalContainer>
  );

  const renderInfoItem = (title: string, value: string) => (
    <VerticalContainer space={0} className={styles.infoItem}>
      <Text size="xl" view="secondary">
        {title}
      </Text>
      <Text size="xl">{value}</Text>
    </VerticalContainer>
  );

  const renderInfoCard = () => (
    <VerticalContainer className={styles.card} space={0}>
      <HorizontalContainer justify="center" className={styles.cardTitle}>
        <Text size="2xl">Пищевая ценность на 100 г</Text>
      </HorizontalContainer>
      <HorizontalContainer className={styles.cardContent} isAutoSpace>
        {typeof cell.calories === 'number' && renderInfoItem('Энергия', `${cell.calories} ккал`)}
        {typeof cell.proteins === 'number' && renderInfoItem('Белки', `${cell.proteins} г`)}
        {typeof cell.fats === 'number' && renderInfoItem('Жиры', `${cell.fats} г`)}
        {typeof cell.calories === 'number' && renderInfoItem('Углеводы', `${cell.calories} г`)}
      </HorizontalContainer>
    </VerticalContainer>
  );

  const renderDescriptionCard = () => (
    <VerticalContainer className={styles.card} space={0}>
      <HorizontalContainer justify="center" className={styles.cardTitle}>
        <Text size="2xl">Состав</Text>
      </HorizontalContainer>
      <HorizontalContainer className={styles.cardContent} isAutoSpace>
        <Text size="xl">{cell.description}</Text>
      </HorizontalContainer>
    </VerticalContainer>
  );

  const renderAction = () => (
    <div className={styles.actionWrapper}>
      <HorizontalContainer
        className={styles.actionBackground}
        align="center"
        justify="center"
        isAutoWidth
      >
        <HorizontalContainer
          className={styles.saleButton}
          align="center"
          justify="center"
          isAutoWidth
          onClick={() => setIsOpenSaleWorkflow(true)}
        >
          <Text className={styles.text} size="4xl" weight="semibold">
            {`Оплатить ${cell.price} ₽`}
          </Text>
        </HorizontalContainer>
      </HorizontalContainer>
    </div>
  );

  const renderLeftSideHeader = () => (
    <Button
      className={styles.back}
      iconSize="l"
      view="secondary"
      size="l"
      onlyIcon
      iconLeft={IconArrowLeft}
      onClick={() => navigate('/')}
    />
  );

  return (
    <VerticalContainer className={styles.Product} space="m">
      <div className={styles.header}>
        <ClientHeader renderLeftSide={renderLeftSideHeader} />
      </div>
      <div className={styles.content}>
        <VerticalContainer space="2xl">
          {renderGeneralCard()}
          {renderInfoCard()}
          {renderDescriptionCard()}
        </VerticalContainer>
      </div>
      {renderAction()}
      {isOpenSaleWorkflow && (
        <SaleWorkflow cell={cell} onClose={() => setIsOpenSaleWorkflow(false)} />
      )}
    </VerticalContainer>
  );
};

export default Product;
