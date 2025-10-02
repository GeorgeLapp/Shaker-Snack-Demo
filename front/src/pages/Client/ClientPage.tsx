import React, { FC, useEffect } from 'react';
import ProductMatrix from './ProductMatrix';
import styles from './ClientPage.module.scss';
import { Route, Routes } from 'react-router-dom';
import Product from './Product';
import { useAppDispatch } from '../../app/hooks/store';
import { getProductMatrixAction } from '../../state/client/action';

/**
 * Страница покупателя
 */
const ClientPage: FC = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(getProductMatrixAction());
  }, [dispatch]);

  return (
    <div className={styles.ClientPage}>
      <Routes>
        <Route path="/product/:cellId" element={<Product />} />
        <Route path="/*" element={<ProductMatrix />} />
      </Routes>
    </div>
  );
};

export default ClientPage;
