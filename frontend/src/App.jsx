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
import Goodbye from "./pages/GoodBye";
import FinancialHelper from "./pages/FinancialAdvisor";
import About from "./pages/About";
import Docs from "./pages/Docs";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Status from "./pages/Status";
import VerifyEmail from "./pages/VerifyEmail";
import SubscriptionManager from "./pages/SubscriptionManager";

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
          <Route path="/ai/financial-helper" element={<FinancialHelper />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/subscription" element={<SubscriptionManager />} />
        </Route>
      </Route>
      <Route path="/goodbye" element={<Goodbye />} />
      <Route path="*" element={<ErrorPage />} />
      <Route path="/about-us" element={<About />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/contact" element={<Contact />} />,
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/status" element={<Status />} />
    </Routes>
  );
}
