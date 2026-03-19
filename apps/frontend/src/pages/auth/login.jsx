import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import GoogleButton from "../../components/GoogleButton";

export default function Login() {
  const navigate = useNavigate();

  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/projects", { replace: true });
    }
  }, [isAuthenticated]);

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow border">
        <h2 className="text-lg font-semibold mb-4">Login</h2>
        <GoogleButton />
      </div>
    </div>
  );
}
