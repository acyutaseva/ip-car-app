import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const handleLogin = async () => {
    try {
      const res = await API.post("/auth/login", form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("userRole", res.data.user.role);
      navigate("/dashboard");
    } catch (error) {
      alert("Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="surface-panel w-full max-w-sm rounded-3xl p-6 md:max-w-md md:p-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 md:text-slate-500">
          Car Registry
        </p>

        <h1 className="mb-6 mt-2 text-center text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          Welcome Back
        </h1>

        <input
          type="text"
          placeholder="Username"
          className="mb-4 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900"
          onChange={(e) =>
            setForm({
              ...form,
              username: e.target.value,
            })
          }
        />

        <input
          type="password"
          placeholder="Password"
          className="mb-4 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900"
          onChange={(e) =>
            setForm({
              ...form,
              password: e.target.value,
            })
          }
        />

        <button
          onClick={handleLogin}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 p-3 font-semibold text-white shadow-lg shadow-blue-300/50 transition hover:-translate-y-0.5 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600"
        >
          Login
        </button>
      </div>
    </div>
  );
}
