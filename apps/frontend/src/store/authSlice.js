import { createSlice } from "@reduxjs/toolkit";

const storedUser = localStorage.getItem("user");

const initialState = {
  user: storedUser ? JSON.parse(storedUser) : null,
  isAuthenticated: !!storedUser,
  loading: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(state, action) {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.loading = false;

      // ✅ persist user
      localStorage.setItem("user", JSON.stringify(action.payload.user));
    },

    clearAuth(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;

      // ✅ clear persisted user
      localStorage.removeItem("user");
    },

    finishAuthCheck(state) {
      state.loading = false;
    },
  },
});

export const { setAuth, clearAuth, finishAuthCheck } = authSlice.actions;
export default authSlice.reducer;
