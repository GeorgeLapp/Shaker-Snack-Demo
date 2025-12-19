import { configureStore } from '@reduxjs/toolkit';
import { clientReducer } from '../state/client/slice';
import { serviceMenuReducer } from '../state/serviceMenu/slice';

export const store = configureStore({
  devTools: true,

  reducer: {
    client: clientReducer,
    serviceMenu: serviceMenuReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
