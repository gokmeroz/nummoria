/* eslint-disable no-unused-vars */
// frontend/src/admin/pages/AdminUserDetailPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  adminGetUserById,
  adminDeactivateUser,
  adminReactivateUser,
  adminHardDeleteUser, // NEW: Phase 1
  adminResendVerification,
  adminForceLogout,
  adminSendPasswordReset,
} from "../lib/adminApi";

const BORDER = "1px solid rgba(148,163,184,0.15)";
const BORDER_SOFT = "1px solid rgba(148,163,184,0.12)";
const BG_SOFT = "rgba(148,163,184,0.06)";
const TEXT_MUTED = "rgba(148,163,184,0.85)";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "security", label: "Security" },
  { key: "subscription", label: "Subscription" },
  { key: "activity", label: "Activity" },
];

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);

  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState("");

  const [actionLoading, setActionLoading] = useState({
    deactivate: false,
    reactivate: false,
    hardDelete: false,
    // NEW:
    resendVerification: false,
    forceLogout: false,
    sendPasswordReset: false,
  });

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

  useEffect(() => {
    setActiveTab("overview");
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const userId = user?._id || user?.id || id;
  const email = user?.email || "";
  const isActive = user?.isActive !== false;

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.name || "(no name)";
  }, [user]);

  const providers = useMemo(() => {
    if (!user) return [];
    const p = [];
    if (user.googleId) p.push("Google");
    if (user.githubId) p.push("GitHub");
    if (user.twitterId) p.push("Twitter/X");
    if (p.length === 0) p.push("Password");
    return p;
  }, [user]);

  const avatarUrl = user?.avatarUrl || "";

  async function copyToClipboard(value, label) {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      setToast(`${label} copied`);
    } catch (e) {
      setToast("Copy failed");
    }
  }

  async function onDeactivate() {
    if (!userId) return;

    const ok = window.confirm(
      "Deactivate this user?\n\nThey will be prevented from using the app until reactivated."
    );
    if (!ok) return;

    try {
      setActionLoading((s) => ({ ...s, deactivate: true }));
      setErr("");

      const res = await adminDeactivateUser(userId);
      const updated = res?.user ?? res;

      setUser((prev) => ({
        ...(prev || {}),
        ...(updated || {}),
        isActive: false,
      }));
      setToast("User deactivated");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to deactivate user.");
    } finally {
      setActionLoading((s) => ({ ...s, deactivate: false }));
    }
  }

  async function onReactivate() {
    if (!userId) return;

    const ok = window.confirm("Reactivate this user?");
    if (!ok) return;

    try {
      setActionLoading((s) => ({ ...s, reactivate: true }));
      setErr("");

      const res = await adminReactivateUser(userId);
      const updated = res?.user ?? res;

      setUser((prev) => ({
        ...(prev || {}),
        ...(updated || {}),
        isActive: true,
      }));
      setToast("User reactivated");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to reactivate user.");
    } finally {
      setActionLoading((s) => ({ ...s, reactivate: false }));
    }
  }

  async function onHardDelete() {
    if (!userId) return;

    const expected = (email || "DELETE").trim();
    const typed = window.prompt(
      `Permanently delete this user?\n\nThis cannot be undone.\n\nType exactly: ${expected}`
    );

    if (!typed) return;
    if (typed.trim() !== expected) {
      setToast("Confirmation text did not match");
      return;
    }

    const ok = window.confirm(
      "Last confirmation: This will permanently delete the user record. Continue?"
    );
    if (!ok) return;

    try {
      setActionLoading((s) => ({ ...s, hardDelete: true }));
      setErr("");

      await adminHardDeleteUser(userId);

      setToast("User permanently deleted");
      navigate("/admin/users", { replace: true });
    } catch (e) {
      setErr(
        e?.response?.data?.message || "Failed to permanently delete user."
      );
    } finally {
      setActionLoading((s) => ({ ...s, hardDelete: false }));
    }
  }
  async function onResendVerification() {
    if (!userId) return;

    const ok = window.confirm(
      "Resend email verification code to this user?\n\nOnly works if the user is NOT verified."
    );
    if (!ok) return;

    try {
      setActionLoading((s) => ({ ...s, resendVerification: true }));
      setErr("");
      await adminResendVerification(userId);
      setToast("Verification code resent");
    } catch (e) {
      setErr(
        e?.response?.data?.message || "Failed to resend verification code."
      );
    } finally {
      setActionLoading((s) => ({ ...s, resendVerification: false }));
    }
  }

  async function onForceLogout() {
    if (!userId) return;

    const ok = window.confirm(
      "Force logout this user everywhere?\n\nTheir current sessions will become invalid."
    );
    if (!ok) return;

    try {
      setActionLoading((s) => ({ ...s, forceLogout: true }));
      setErr("");
      await adminForceLogout(userId);
      setToast("User logged out everywhere");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to force logout user.");
    } finally {
      setActionLoading((s) => ({ ...s, forceLogout: false }));
    }
  }

  async function onSendPasswordReset() {
    if (!userId) return;

    const ok = window.confirm(
      "Send password reset email to this user?\n\nUse this when the user cannot access their account."
    );
    if (!ok) return;

    try {
      setActionLoading((s) => ({ ...s, sendPasswordReset: true }));
      setErr("");
      await adminSendPasswordReset(userId);
      setToast("Password reset email sent");
    } catch (e) {
      setErr(
        e?.response?.data?.message || "Failed to send password reset email."
      );
    } finally {
      setActionLoading((s) => ({ ...s, sendPasswordReset: false }));
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={styles.headerRow}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/admin/users" style={styles.backLink}>
            ← Back
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <AvatarCircle name={displayName} avatarUrl={avatarUrl} />

            <div>
              <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.15 }}>
                {displayName}
              </div>

              <div style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 2 }}>
                {email || "—"}{" "}
                {user?.role ? (
                  <span style={pill(user.role === "admin" ? "admin" : "user")}>
                    {user.role}
                  </span>
                ) : null}
                {user?.isActive === false ? (
                  <span style={pill("inactive")}>inactive</span>
                ) : (
                  <span style={pill("active")}>active</span>
                )}
                {user?.isEmailVerified ? (
                  <span style={pill("verified")}>email verified</span>
                ) : (
                  <span style={pill("unverified")}>email unverified</span>
                )}
              </div>

              <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 6 }}>
                <span style={{ marginRight: 10 }}>
                  Created: <b>{formatDateTime(user?.createdAt)}</b>
                </span>
                <span style={{ marginRight: 10 }}>
                  Last login: <b>{formatDateTime(user?.lastLogin)}</b>
                </span>
                <span style={{ opacity: 0.9 }}>
                  ({timeAgo(user?.lastLogin)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={styles.actionRow}>
          {/* NEW: Phase 1 actions */}
          {user?.isEmailVerified ? null : (
            <button
              onClick={onResendVerification}
              disabled={actionLoading.resendVerification || loading}
              style={styles.actionBtn}
              title="Resend verification code"
            >
              {actionLoading.resendVerification
                ? "Resending…"
                : "Resend Verification"}
            </button>
          )}

          <button
            onClick={onForceLogout}
            disabled={actionLoading.forceLogout || loading}
            style={styles.actionBtn}
            title="Force logout user everywhere"
          >
            {actionLoading.forceLogout ? "Forcing…" : "Force Logout"}
          </button>

          <button
            onClick={onSendPasswordReset}
            disabled={actionLoading.sendPasswordReset || loading}
            style={styles.actionBtn}
            title="Send password reset email"
          >
            {actionLoading.sendPasswordReset
              ? "Sending…"
              : "Send Password Reset"}
          </button>

          <button
            onClick={() => copyToClipboard(userId, "User ID")}
            style={styles.actionBtn}
            disabled={!userId}
            title="Copy user id"
          >
            Copy ID
          </button>

          <button
            onClick={() => copyToClipboard(email, "Email")}
            style={styles.actionBtn}
            disabled={!email}
            title="Copy email"
          >
            Copy Email
          </button>

          <button
            onClick={() => copyToClipboard(avatarUrl, "Avatar URL")}
            style={styles.actionBtn}
            disabled={!avatarUrl}
            title="Copy avatar URL"
          >
            Copy Avatar URL
          </button>

          <a
            href={email ? `mailto:${email}` : undefined}
            style={{
              ...styles.actionBtn,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: email ? "auto" : "none",
              opacity: email ? 1 : 0.5,
            }}
            title="Open mail client"
          >
            Email User
          </a>
        </div>
      </div>

      {toast ? (
        <div style={styles.toast}>
          <div style={{ fontSize: 13 }}>{toast}</div>
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 12, opacity: 0.85 }}>Loading…</div>
      ) : null}

      {err ? (
        <div style={styles.errorBox}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Error</div>
          <div>{err}</div>
        </div>
      ) : null}

      {!loading && user ? (
        <>
          {/* Tabs */}
          <div style={styles.tabs}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={tabBtn(activeTab === t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ marginTop: 12 }}>
            {activeTab === "overview" ? (
              <div style={styles.twoCol}>
                <Section title="User Profile">
                  <Grid>
                    <Row label="User ID" value={userId} />
                    <Row label="Name" value={user.name} />
                    <Row label="Email" value={user.email} />
                    <Row label="Role" value={user.role} />
                    <Row label="Subscription" value={user.subscription} />
                    <Row label="Profession" value={user.profession || "-"} />
                    <Row label="TZ" value={user.tz || "-"} />
                    <Row
                      label="Base currency"
                      value={user.baseCurrency || "-"}
                    />
                  </Grid>
                </Section>

                <Section title="Account Health">
                  <Grid>
                    <Row label="Active" value={user.isActive ? "Yes" : "No"} />
                    <Row
                      label="Email verified"
                      value={user.isEmailVerified ? "Yes" : "No"}
                    />
                    <Row
                      label="Verified at"
                      value={formatDateTime(user.emailVerifiedAt)}
                    />
                    <Row label="Providers" value={providers.join(", ")} />
                    <Row
                      label="Avatar"
                      value={
                        avatarUrl ? (
                          <a href={avatarUrl} target="_blank" rel="noreferrer">
                            Open avatar
                          </a>
                        ) : (
                          "-"
                        )
                      }
                    />
                  </Grid>

                  <Divider />

                  <div style={styles.dangerZone}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>
                      Danger zone
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {isActive ? (
                        <button
                          onClick={onDeactivate}
                          disabled={actionLoading.deactivate || loading}
                          style={styles.dangerBtnSoft}
                        >
                          {actionLoading.deactivate
                            ? "Deactivating…"
                            : "Deactivate"}
                        </button>
                      ) : (
                        <button
                          onClick={onReactivate}
                          disabled={actionLoading.reactivate || loading}
                          style={styles.successBtnSoft}
                        >
                          {actionLoading.reactivate
                            ? "Reactivating…"
                            : "Reactivate"}
                        </button>
                      )}

                      <button
                        onClick={onHardDelete}
                        disabled={actionLoading.hardDelete || loading}
                        style={styles.dangerBtnHard}
                      >
                        {actionLoading.hardDelete ? "Deleting…" : "Hard Delete"}
                      </button>
                    </div>

                    <div
                      style={{ marginTop: 10, fontSize: 12, color: TEXT_MUTED }}
                    >
                      Hard delete is blocked server-side unless user is
                      inactive. Admin users are protected from hard delete.
                    </div>
                  </div>
                </Section>

                <Section title="Identifiers (debug)">
                  <Grid>
                    <Row
                      label="Google ID"
                      value={user.googleId ? maskId(user.googleId) : "-"}
                    />
                    <Row
                      label="GitHub ID"
                      value={user.githubId ? maskId(user.githubId) : "-"}
                    />
                    <Row
                      label="Twitter/X ID"
                      value={user.twitterId ? maskId(user.twitterId) : "-"}
                    />
                    <Row
                      label="Avatar version"
                      value={user.avatarVersion ?? "-"}
                    />
                  </Grid>

                  <Divider />

                  <details>
                    <summary style={{ cursor: "pointer", fontWeight: 800 }}>
                      Raw user payload
                    </summary>
                    <pre style={styles.pre}>
                      {JSON.stringify(user, null, 2)}
                    </pre>
                  </details>
                </Section>
              </div>
            ) : null}

            {activeTab === "security" ? (
              <Section title="Security">
                <Grid>
                  <Row
                    label="Email verified"
                    value={user.isEmailVerified ? "Yes" : "No"}
                  />
                  <Row
                    label="Verified at"
                    value={formatDateTime(user.emailVerifiedAt)}
                  />
                  <Row
                    label="Last login"
                    value={formatDateTime(user.lastLogin)}
                  />
                  <Row label="Providers" value={providers.join(", ")} />
                </Grid>

                <Divider />

                <Callout title="Next (Phase 1)">
                  Add: resend verification, force logout, reset assist
                  (backend).
                </Callout>
              </Section>
            ) : null}

            {activeTab === "subscription" ? (
              <Section title="Subscription">
                <Grid>
                  <Row label="Plan" value={user.subscription || "Standard"} />
                  <Row
                    label="Active user"
                    value={user.isActive ? "Yes" : "No"}
                  />
                </Grid>

                <Divider />

                <Callout title="Next (Phase 2)">
                  Add: entitlements + billing history (if you track it).
                </Callout>
              </Section>
            ) : null}

            {activeTab === "activity" ? (
              <Section title="Activity">
                <Callout title="Next (Phase 2/3)">
                  Show: accounts, recent transactions, imports, admin audit log.
                </Callout>

                <Divider />

                <Grid>
                  <Row label="Created" value={formatDateTime(user.createdAt)} />
                  <Row
                    label="Last login"
                    value={formatDateTime(user.lastLogin)}
                  />
                </Grid>
              </Section>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ───────────────────────── components ───────────────────────── */

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={{ fontWeight: 900, marginBottom: 10, fontSize: 14 }}>
        {title}
      </div>
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
      <div style={{ fontSize: 14, wordBreak: "break-word" }}>
        {value ?? "-"}
      </div>
    </>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: "rgba(148,163,184,0.12)",
        margin: "14px 0",
      }}
    />
  );
}

