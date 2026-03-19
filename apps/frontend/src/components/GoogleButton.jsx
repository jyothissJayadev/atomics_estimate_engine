import { GoogleLogin } from "@react-oauth/google";
import { googleLoginApi } from "../Api/authApi";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setAuth } from "../store/authSlice";

export default function GoogleButton() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  async function handleSuccess(res) {
    if (!res.credential) return;

    const result = await googleLoginApi(res.credential);

    if (result.data.status === "LOGIN_SUCCESS") {
      localStorage.setItem("accessToken", result.data.accessToken);
      localStorage.setItem("refreshToken", result.data.refreshToken);

      dispatch(setAuth({ user: result.data.user }));
      navigate("/projects", { replace: true });
    }

    if (result.data.status === "NEW_USER") {
      localStorage.setItem("tempUser", JSON.stringify(result.data.tempUser));
      navigate("/register", { replace: true });
    }
  }

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => console.error("Google Login Failed")}
    />
  );
}
