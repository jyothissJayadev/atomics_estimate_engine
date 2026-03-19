import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import storage from "redux-persist/lib/storage";
import { persistReducer, persistStore } from "redux-persist";
import tabsReducer from "./tabsSlice";
import projectsReducer from "./projectsSlice";

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["auth", "tabs", "projects"], // 👈 ADD tabs and projects
};

const rootReducer = combineReducers({
  auth: authReducer,
  tabs: tabsReducer,
  projects: projectsReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);
export const dispatch = store.dispatch;
