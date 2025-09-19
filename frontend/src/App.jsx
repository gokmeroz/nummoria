import { Routes, Route } from "react-router-dom";
import Guard from "./components/Guard";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import UserPage from "./pages/User";

export default function App() {
  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  const me = { name: "Göktuğ Mert Özdoğan" }; // later fetch from /me

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes inside Layout */}
      <Route element={<Guard />}>
        <Route element={<Layout me={me} onLogout={handleLogout} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/user" element={<UserPage />} />
          {/* add more: expenses, income, etc. */}
        </Route>
      </Route>

      <Route path="*" element={<div className="p-6">Not found</div>} />
    </Routes>
  );
}
