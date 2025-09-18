import { Routes, Route } from "react-router-dom";
import Guard from "./components/Guard";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Guard />}>
        <Route path="/" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<div className="p-6">Not found</div>} />
    </Routes>
  );
}
