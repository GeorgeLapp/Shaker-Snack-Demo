import { configureStore } from '@reduxjs/toolkit';
import { clientReducer } from '../state/client/slice';

export const store = configureStore({
  devTools: true,

  reducer: {
    client: clientReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
