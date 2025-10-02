import { errorHandler, NotificationType } from '../handlers';
import { createSlice, isRejected, PayloadAction } from '@reduxjs/toolkit';
import { getProductMatrixThunk } from './thunk';
import { ProductMatrixItem, ProductMatrixUi } from '../../types/serverInterface/ProductMatrixDTO';
import { toProductMatrixUi } from './helpers';
import { SaleWorkflowStatus } from '../../types/enums/SaleWorkflowStatus';

const createInitialWorkflowState = () => ({
  workflowId: null as string | null,
  cellNumber: null as number | null,
});

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
  activeWorkflow: ReturnType<typeof createInitialWorkflowState>;
};

const initialState: ClientState = {
  productMatrix: {
    state: [],
    isLoading: false,
    isReject: false,
  },
  productCellMap: {},
  saleWorkflowStatus: SaleWorkflowStatus.Idle,
  notifications: [],
  activeWorkflow: createInitialWorkflowState(),
};

const addNotification = (state: ClientState) => (notification: NotificationType) => {
  const arr = [...state.notifications];
  arr.push(notification);

  state.notifications = arr;
};

const clientSlice = createSlice({
  name: 'client',
  initialState,
  reducers: {
    beginSaleWorkflow: (
      state,
      action: PayloadAction<{ workflowId: string; cellNumber: number }>,
    ) => {
      state.activeWorkflow = {
        workflowId: action.payload.workflowId,
        cellNumber: action.payload.cellNumber,
      };
      state.saleWorkflowStatus = SaleWorkflowStatus.AwaitingCard;
    },
    updateSaleWorkflowStatus: (
      state,
      action: PayloadAction<{ workflowId: string; status: SaleWorkflowStatus }>,
    ) => {
      if (state.activeWorkflow.workflowId !== action.payload.workflowId) {
        return;
      }

      state.saleWorkflowStatus = action.payload.status;
    },
    resetSaleWorkflowState: (state) => {
      state.saleWorkflowStatus = SaleWorkflowStatus.Idle;
      state.activeWorkflow = createInitialWorkflowState();
    },
  },
  extraReducers: (builder) => {
    builder.addCase(getProductMatrixThunk.pending, (state) => {
      state.productMatrix.isLoading = true;
      state.productMatrix.isReject = false;
    });

    builder.addCase(getProductMatrixThunk.rejected, (state) => {
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

    builder.addMatcher(isRejected(), (state, action) => {
      errorHandler(action)(addNotification(state));
    });
  },
});

export const {
  beginSaleWorkflow,
  updateSaleWorkflowStatus,
  resetSaleWorkflowState,
} = clientSlice.actions;

export const clientReducer = clientSlice.reducer;



