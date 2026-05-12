import { Link, useLocation, useNavigate } from "react-router-dom";
import { isAdminUser } from "../utils/auth";

const baseLinks = [
  { path: "/dashboard", label: "Home", icon: "🏠" },
  { path: "/add-car", label: "Add", icon: "➕" },
  { path: "/search", label: "Search", icon: "🔍" },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = isAdminUser();

  const links = isAdmin
    ? [...baseLinks, { path: "/users", label: "Users", icon: "👤" }]
    : baseLinks;

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    navigate("/");
  };

  return (
    <>
      <nav className="surface-panel sticky top-4 z-40 mb-6 hidden items-center justify-between rounded-3xl px-3 py-2 md:flex">
        <div className="flex items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                isActive(link.path)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {link.icon} {link.label}
            </Link>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="rounded-2xl bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800"
        >
          Logout
        </button>
      </nav>

      <nav className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-3xl border border-slate-700/50 bg-slate-900/95 px-2 py-2 shadow-2xl backdrop-blur md:hidden">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`flex min-w-14 flex-col items-center rounded-xl px-2 py-1 text-xs font-semibold transition ${
              isActive(link.path)
                ? "bg-white text-slate-900"
                : "text-slate-300"
            }`}
          >
            <span className="text-lg">{link.icon}</span>
            {link.label}
          </Link>
        ))}

        <button
          onClick={handleLogout}
          className="flex min-w-14 flex-col items-center rounded-xl px-2 py-1 text-xs font-semibold text-blue-200"
        >
          <span className="text-lg">🚪</span>
          Logout
        </button>
      </nav>
    </>
  );
}
