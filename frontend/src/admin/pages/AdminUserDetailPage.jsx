// frontend/src/admin/pages/AdminUserDetailPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminGetUserById } from "../lib/adminApi";

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setErr("");

      try {
        const data = await adminGetUserById(id);
        const u = data?.user ?? data;

        if (!mounted) return;
        setUser(u);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.response?.data?.message || "Failed to load user.");
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link to="/admin/users" style={{ textDecoration: "none" }}>
          ← Back
        </Link>
        <h2 style={{ margin: 0 }}>User</h2>
      </div>

      {loading ? (
        <div style={{ marginTop: 12, opacity: 0.85 }}>Loading…</div>
      ) : null}

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

      {!loading && user ? (
        <div style={{ marginTop: 12 }}>
          <Section title="Overview">
            <Grid>
              <Row label="Name" value={user.name} />
              <Row label="Email" value={user.email} />
              <Row label="Role" value={user.role} />
              <Row label="Subscription" value={user.subscription} />
              <Row label="Active" value={user.isActive ? "Yes" : "No"} />
              <Row
                label="Email verified"
                value={user.isEmailVerified ? "Yes" : "No"}
              />
              <Row label="Last login" value={formatDate(user.lastLogin)} />
              <Row label="Created" value={formatDate(user.createdAt)} />
              <Row label="TZ" value={user.tz} />
              <Row label="Base currency" value={user.baseCurrency} />
              <Row label="Profession" value={user.profession || "-"} />
            </Grid>
          </Section>

          <div style={{ marginTop: 14, opacity: 0.8, fontSize: 13 }}>
            Next: Accounts / Transactions / Imports tabs once backend endpoints
            are added.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid rgba(148,163,184,0.15)",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10 }}>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <>
      <div style={{ opacity: 0.75, fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value ?? "-"}</div>
    </>
  );
}

function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString();
}
