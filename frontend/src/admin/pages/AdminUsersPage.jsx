// frontend/src/admin/pages/AdminUsersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom"; // NEW
import { adminSearchUsers } from "../lib/adminApi";

export default function AdminUsersPage() {
  const navigate = useNavigate(); // NEW

  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const [page, setPage] = useState(1);
  const limit = 20;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState({ total: 0, pages: 0, items: [] });

  const canPrev = page > 1;
  const canNext = data.pages ? page < data.pages : data.items.length === limit;

  // Basic debounce to avoid spamming backend on every keypress
  const debouncedQ = useDebouncedValue(q, 300);

  // NEW: logout handler
  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("defaultId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setErr("");

      try {
        const res = await adminSearchUsers({
          q: debouncedQ,
          page,
          limit,
          includeInactive,
        });

        if (!mounted) return;
        setData({
          total: res.total ?? 0,
          pages: res.pages ?? 0,
          items: res.items ?? [],
        });
      } catch (e) {
        if (!mounted) return;
        setErr(e?.response?.data?.message || "Failed to load users.");
        setData({ total: 0, pages: 0, items: [] });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [debouncedQ, page, includeInactive]);

  // Reset to page 1 when query/filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, includeInactive]);

  const headerRight = useMemo(() => {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
          }}
        >
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Include inactive
        </label>

        {/* NEW: Logout button */}
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.45)",
            background: "rgba(239,68,68,0.08)",
            color: "#b91c1c",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    );
  }, [includeInactive]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Users</h2>
        {headerRight}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email, name, or userId…"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.25)",
            outline: "none",
          }}
        />

        <button
          onClick={() => {
            setQ("");
            setIncludeInactive(false);
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
        {loading ? "Loading…" : `Results: ${data.total}`}
      </div>

      {err ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.35)",
          }}
        >
          {err}
        </div>
      ) : null}

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
          }}
        >
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Plan</Th>
              <Th>Email verified</Th>
              <Th>Active</Th>
              <Th>Last login</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u._id}>
                <Td>
                  <Link
                    to={`/admin/users/${u._id}`}
                    style={{ textDecoration: "none" }}
                  >
                    {u.name || "(no name)"}
                  </Link>
                </Td>
                <Td>{u.email}</Td>
                <Td>{u.role}</Td>
                <Td>{u.subscription}</Td>
                <Td>{u.isEmailVerified ? "Yes" : "No"}</Td>
                <Td>{u.isActive ? "Yes" : "No"}</Td>
                <Td>{formatDate(u.lastLogin)}</Td>
                <Td>{formatDate(u.createdAt)}</Td>
              </tr>
            ))}

            {!loading && data.items.length === 0 ? (
              <tr>
                <Td colSpan={8} style={{ opacity: 0.8 }}>
                  No users found.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <button
          disabled={!canPrev || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          style={pagerBtnStyle(!canPrev || loading)}
        >
          Prev
        </button>

        <div style={{ fontSize: 14, opacity: 0.85 }}>
          Page {page}
          {data.pages ? ` / ${data.pages}` : ""}
        </div>

        <button
          disabled={!canNext || loading}
          onClick={() => setPage((p) => p + 1)}
          style={pagerBtnStyle(!canNext || loading)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* ───────── helpers ───────── */

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 10px",
        borderBottom: "1px solid rgba(148,163,184,0.2)",
        fontSize: 12,
        opacity: 0.85,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, ...props }) {
  return (
    <td
      {...props}
      style={{
        padding: "10px 10px",
        borderBottom: "1px solid rgba(148,163,184,0.12)",
        fontSize: 14,
        verticalAlign: "top",
        ...props.style,
      }}
    >
      {children}
    </td>
  );
}

function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function pagerBtnStyle(disabled) {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
