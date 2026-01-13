import { createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../app/api';
import { ProductMatrixDTO } from '../../types/serverInterface/ProductMatrixDTO';
import { StartSaleDTO, StartSaleRes } from '../../types/serverInterface/StartSaleDTO';
import { IssueProductDTO, IssueProductRes } from '../../types/serverInterface/IssueProductDTO';

/**
 * Получение матрицы продуктов
 */
export type ProductMatrixOptions = {
  cacheBust?: string | number;
};

export const getProductMatrixThunk = createAsyncThunk<
  ProductMatrixDTO,
  ProductMatrixOptions | undefined
>('getProductMatrix', async (options) => {
  return await api.client.getProductMatrix(options);
});

export const startSaleThunk = createAsyncThunk<StartSaleRes, StartSaleDTO>(
  'startSale',
  async (startSaleData) => {
    return await api.client.startSale(startSaleData);
  },
);

export const issueProductThunk = createAsyncThunk<IssueProductRes, IssueProductDTO>(
  'issueProduct',
  async (issueProductData) => {
    return await api.client.issueProduct(issueProductData);
  },
);
