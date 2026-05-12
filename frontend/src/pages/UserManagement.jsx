import { useEffect, useState } from "react";
import API from "../services/api";
import Header from "../components/Header";
import Navbar from "../components/Navbar";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: "", password: "" });
  const [changePwd, setChangePwd] = useState({});

  const fetchUsers = async () => {
    const res = await API.get("/auth/users");
    setUsers(res.data.users);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async () => {
    await API.post("/auth/register", newUser);
    setNewUser({ username: "", password: "" });
    fetchUsers();
  };

  const handleDelete = async (id) => {
    await API.delete(`/auth/users/${id}`);
    fetchUsers();
  };

  const handleChangePassword = async (id) => {
    await API.post(`/auth/users/${id}/change-password`, { password: changePwd[id] });
    setChangePwd({ ...changePwd, [id]: "" });
    fetchUsers();
  };

  return (
    <div className="app-shell">
      <Navbar />
      <Header title="User Management" />

      <section className="surface-panel rounded-3xl p-4 md:p-6">
        <h2 className="mb-4 text-xl font-bold text-slate-900 md:text-2xl">Create User</h2>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
            placeholder="Username"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
          />
          <input
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
            placeholder="Password"
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
          />
          <button
            className="rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-700"
            onClick={handleAddUser}
          >
            Add User
          </button>
        </div>
      </section>

      <section className="surface-panel mt-5 overflow-hidden rounded-3xl p-2 md:p-4">
        <h2 className="px-2 py-3 text-xl font-bold text-slate-900">Users</h2>

        <div className="hidden md:block">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left text-sm text-slate-500">
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Username</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-semibold text-slate-700">#{user.id}</td>
                  <td className="px-3 py-3 text-slate-900">{user.username}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                        type="password"
                        placeholder="New password"
                        value={changePwd[user.id] || ""}
                        onChange={(e) => setChangePwd({ ...changePwd, [user.id]: e.target.value })}
                      />
                      <button
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white"
                        onClick={() => handleChangePassword(user.id)}
                      >
                        Change
                      </button>
                      <button
                        className="rounded-lg bg-slate-600 px-3 py-1.5 text-sm font-semibold text-white"
                        onClick={() => handleDelete(user.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-2 md:hidden">
          {users.map((user) => (
            <article
              key={user.id}
              className="rounded-2xl border border-slate-600/60 bg-slate-800/70 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">User #{user.id}</p>
              <p className="mb-3 mt-1 text-lg font-bold text-white">{user.username}</p>

              <input
                className="mb-2 w-full rounded-lg border border-slate-500 bg-slate-900 px-3 py-2 text-sm text-white"
                type="password"
                placeholder="New password"
                value={changePwd[user.id] || ""}
                onChange={(e) => setChangePwd({ ...changePwd, [user.id]: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => handleChangePassword(user.id)}
                >
                  Change
                </button>
                <button
                  className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => handleDelete(user.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default UserManagement;
