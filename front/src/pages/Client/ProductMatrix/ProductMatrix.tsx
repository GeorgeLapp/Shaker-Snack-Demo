import React, { FC, useState } from 'react';
import styles from './ProductMatrix.module.scss';
import { useAppDispatch, useAppSelector } from '../../../app/hooks/store';
import { selectProductMatrix } from '../../../state/client/selectors';
import { Loader } from '@consta/uikit/Loader';
import { Text } from '@consta/uikit/Text';
import HorizontalContainer from '../../../components/HorizontalContainer';
import VerticalContainer from '../../../components/VerticalContainer';
import classNames from 'classnames';
import { useNavigate } from 'react-router-dom';
import ClientHeader from '../ClientHeader';
import { IconArrowLeft } from '../../../assets/icon/iconArrowLeft';
import { Button } from '@consta/uikit/Button';
import { getOpenSettingsAction } from '../../../state/serviceMenu/action';
import AuthorizationModal from '../../Service/ServiceMenu/AuthorizationModal';

/**
 * Матрица продуктов в меню покупки
 */
const ProductMatrix: FC = () => {
  const navigate = useNavigate();

  const dispatch = useAppDispatch();

  const { state: productMatrix, isLoading, isReject } = useAppSelector(selectProductMatrix());

  const [isPasswordMenuOpen, setIsPasswordMenuOpen] = useState<boolean>(false);

  // Обработчики
  const handleProductClick = (productId: number) => () => {
    navigate(`/product/${productId}`);
  };

  const handleArrowClick = () => {
    dispatch(getOpenSettingsAction());

    setIsPasswordMenuOpen(true);
  };

  const handlePasswordMenuClose = () => {
    setIsPasswordMenuOpen(false);
  };

  // render методы
  const renderLoading = () => <Loader />;

  const renderError = () => (
    <Text size="6xl" align="center">
      Ошибка
    </Text>
  );

  const renderEmpty = () => (
    <Text size="6xl" align="center">
      Нет продуктов
    </Text>
  );

  const renderProductCell = ({ id, imgPath, cellNumber, price }: any) => (
    <VerticalContainer
      key={id}
      className={styles.productCell}
      space="2xs"
      align="center"
      onClick={handleProductClick(id)}
    >
      <HorizontalContainer className={styles.imgWrapper} justify="center">
        <img className={styles.img} src={imgPath} alt={`Продукт №${cellNumber}`} />
      </HorizontalContainer>

      <VerticalContainer space={0} isAutoWidth>
        <HorizontalContainer className={styles.badge} justify="center">
          <Text size="m" weight="semibold">{`№${cellNumber}`}</Text>
        </HorizontalContainer>

        <HorizontalContainer
          className={classNames(styles.badge, styles.badgeFilled)}
          justify="center"
        >
          <Text className={styles.text} size="l" weight="semibold">
            {`${price} ₽`}
          </Text>
        </HorizontalContainer>
      </VerticalContainer>
    </VerticalContainer>
  );

  const renderProductRow = (rowCells: any[]) => (
    <HorizontalContainer className={styles.productRow} space="xs">
      {rowCells.map(renderProductCell)}
    </HorizontalContainer>
  );

  const renderMatrix = () => (
    <VerticalContainer space="xs">
      {productMatrix?.map((row, index) => (
        <React.Fragment key={index}>{renderProductRow(row)}</React.Fragment>
      ))}
    </VerticalContainer>
  );

  const renderRightSide = () => (
    <Button
      iconSize="l"
      view="secondary"
      size="l"
      onlyIcon
      iconLeft={IconArrowLeft}
      onClick={handleArrowClick}
    />
  );

  const renderModal = () => (
    <AuthorizationModal isOpen={isPasswordMenuOpen} onClose={handlePasswordMenuClose} />
  );

  if (isLoading) return renderLoading();

  if (isReject) return renderError();

  if (!productMatrix || productMatrix.length === 0) return renderEmpty();

  return (
    <VerticalContainer className={styles.ProductMatrix} space="m">
      <ClientHeader renderRightSide={renderRightSide} />
      {renderMatrix()}
      {renderModal()}
    </VerticalContainer>
  );
};

export default ProductMatrix;
