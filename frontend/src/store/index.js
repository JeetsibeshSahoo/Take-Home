import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;