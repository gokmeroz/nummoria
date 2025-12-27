/* eslint-disable no-unused-vars */
// frontend/src/admin/pages/AdminUserDetailPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminGetUserById } from "../lib/adminApi";

const BORDER = "1px solid rgba(148,163,184,0.15)";
const BORDER_SOFT = "1px solid rgba(148,163,184,0.12)";
const BG_SOFT = "rgba(148,163,184,0.06)";
const TEXT_MUTED = "rgba(148,163,184,0.85)";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "security", label: "Security" },
  { key: "subscription", label: "Subscription" },
  { key: "support", label: "Support Notes" },
  { key: "activity", label: "Activity" },
];

export default function AdminUserDetailPage() {
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);

  // NEW: tab state
  const [activeTab, setActiveTab] = useState("overview");

  // NEW: small UX helpers
  const [toast, setToast] = useState("");

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

  // Reset tab when switching users
  useEffect(() => {
    setActiveTab("overview");
  }, [id]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const userId = user?._id || user?.id || id;

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.name || "(no name)";
  }, [user]);

  const email = user?.email || "";

  const providers = useMemo(() => {
    if (!user) return [];
    const p = [];
    if (user.googleId) p.push("Google");
    if (user.githubId) p.push("GitHub");
    if (user.twitterId) p.push("Twitter/X");
    if (p.length === 0) p.push("Password");
    return p;
  }, [user]);

  async function copyToClipboard(value, label) {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      setToast(`${label} copied`);
    } catch (e) {
      setToast("Copy failed");
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

          <div>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>
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
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actionRow}>
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
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Error</div>
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
              <Section title="Overview">
                <Grid>
                  <Row label="User ID" value={userId} />
                  <Row label="Name" value={user.name} />
                  <Row label="Email" value={user.email} />
                  <Row label="Role" value={user.role} />
                  <Row label="Subscription" value={user.subscription} />
                  <Row label="Providers" value={providers.join(", ")} />
                  <Row label="Active" value={user.isActive ? "Yes" : "No"} />
                  <Row
                    label="Email verified"
                    value={user.isEmailVerified ? "Yes" : "No"}
                  />
                  <Row
                    label="Last login"
                    value={formatDateTime(user.lastLogin)}
                  />
                  <Row label="Created" value={formatDateTime(user.createdAt)} />
                  <Row label="TZ" value={user.tz} />
                  <Row label="Base currency" value={user.baseCurrency} />
                  <Row label="Profession" value={user.profession || "-"} />
                </Grid>

                <Divider />

                <Callout title="Next additions">
                  Accounts • Transactions • Imports • Admin notes • Actions
                  (disable, role change, resend verification) will appear here
                  once the backend endpoints are added.
                </Callout>
              </Section>
            ) : null}

            {activeTab === "security" ? (
              <Section title="Security & Identity">
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
                  <Row
                    label="Google ID"
                    value={user.googleId ? "Present" : "-"}
                  />
                  <Row
                    label="GitHub ID"
                    value={user.githubId ? "Present" : "-"}
                  />
                  <Row
                    label="Twitter/X ID"
                    value={user.twitterId ? "Present" : "-"}
                  />
                </Grid>

                <Divider />

                <Callout title="Planned actions (backend needed)">
                  Resend verification • Force logout • Password reset assist •
                  Disable account with reason • Security flags.
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

                <Callout title="Planned actions (backend needed)">
                  Upgrade/downgrade plan • Cancel/extend • Billing history (if
                  you add it) • Entitlements.
                </Callout>
              </Section>
            ) : null}

            {activeTab === "support" ? (
              <Section title="Support Notes">
                <Callout title="What we will add here">
                  Internal notes per user, with author + timestamp, searchable.
                  This is the backbone of a support console.
                </Callout>

                {/* Placeholder UI for notes list */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, color: TEXT_MUTED }}>
                    No notes yet (backend not connected).
                  </div>

                  <div style={styles.noteComposer}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      Add internal note (future)
                    </div>
                    <textarea
                      disabled
                      placeholder="Add a note… (requires backend endpoint)"
                      style={styles.textareaDisabled}
                    />
                    <button disabled style={styles.btnDisabled}>
                      Save note
                    </button>
                  </div>
                </div>
              </Section>
            ) : null}

            {activeTab === "activity" ? (
              <Section title="Activity">
                <Callout title="What we will add here">
                  Admin audit trail (who changed what), user activity summary
                  (last seen, imports, transactions created), and debug signals.
                </Callout>

                <Divider />

                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                    Raw user payload (debug)
                  </summary>
                  <pre style={styles.pre}>{JSON.stringify(user, null, 2)}</pre>
                </details>
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
      <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 14 }}>
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
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function formatDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

function pill(kind) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
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
    fontWeight: 800,
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
    fontWeight: 800,
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
    fontWeight: 800,
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
  noteComposer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: BORDER,
    background: "rgba(148,163,184,0.04)",
  },
  textareaDisabled: {
    width: "100%",
    minHeight: 90,
    resize: "vertical",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.20)",
    padding: 10,
    outline: "none",
    opacity: 0.7,
    background: "transparent",
    marginBottom: 10,
  },
  btnDisabled: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "transparent",
    cursor: "not-allowed",
    opacity: 0.6,
    fontWeight: 800,
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
};
