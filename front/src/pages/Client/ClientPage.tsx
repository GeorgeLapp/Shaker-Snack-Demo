import React, { FC, useEffect, useRef } from 'react';
import ProductMatrix from './ProductMatrix';
import styles from './ClientPage.module.scss';
import { Route, Routes, useLocation } from 'react-router-dom';
import Product from './Product';
import { useAppDispatch } from '../../app/hooks/store';
import { getProductMatrixAction } from '../../state/client/action';
import ServiceMenu from '../Service/ServiceMenu';
import CellsControl from '../Service/ServiceMenu/CellsControl';
import ChangeCellsControlProducts from '../Service/ServiceMenu/CellsControl/CellsControlProducts/ChangeCellsControlProducts';
import CellsDiagnostics from '../Service/ServiceMenu/CellsDiagnostics';

/**
 * Страница покупателя
 */
const ClientPage: FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    dispatch(getProductMatrixAction());
  }, [dispatch]);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    const wasServiceMenu = prevPath.startsWith('/menu');
    const isServiceMenu = location.pathname.startsWith('/menu');

    if (wasServiceMenu && !isServiceMenu) {
      dispatch(getProductMatrixAction());
    }

    prevPathRef.current = location.pathname;
  }, [dispatch, location.pathname]);

  return (
    <div className={styles.ClientPage}>
      <Routes>
        <Route path="/product/:cellId" element={<Product />} />
        <Route path="/*" element={<ProductMatrix />} />
        <Route path="/menu" element={<ServiceMenu />} />
        <Route path="/menu/diagnostics" element={<CellsDiagnostics />} />
        <Route path="/menu/cellControl" element={<CellsControl />} />
        <Route path="/menu/cellControl/changeProducts" element={<ChangeCellsControlProducts />} />
      </Routes>
    </div>
  );
};

export default ClientPage;
