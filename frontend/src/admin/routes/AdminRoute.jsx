// frontend/src/admin/routes/AdminRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getMe } from "../lib/adminApi";

export default function AdminRoute() {
  const location = useLocation();
  const [state, setState] = useState({
    loading: true,
    isAuthed: false,
    isAdmin: false,
  });

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        const data = await getMe();

        // Support either {user: {...}} or direct user object
        const user = data?.user ?? data;

        const isAuthed = !!user?._id || !!user?.id || !!user?.email;
        const isAdmin = user?.role === "admin";

        if (!mounted) return;
        setState({ loading: false, isAuthed, isAdmin });
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        if (!mounted) return;
        setState({ loading: false, isAuthed: false, isAdmin: false });
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ opacity: 0.8 }}>Checking admin access…</div>
      </div>
    );
  }

  if (!state.isAuthed) {
    // If you have a dedicated login route, redirect there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!state.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