function Callout({ title, children }) {
  return (
    <div style={styles.callout}>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
        {children}
      </div>
    </div>
  );
}

function AvatarCircle({ name, avatarUrl }) {
  const initials = useMemo(() => {
    const v = (name || "").trim();
    if (!v) return "?";
    const parts = v.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || "?";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase();
  }, [name]);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="avatar"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          objectFit: "cover",
          border: BORDER,
        }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        border: BORDER,
        background: "rgba(148,163,184,0.08)",
        display: "grid",
        placeItems: "center",
        fontWeight: 900,
      }}
      title="No avatar"
    >
      {initials}
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function maskId(v) {
  const s = String(v || "");
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function formatDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

function timeAgo(v) {
  if (!v) return "no activity";
  const d = new Date(v);
  const t = d.getTime();
  if (Number.isNaN(t)) return "unknown";
  const diff = Date.now() - t;
  if (diff < 0) return "in the future";

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function pill(kind) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    marginLeft: 8,
    border: BORDER_SOFT,
    background: "transparent",
    color: "inherit",
  };

  if (kind === "admin") return { ...base, background: "rgba(34,197,94,0.12)" };
  if (kind === "user") return { ...base, background: "rgba(148,163,184,0.10)" };
  if (kind === "active") return { ...base, background: "rgba(34,197,94,0.10)" };
  if (kind === "inactive")
    return { ...base, background: "rgba(239,68,68,0.10)" };
  if (kind === "verified")
    return { ...base, background: "rgba(34,197,94,0.10)" };
  if (kind === "unverified")
    return { ...base, background: "rgba(245,158,11,0.10)" };

  return base;
}

