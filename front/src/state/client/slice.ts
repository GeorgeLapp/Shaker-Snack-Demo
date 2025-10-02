import { errorHandler, NotificationType } from '../handlers';
import { createSlice, isRejected } from '@reduxjs/toolkit';
import { getProductMatrixThunk, issueProductThunk, startSaleThunk } from './thunk';
import { ProductMatrixItem, ProductMatrixUi } from '../../types/serverInterface/ProductMatrixDTO';
import { toProductMatrixUi } from './helpers';
import { SaleWorkflowStatus } from '../../types/enums/SaleWorkflowStatus';

type StateItemType<T> = {
  state: T extends [] ? T : T | null;
  isLoading: boolean;
  isReject: boolean;
};

export type ClientState = {
  productMatrix: StateItemType<ProductMatrixUi>;
  productCellMap: Record<number, ProductMatrixItem>;
  saleWorkflowStatus: SaleWorkflowStatus;
  notifications: NotificationType[];
};

const initialState: ClientState = {
  productMatrix: {
    state: [],
    isLoading: false,
    isReject: false,
  },
  productCellMap: {},
  saleWorkflowStatus: SaleWorkflowStatus.AwaitingCard,
  notifications: [],
};

/**
 * Добавление уведомления
 *
 * @param state состояние
 * @param notification новое уведомление
 */
const addNotification = (state: ClientState) => (notification: NotificationType) => {
  const arr = [...state.notifications];
  arr.push(notification);

  state.notifications = arr;
};

export const clientSlice = createSlice({
  name: 'client',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // getProductMatrixThunk
    builder.addCase(getProductMatrixThunk.pending, (state, action) => {
      state.productMatrix.isLoading = true;
      state.productMatrix.isReject = false;
    });

    builder.addCase(getProductMatrixThunk.rejected, (state, action) => {
      state.productMatrix.isLoading = false;
      state.productMatrix.isReject = true;
    });

    builder.addCase(getProductMatrixThunk.fulfilled, (state, action) => {
      state.productMatrix.isLoading = false;
      state.productMatrix.state = toProductMatrixUi(action.payload);
      state.productCellMap = action.payload.reduce<Record<number, ProductMatrixItem>>(
        (map, item) => {
          map[item.id] = item;
          return map;
        },
        {},
      );
    });

    // startSaleThunk
    builder.addCase(startSaleThunk.pending, (state) => {
      state.saleWorkflowStatus = SaleWorkflowStatus.AwaitingCard;
    });

    builder.addCase(startSaleThunk.rejected, (state) => {
      state.saleWorkflowStatus = SaleWorkflowStatus.PaymentFailed;
    });

    builder.addCase(startSaleThunk.fulfilled, (state) => {
      state.saleWorkflowStatus = SaleWorkflowStatus.Dispensing;
    });

    // issueProductThunk
    builder.addCase(issueProductThunk.pending, (state) => {
      state.saleWorkflowStatus = SaleWorkflowStatus.Dispensing;
    });

    builder.addCase(issueProductThunk.rejected, (state) => {
      state.saleWorkflowStatus = SaleWorkflowStatus.DispenseFailed;
    });

    builder.addCase(issueProductThunk.fulfilled, (state) => {
      state.saleWorkflowStatus = SaleWorkflowStatus.Dispensed;
    });

    builder.addMatcher(isRejected(), (state, action) => {
      errorHandler(action)(addNotification(state));
    });
  },
});

export const clientReducer = clientSlice.reducer;
