import { Routes, Route } from "react-router-dom";
import Guard from "./components/Guard";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import UserPage from "./pages/User";
import ErrorPage from "./pages/ErrorPage";
import ExpensesScreen from "./pages/Expenses";
import Footer from "./components/Footer";

export default function App() {
  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  const me = { name: "Göktuğ Mert Özdoğan" }; // later fetch from /me
  const myDefaultUserId = localStorage.getItem("defaultId");
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
          <Route
            path="/expenses"
            element={<ExpensesScreen accountId={myDefaultUserId} />}
          />
          {/* add more: expenses, income, etc. */}
        </Route>
      </Route>

      <Route path="*" element={<ErrorPage />} />
      {/* <Route path="/error" element={<Footer />} /> */}
    </Routes>
  );
}
