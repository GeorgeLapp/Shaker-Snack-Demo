import { AppDispatch, RootState } from '../../app/store';
import { getProductMatrixThunk, issueProductThunk, startSaleThunk } from './thunk';
import { IssueProductDTO } from '../../types/serverInterface/IssueProductDTO';
import { StartSaleDTO } from '../../types/serverInterface/StartSaleDTO';
import {
  beginSaleWorkflow,
  resetSaleWorkflowState,
  updateSaleWorkflowStatus,
} from './slice';
import { SaleWorkflowStatus } from '../../types/enums/SaleWorkflowStatus';

const MIN_PAYMENT_STAGE_DURATION_MS = 5000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createWorkflowId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isWorkflowActive = (state: RootState, workflowId: string) =>
  state.client.activeWorkflow.workflowId === workflowId;

const ensurePaymentStageDuration = async (startedAt: number) => {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_PAYMENT_STAGE_DURATION_MS) {
    await sleep(MIN_PAYMENT_STAGE_DURATION_MS - elapsed);
  }
};

export const getProductMatrixAction = () => (dispatch: AppDispatch) =>
  dispatch(getProductMatrixThunk());

export const cancelSaleWorkflow = () => (dispatch: AppDispatch) => {
  dispatch(resetSaleWorkflowState());
};

export const startSaleWorkflow =
  (data: IssueProductDTO & StartSaleDTO) => async (dispatch: AppDispatch, getState: () => RootState) => {
    const workflowId = createWorkflowId();

    dispatch(beginSaleWorkflow({ workflowId, cellNumber: data.cellNumber }));

    try {
      await dispatch(startSaleThunk(data)).unwrap();
    } catch (error) {
      if (isWorkflowActive(getState(), workflowId)) {
        dispatch(updateSaleWorkflowStatus({ workflowId, status: SaleWorkflowStatus.PaymentFailed }));
      }
      return;
    }

    if (!isWorkflowActive(getState(), workflowId)) {
      return;
    }

    dispatch(updateSaleWorkflowStatus({ workflowId, status: SaleWorkflowStatus.PaymentSuccess }));
    const paymentStageStartedAt = Date.now();

    try {
      await dispatch(issueProductThunk(data)).unwrap();
      await ensurePaymentStageDuration(paymentStageStartedAt);
      if (!isWorkflowActive(getState(), workflowId)) {
        return;
      }
      dispatch(updateSaleWorkflowStatus({ workflowId, status: SaleWorkflowStatus.Dispensed }));
    } catch (error) {
      await ensurePaymentStageDuration(paymentStageStartedAt);
      if (!isWorkflowActive(getState(), workflowId)) {
        return;
      }
      dispatch(updateSaleWorkflowStatus({ workflowId, status: SaleWorkflowStatus.DispenseFailed }));
    }
  };
