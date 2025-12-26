// frontend/src/admin/components/AdminLayout.jsx
import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

export default function AdminLayout() {
  const loc = useLocation();

  const isActive = (path) =>
    loc.pathname === path || loc.pathname.startsWith(path + "/");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 260,
          padding: 16,
          borderRight: "1px solid rgba(148,163,184,0.15)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Admin Console</div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link
            to="/admin/users"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              textDecoration: "none",
              color: "inherit",
              background: isActive("/admin/users")
                ? "rgba(148,163,184,0.10)"
                : "transparent",
            }}
          >
            Users
          </Link>
        </nav>

        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
          Backend-enforced RBAC.
        </div>
      </aside>

      <main style={{ flex: 1, padding: 20 }}>
        <Outlet />
      </main>
    </div>
  );
}
