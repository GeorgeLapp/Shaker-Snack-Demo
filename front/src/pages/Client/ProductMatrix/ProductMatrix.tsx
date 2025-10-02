import React, { FC, useState } from 'react';
import styles from './ProductMatrix.module.scss';
import { useAppSelector } from '../../../app/hooks/store';
import { selectProductMatrix } from '../../../state/client/selectors';
import { Loader } from '@consta/uikit/Loader';
import { Text } from '@consta/uikit/Text';
import HorizontalContainer from '../../../components/HorizontalContainer';
import VerticalContainer from '../../../components/VerticalContainer';
import classNames from 'classnames';
import { useNavigate } from 'react-router-dom';
import ClientHeader from '../ClientHeader';

const ProductMatrix: FC = () => {
  const navigate = useNavigate();

  const { state: productMatrix, isLoading, isReject } = useAppSelector(selectProductMatrix());

  // Обработчики
  const handleProductClick = (productId: number) => () => {
    navigate(`/product/${productId}`);
  };

  if (isLoading) {
    return <Loader />;
  }

  if (isReject) {
    return <Text size="6xl">Ошибка</Text>;
  }

  if (!productMatrix) {
    return <Text size="6xl">Нет продуктов</Text>;
  }

  return (
    <VerticalContainer className={styles.ProductMatrix} space="m">
      <ClientHeader />
      <VerticalContainer space="xs">
        {productMatrix.map((rowCells) => (
          <HorizontalContainer className={styles.ProductRow} space="xs">
            {rowCells.map(({ id, imgPath, cellNumber, price }) => (
              <VerticalContainer
                key={id}
                className={styles.ProductCell}
                space="2xs"
                align="center"
                onClick={handleProductClick(id)}
              >
                <HorizontalContainer className={styles.imgWrapper} justify="center">
                  <img className={styles.img} src={imgPath} />
                </HorizontalContainer>
                <VerticalContainer space={0} isAutoWidth>
                  <HorizontalContainer className={styles.badge} justify="center">
                    <Text size="m" weight="semibold">{`№${cellNumber}`}</Text>
                  </HorizontalContainer>
                  <HorizontalContainer
                    className={classNames(styles.badge, styles.badgeFilled)}
                    justify="center"
                  >
                    <Text className={styles.text} size="l" weight="semibold">{`${price} ₽`}</Text>
                  </HorizontalContainer>
                </VerticalContainer>
              </VerticalContainer>
            ))}
          </HorizontalContainer>
        ))}
      </VerticalContainer>
    </VerticalContainer>
  );
};

export default ProductMatrix;
