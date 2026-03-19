import { useState, useEffect } from "react";
import { sendOtpApi, verifyOtpApi } from "../../Api/authApi";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setAuth } from "../../store/authSlice";

export default function Register() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const tempUser = JSON.parse(localStorage.getItem("tempUser"));

  useEffect(() => {
    const token = localStorage.getItem("accessToken");

    // ✅ If already logged in → projects
    if (token) {
      navigate("/projects", { replace: true });
      return;
    }

    // ✅ If no temp user → back to login
    if (!tempUser) {
      navigate("/login", { replace: true });
    }
  }, []);

  async function sendOtp() {
    await sendOtpApi(phone);
    setOtpSent(true);
  }

  async function verifyOtp() {
    const res = await verifyOtpApi({ phone, otp, tempUser });

    // 🔐 Store tokens
    localStorage.setItem("accessToken", res.data.accessToken);
    localStorage.setItem("refreshToken", res.data.refreshToken);
    localStorage.removeItem("tempUser");

    // 🧠 Update global auth state
    dispatch(
      setAuth({
        user: res.data.user,
      }),
    );

    // ✅ ALWAYS GO TO PROJECTS
    navigate("/projects", { replace: true });
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow border w-[320px]">
        <h2 className="text-lg font-semibold mb-4">Register</h2>

        {!otpSent ? (
          <>
            <input
              className="w-full border p-2 rounded mb-3"
              placeholder="Phone number"
              onChange={(e) => setPhone(e.target.value)}
            />
            <button
              className="w-full bg-black text-white p-2 rounded"
              onClick={sendOtp}
            >
              Send OTP
            </button>
          </>
        ) : (
          <>
            <input
              className="w-full border p-2 rounded mb-3"
              placeholder="Enter OTP"
              onChange={(e) => setOtp(e.target.value)}
            />
            <button
              className="w-full bg-black text-white p-2 rounded"
              onClick={verifyOtp}
            >
              Verify OTP
            </button>
          </>
        )}
      </div>
    </div>
  );
}
