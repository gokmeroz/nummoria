/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
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
import IncomesScreen from "./pages/Income";
import InvestmentsScreen from "./pages/Investments";
import InvestmentPerformances from "./pages/InvestmentPerformances";
import ReportsPage from "./pages/Reports";
import SupportPage from "./pages/Support";
import OAuthCallback from "./pages/OAuthCallback";

export default function App() {
  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  const myDefaultUserId = localStorage.getItem("defaultId");
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes inside Layout */}
      <Route element={<Guard />}>
        <Route element={<Layout onLogout={handleLogout} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/user" element={<UserPage />} />
          <Route
            path="/expenses"
            element={<ExpensesScreen accountId={myDefaultUserId} />}
          />
          <Route
            path="/incomes"
            element={<IncomesScreen accountId={myDefaultUserId} />}
          />
          <Route
            path="/investments"
            element={<InvestmentsScreen accountId={myDefaultUserId} />}
          />
          <Route path="/reports" element={<ReportsPage />}></Route>
          <Route
            path="/investments/performance"
            element={<InvestmentPerformances />}
          ></Route>
          <Route path="/support" element={<SupportPage />}></Route>
          <Route path="/oauth-callback" element={<OAuthCallback />} />

          {/* add more: expenses, income, etc. */}
        </Route>
      </Route>

      <Route path="*" element={<ErrorPage />} />
      {/* <Route path="/error" element={<Footer />} /> */}
    </Routes>
  );
}
