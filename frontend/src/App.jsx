import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AddCar from "./pages/AddCar";
import SearchCar from "./pages/SearchCar";
import UserManagement from "./pages/UserManagement";
import { isAdminUser } from "./utils/auth";

function AdminRoute({ children }) {
  if (!isAdminUser()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/add-car" element={<AddCar />} />

        <Route path="/search" element={<SearchCar />} />

        <Route
          path="/users"
          element={
            <AdminRoute>
              <UserManagement />
            </AdminRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