function tabBtn(active) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: active ? "1px solid rgba(148,163,184,0.30)" : BORDER,
    background: active ? "rgba(148,163,184,0.10)" : "transparent",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 900,
  };
}

const styles = {
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  backLink: {
    textDecoration: "none",
    fontWeight: 900,
    padding: "8px 10px",
    borderRadius: 10,
    border: BORDER,
  },
  actionRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  actionBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },

  toast: {
    position: "fixed",
    right: 18,
    bottom: 18,
    padding: "10px 12px",
    borderRadius: 12,
    border: BORDER,
    background: "rgba(2,6,23,0.92)",
    color: "white",
    zIndex: 999,
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.06)",
  },
  tabs: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  section: {
    border: BORDER,
    borderRadius: 14,
    padding: 14,
  },
  callout: {
    padding: 12,
    borderRadius: 12,
    border: BORDER,
    background: BG_SOFT,
  },
  pre: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    border: BORDER,
    background: "rgba(2,6,23,0.04)",
    overflowX: "auto",
    fontSize: 12,
    lineHeight: 1.45,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  dangerZone: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(239,68,68,0.18)",
    background: "rgba(239,68,68,0.05)",
  },

  dangerBtnSoft: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(239,68,68,0.45)",
    background: "rgba(239,68,68,0.08)",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  dangerBtnHard: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(239,68,68,0.65)",
    background: "rgba(239,68,68,0.16)",
    color: "#991b1b",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  successBtnSoft: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.45)",
    background: "rgba(34,197,94,0.10)",
    color: "#166534",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
};
