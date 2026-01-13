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
  const locationPathRef = useRef(location.pathname);
  const serviceMenuExitPendingRef = useRef(location.pathname.startsWith('/menu'));

  useEffect(() => {
    dispatch(getProductMatrixAction());
  }, [dispatch]);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    const wasServiceMenu = prevPath.startsWith('/menu');
    const isServiceMenu = location.pathname.startsWith('/menu');
    const refreshKey = (
      location.state as { refreshProductMatrix?: number | string } | null
    )?.refreshProductMatrix;

    if (isServiceMenu) {
      serviceMenuExitPendingRef.current = true;
    }

    if (wasServiceMenu && !isServiceMenu) {
      dispatch(
        getProductMatrixAction(
          refreshKey === undefined || refreshKey === null
            ? undefined
            : { cacheBust: refreshKey },
        ),
      );
      serviceMenuExitPendingRef.current = false;
    }

    prevPathRef.current = location.pathname;
    locationPathRef.current = location.pathname;
  }, [dispatch, location.pathname, location.state]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState !== 'visible') return;
      if (!serviceMenuExitPendingRef.current) return;
      if (locationPathRef.current.startsWith('/menu')) return;

      dispatch(getProductMatrixAction());
      serviceMenuExitPendingRef.current = false;
    };

    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [dispatch]);

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
