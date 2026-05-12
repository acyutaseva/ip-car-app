import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Header from "../components/Header";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <Navbar />
      <Header title="Dashboard" />

      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={() => navigate("/add-car")}
          className="surface-panel rounded-3xl p-6 text-left transition hover:-translate-y-0.5"
        >
          <p className="text-sm uppercase tracking-[0.16em] text-slate-500">Create</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">➕ Add Car</p>
        </button>

        <button
          onClick={() => navigate("/search")}
          className="surface-panel rounded-3xl p-6 text-left transition hover:-translate-y-0.5"
        >
          <p className="text-sm uppercase tracking-[0.16em] text-slate-500">Lookup</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">🔍 Search Car</p>
        </button>
      </div>
    </div>
  );
}
