import api from "./api";

export const googleLoginApi = (token) =>
  api.post("/auth/google-login", { token });

export const sendOtpApi = (phone) => api.post("/auth/send-otp", { phone });

export const verifyOtpApi = (payload) => api.post("/auth/verify-otp", payload);
