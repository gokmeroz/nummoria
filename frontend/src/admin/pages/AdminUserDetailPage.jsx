/* eslint-disable no-unused-vars */
// frontend/src/admin/pages/AdminUserDetailPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  adminGetUserById,
  adminDeactivateUser,
  adminReactivateUser,
  adminHardDeleteUser,
  // Phase 1
  adminResendVerification,
  adminForceLogout,
  adminSendPasswordReset,
  // Accounts
  adminGetUserAccounts,
  adminUpdateUserSubscription,
  // NEW: notes + flags
  adminGetUserNotes,
  adminAddUserNote,
  adminUpdateUserFlags,
  adminGetUserActivity,
} from "../lib/adminApi";

const BORDER = "1px solid rgba(148,163,184,0.15)";
const BORDER_SOFT = "1px solid rgba(148,163,184,0.12)";
const BG_SOFT = "rgba(148,163,184,0.06)";
const TEXT_MUTED = "rgba(148,163,184,0.85)";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "accounts", label: "Accounts" },
  { key: "security", label: "Security" },
  { key: "subscription", label: "Subscription" },
  { key: "activity", label: "Activity" },
];

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);

  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState("");

  const [actionLoading, setActionLoading] = useState({
    deactivate: false,
    reactivate: false,
    hardDelete: false,
    resendVerification: false,
    forceLogout: false,
    sendPasswordReset: false,
    updateSubscription: false,
    // NEW
    saveFlags: false,
    addNote: false,
    loadNotes: false,
  });

  // NEW: notes + flags state
  const [notes, setNotes] = useState([]);
  const [notesErr, setNotesErr] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [flagsDraft, setFlagsDraft] = useState("");

  // ✅ Define derived IDs BEFORE effects that use them (prevents TDZ crash)
  const userId = user?._id || user?.id || id;
  const email = user?.email || "";
  const isActive = user?.isActive !== false;
  // ✅ NEW: activity state
  const [activityItems, setActivityItems] = useState([]);
  const [activityErr, setActivityErr] = useState("");
  const [activityCursor, setActivityCursor] = useState(null);
  const [activityHasMore, setActivityHasMore] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  // ✅ NEW: activity type filters
  const ACTIVITY_TYPES = useMemo(
    () => [
      { key: "flags_updated", label: "Flags" },
      { key: "note_added", label: "Notes" },
      { key: "user_deactivated", label: "Deactivate" },
      { key: "user_reactivated", label: "Reactivate" },
      { key: "force_logout", label: "Force logout" },
      { key: "password_reset_sent", label: "Password reset" },
      { key: "verification_resent", label: "Verification" },
      { key: "subscription_updated", label: "Subscription" },
      { key: "admin_event", label: "Other" },
    ],
    []
  );

  const [activitySelectedTypes, setActivitySelectedTypes] = useState([]);
  // Fetch accounts ONLY when Accounts tab is active
  useEffect(() => {
    if (activeTab !== "accounts") return;
    if (!id) return;

    let mounted = true;
    setAccountsLoading(true);

    adminGetUserAccounts(id)
      .then((res) => {
        if (!mounted) return;
        setAccounts(res?.accounts || []);
      })
      .catch(() => {
        if (!mounted) return;
        setAccounts([]);
      })
      .finally(() => {
        if (!mounted) return;
        setAccountsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeTab, id]);

  // Fetch user
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

        // NEW: seed flags input from user payload (safe)
        const flags = Array.isArray(u?.flags) ? u.flags : [];
        setFlagsDraft(flags.join(", "));
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
    setAccounts([]);
    setNotes([]);
    setNotesErr("");
    setNoteDraft("");
    //setFlagsDraft("");
    // ✅ reset activity
    setActivityItems([]);
    setActivityErr("");
    setActivityCursor(null);
    setActivityHasMore(true);
    setActivitySelectedTypes([]);
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

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
  async function loadActivity({ reset = false } = {}) {
    if (!userId) return;
    if (activityLoading) return;

    try {
      setActivityLoading(true);
      setActivityErr("");

      const limit = 50;

      const types =
        activitySelectedTypes.length > 0
          ? activitySelectedTypes.join(",")
          : undefined;

      const cursor = reset ? null : activityCursor;

      const res = await adminGetUserActivity(userId, {
        limit,
        cursor: cursor || undefined,
        types,
      });

      const incoming = Array.isArray(res?.items) ? res.items : [];
      const next = res?.nextCursor || null;

      if (reset) {
        setActivityItems(incoming);
      } else {
        // append, avoid duplicates by _id/ts+title fallback
        setActivityItems((prev) => {
          const seen = new Set(
            prev.map((x) => x?._id || `${x?.ts}-${x?.title}-${x?.type}`)
          );
          const merged = [...prev];
          for (const it of incoming) {
            const key = it?._id || `${it?.ts}-${it?.title}-${it?.type}`;
            if (seen.has(key)) continue;
            merged.push(it);
          }
          return merged;
        });
      }

      setActivityCursor(next);
      setActivityHasMore(Boolean(next) && incoming.length > 0);
    } catch (e) {
      setActivityErr(e?.response?.data?.message || "Failed to load activity.");
      if (reset) setActivityItems([]);
    } finally {
      setActivityLoading(false);
    }
  }

  // ✅ load activity when tab opens OR filters change
  useEffect(() => {
    if (activeTab !== "activity") return;
    if (!userId) return;
    loadActivity({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userId, activitySelectedTypes.join("|")]);

  // NEW: load notes (only when needed)
  useEffect(() => {
    if (activeTab !== "overview") return;
    if (!userId) return;

    let mounted = true;
    setActionLoading((s) => ({ ...s, loadNotes: true }));
    setNotesErr("");

    adminGetUserNotes(userId)
      .then((res) => {
        if (!mounted) return;
        const list = res?.notes || [];
        // newest first
        list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotes(list);
      })
      .catch((e) => {
        if (!mounted) return;
        setNotes([]);
        setNotesErr(e?.response?.data?.message || "Failed to load notes.");
      })
      .finally(() => {
        if (!mounted) return;
        setActionLoading((s) => ({ ...s, loadNotes: false }));
      });

    return () => {
      mounted = false;
    };
  }, [activeTab, userId]);

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

  async function onUpdateSubscription(nextPlan) {
    if (!userId) return;

    const ok = window.confirm(`Change subscription to "${nextPlan}"?`);
    if (!ok) return;

    try {
      setActionLoading((s) => ({ ...s, updateSubscription: true }));
      setErr("");

      const res = await adminUpdateUserSubscription(userId, nextPlan);
      const updated = res?.user ?? res;

      setUser((prev) => ({
        ...(prev || {}),
        ...(updated || {}),
        subscription: nextPlan,
      }));

      setToast(`Subscription updated to ${nextPlan}`);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to update subscription.");
    } finally {
      setActionLoading((s) => ({ ...s, updateSubscription: false }));
    }
  }
  // ✅ NEW: presets
  const FLAG_PRESETS = useMemo(
    () => [
      { key: "manual_review", label: "🚨 manual_review" },
      { key: "vip", label: "💎 vip" },
      { key: "refund_risk", label: "⚠️ refund_risk" },
      { key: "chargeback", label: "🧾 chargeback" },
      { key: "trusted", label: "✅ trusted" },
    ],
    []
  );

  // ✅ NEW: derive active preset state from flagsDraft
  const draftFlagsSet = useMemo(() => {
    const set = new Set(
      parseFlagsDraft(flagsDraft).map((x) => x.toLowerCase())
    );
    return set;
  }, [flagsDraft]);

  // NEW: Save flags
  async function onSaveFlags() {
    if (!userId) return;

    const flags = normalizeFlagsDraft(flagsDraft);

    try {
      setActionLoading((s) => ({ ...s, saveFlags: true }));
      setErr("");

      const res = await adminUpdateUserFlags(userId, flags);
      const updatedFlags = Array.isArray(res?.flags) ? res.flags : [];

      setUser((prev) => ({ ...(prev || {}), flags: updatedFlags }));
      setFlagsDraft(updatedFlags.join(", "));
      setToast("Flags updated");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to update flags.");
    } finally {
      setActionLoading((s) => ({ ...s, saveFlags: false }));
    }
  }

  // NEW: Add note
  async function onAddNote() {
    if (!userId) return;
    const text = String(noteDraft || "").trim();
    if (!text) return;

    try {
      setActionLoading((s) => ({ ...s, addNote: true }));
      setErr("");

      const res = await adminAddUserNote(userId, text);
      const list = res?.notes || [];

      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setNotes(list);
      setNoteDraft("");
      setToast("Note added");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to add note.");
    } finally {
      setActionLoading((s) => ({ ...s, addNote: false }));
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
                {Array.isArray(user?.flags) && user.flags.length ? (
                  <span style={pill("flagged")}>flagged</span>
                ) : null}
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

        <div style={styles.actionRow}>
          {/* LEFT group */}
          <div style={styles.actionGroupLeft}>
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
          </div>

          {/* RIGHT group */}
          <div style={styles.actionGroupRight}>
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

                <Section title="Admin Controls (Tier 1)">
                  {/* Flags */}
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>Flags</div>

                  <div
                    style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}
                  >
                    Use flags to label accounts for review or special handling
                    (e.g. <b>manual_review</b>, <b>vip</b>, <b>refund_risk</b>).
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={styles.flagChipsRow}>
                      {(Array.isArray(user.flags) ? user.flags : []).length ? (
                        (user.flags || []).map((f, idx) => (
                          <span key={`${f}-${idx}`} style={styles.flagChip}>
                            {f}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 12, color: TEXT_MUTED }}>
                          No flags
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      {/* ✅ NEW: quick presets */}
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {FLAG_PRESETS.map((p) => {
                          const isActive =
                            draftFlagsSet.has(p.key.toLowerCase()) ||
                            draftFlagsSet.has(p.label.toLowerCase()); // safety if you ever switch formats

                          return (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() =>
                                setFlagsDraft((prev) =>
                                  toggleDraftFlag(prev, p.label)
                                )
                              }
                              style={presetBtn(isActive)}
                              title={isActive ? "Remove flag" : "Add flag"}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>

                      <input
                        value={flagsDraft}
                        onChange={(e) => setFlagsDraft(e.target.value)}
                        placeholder="comma-separated flags (e.g. manual_review, vip)"
                        style={styles.input}
                      />
                      <button
                        onClick={onSaveFlags}
                        disabled={actionLoading.saveFlags || loading}
                        style={{
                          ...styles.savePillBtn,
                          ...(actionLoading.saveFlags || loading
                            ? styles.btnDisabled
                            : null),
                        }}
                      >
                        <BookmarkIcon style={{ width: 16, height: 16 }} />
                        {actionLoading.saveFlags ? "Saving" : "Save"}
                      </button>
                    </div>
                  </div>

                  <Divider />

                  {/* Notes */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ fontWeight: 950 }}>Admin Notes</div>
                    <button
                      onClick={() => {
                        // quick reload notes without extra state
                        setActiveTab("security");
                        setTimeout(() => setActiveTab("overview"), 0);
                      }}
                      style={styles.actionBtn}
                      title="Refresh notes"
                    >
                      Refresh
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: TEXT_MUTED,
                      lineHeight: 1.5,
                    }}
                  >
                    Append-only notes for support context. Keep it factual and
                    short.
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Write a note (e.g. user requested billing help; confirmed identity; refunded invoice...)"
                      style={styles.textarea}
                      rows={3}
                    />

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={onAddNote}
                        disabled={
                          actionLoading.addNote || loading || !noteDraft.trim()
                        }
                        style={styles.primaryBtn}
                      >
                        {actionLoading.addNote ? "Adding…" : "Add Note"}
                      </button>
                      <span style={{ fontSize: 12, color: TEXT_MUTED }}>
                        {noteDraft.trim().length}/1500
                      </span>
                    </div>

                    {notesErr ? (
                      <div style={styles.errorBox}>
                        <div style={{ fontWeight: 900, marginBottom: 6 }}>
                          Notes error
                        </div>
                        <div>{notesErr}</div>
                      </div>
                    ) : actionLoading.loadNotes ? (
                      <div style={{ fontSize: 12, color: TEXT_MUTED }}>
                        Loading notes…
                      </div>
                    ) : notes.length === 0 ? (
                      <div style={styles.emptyCard}>
                        <div style={{ fontWeight: 950, marginBottom: 6 }}>
                          No notes yet
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: TEXT_MUTED,
                            lineHeight: 1.5,
                          }}
                        >
                          Add the first note to start building support context
                          for this user.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {notes.map((n, idx) => (
                          <div
                            key={n._id || `${n.createdAt}-${idx}`}
                            style={styles.noteCard}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                              }}
                            >
                              <div style={{ fontWeight: 950, fontSize: 12 }}>
                                {n?.adminId?.email || n?.adminEmail || "admin"}
                              </div>
                              <div style={{ fontSize: 11, color: TEXT_MUTED }}>
                                {formatDateTime(n.createdAt)}
                              </div>
                            </div>
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 13,
                                lineHeight: 1.5,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {n.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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

            {activeTab === "accounts" ? (
              <Section title="Accounts">
                {accountsLoading ? (
                  <div style={{ opacity: 0.8 }}>Loading accounts…</div>
                ) : accounts.length === 0 ? (
                  <div style={{ fontSize: 13, color: TEXT_MUTED }}>
                    No accounts found.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {accounts.map((acc) => (
                      <div
                        key={acc._id}
                        style={{
                          border: BORDER,
                          borderRadius: 12,
                          padding: 12,
                          background: acc.isDeleted
                            ? "rgba(239,68,68,0.05)"
                            : "transparent",
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>
                          {acc.name}{" "}
                          <span style={pill(acc.type)}>{acc.type}</span>
                          {acc.isDeleted && (
                            <span style={pill("inactive")}>deleted</span>
                          )}
                        </div>

                        <div style={{ marginTop: 6, fontSize: 13 }}>
                          Balance:{" "}
                          <strong>
                            {Number(acc.balance || 0).toLocaleString()}{" "}
                            {acc.currency}
                          </strong>
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: TEXT_MUTED,
                            marginTop: 4,
                          }}
                        >
                          {acc.institution || "—"}
                          {acc.last4 ? ` • ****${acc.last4}` : ""}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: TEXT_MUTED,
                            marginTop: 4,
                          }}
                        >
                          Created: {formatDateTime(acc.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
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

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Security Actions
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {!user.isEmailVerified && (
                      <button
                        onClick={onResendVerification}
                        disabled={actionLoading.resendVerification || loading}
                        style={styles.actionBtnSendVerification}
                      >
                        {actionLoading.resendVerification
                          ? "Resending…"
                          : "Resend Verification"}
                      </button>
                    )}

                    <button
                      onClick={onForceLogout}
                      disabled={actionLoading.forceLogout || loading}
                      style={styles.actionBtnForceLogout}
                    >
                      {actionLoading.forceLogout ? "Forcing…" : "Force Logout"}
                    </button>

                    <button
                      onClick={onSendPasswordReset}
                      disabled={actionLoading.sendPasswordReset || loading}
                      style={styles.actionBtnSendPasswordReset}
                    >
                      {actionLoading.sendPasswordReset
                        ? "Sending…"
                        : "Send Password Reset"}
                    </button>
                  </div>

                  <div
                    style={{ marginTop: 8, fontSize: 12, color: TEXT_MUTED }}
                  >
                    Use these actions only when assisting users with access or
                    security issues.
                  </div>
                </div>
              </Section>
            ) : null}

            {activeTab === "subscription" ? (
              <Section title="Subscription">
                <Grid>
                  <Row
                    label="Current plan"
                    value={user.subscription || "Standard"}
                  />
                  <Row
                    label="Active user"
                    value={user.isActive ? "Yes" : "No"}
                  />
                </Grid>

                <Divider />

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>
                    Manage Subscription
                  </div>

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <button
                      disabled
                      style={{
                        ...styles.actionBtn,
                        opacity: user.subscription === "Standard" ? 0.6 : 1,
                        cursor: "default",
                      }}
                      title="Default plan"
                    >
                      Standard{" "}
                      {user.subscription === "Standard" ? "(current)" : ""}
                    </button>

                    <button
                      onClick={() => onUpdateSubscription("Plus")}
                      disabled={
                        loading ||
                        actionLoading.updateSubscription ||
                        user.subscription === "Plus"
                      }
                      style={{
                        ...styles.actionBtnSetPlus,
                        opacity: user.subscription === "Plus" ? 0.6 : 1,
                        cursor:
                          user.subscription === "Plus" ? "default" : "pointer",
                      }}
                      title="Upgrade to Plus"
                    >
                      {user.subscription === "Plus"
                        ? "Plus (current)"
                        : "Set Plus"}
                    </button>

                    <button
                      onClick={() => onUpdateSubscription("Premium")}
                      disabled={
                        loading ||
                        actionLoading.updateSubscription ||
                        user.subscription === "Premium"
                      }
                      style={{
                        ...styles.actionBtnSetPremium,
                        opacity: user.subscription === "Premium" ? 0.6 : 1,
                        cursor:
                          user.subscription === "Premium"
                            ? "default"
                            : "pointer",
                      }}
                      title="Upgrade to Premium"
                    >
                      {user.subscription === "Premium"
                        ? "Premium (current)"
                        : "Set Premium"}
                    </button>
                  </div>

                  <div
                    style={{ marginTop: 10, fontSize: 12, color: TEXT_MUTED }}
                  >
                    Subscription changes are applied immediately. Billing
                    enforcement (Stripe, trials, invoices) can be layered on
                    later without changing this UI.
                  </div>
                </div>
              </Section>
            ) : null}

            {activeTab === "activity" ? (
              <Section title="Activity">
                <div
                  style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}
                >
                  Audit timeline for this user (admin + system events). Use
                  filters to narrow down the feed.
                </div>

                <Divider />

                {/* Filters */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ACTIVITY_TYPES.map((t) => {
                    const active = activitySelectedTypes.includes(t.key);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => {
                          setActivityItems([]);
                          setActivityCursor(null);
                          setActivityHasMore(true);
                          setActivitySelectedTypes((prev) => {
                            if (prev.includes(t.key))
                              return prev.filter((x) => x !== t.key);
                            return [...prev, t.key];
                          });
                        }}
                        style={chipBtn(active)}
                        title={active ? "Remove filter" : "Add filter"}
                      >
                        {t.label}
                      </button>
                    );
                  })}

                  {activitySelectedTypes.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActivityItems([]);
                        setActivityCursor(null);
                        setActivityHasMore(true);
                        setActivitySelectedTypes([]);
                      }}
                      style={chipBtn(false)}
                      title="Clear filters"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div style={{ marginTop: 12 }}>
                  {activityErr ? (
                    <div style={styles.errorBox}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>
                        Activity error
                      </div>
                      <div>{activityErr}</div>
                    </div>
                  ) : null}

                  {activityLoading && activityItems.length === 0 ? (
                    <div style={{ fontSize: 12, color: TEXT_MUTED }}>
                      Loading activity…
                    </div>
                  ) : null}

                  {!activityLoading &&
                  activityItems.length === 0 &&
                  !activityErr ? (
                    <div style={styles.emptyCard}>
                      <div style={{ fontWeight: 950, marginBottom: 6 }}>
                        No activity yet
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: TEXT_MUTED,
                          lineHeight: 1.5,
                        }}
                      >
                        Events will appear here as admins take actions (notes,
                        flags, security actions) and as system events are added.
                      </div>
                    </div>
                  ) : null}

                  {activityItems.length > 0 ? (
                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                      {activityItems.map((ev, idx) => (
                        <div
                          key={ev._id || `${ev.ts}-${ev.title}-${idx}`}
                          style={styles.activityCard}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              alignItems: "flex-start",
                            }}
                          >
                            <div style={{ display: "grid", gap: 4 }}>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span style={styles.activityTypePill}>
                                  {ev.type || "event"}
                                </span>
                                {ev.adminEmail ? (
                                  <span style={styles.activityMetaText}>
                                    by {ev.adminEmail}
                                  </span>
                                ) : (
                                  <span style={styles.activityMetaText}>
                                    system
                                  </span>
                                )}
                              </div>

                              <div style={{ fontWeight: 950, fontSize: 13 }}>
                                {ev.title || "(no title)"}
                              </div>

                              {ev.subtitle ? (
                                <div
                                  style={{ fontSize: 12, color: TEXT_MUTED }}
                                >
                                  {ev.subtitle}
                                </div>
                              ) : null}
                            </div>

                            <div style={{ fontSize: 11, color: TEXT_MUTED }}>
                              {formatDateTime(ev.ts)}
                            </div>
                          </div>

                          {ev.meta ? (
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: TEXT_MUTED,
                              }}
                            >
                              {ev.meta}
                            </div>
                          ) : null}

                          {/* Payload */}
                          {ev.payload &&
                          Object.keys(ev.payload || {}).length ? (
                            <details style={{ marginTop: 10 }}>
                              <summary
                                style={{ cursor: "pointer", fontWeight: 900 }}
                              >
                                View payload
                              </summary>
                              <pre style={styles.pre}>
                                {JSON.stringify(ev.payload, null, 2)}
                              </pre>
                            </details>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Load more */}
                  <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => loadActivity({ reset: true })}
                      disabled={activityLoading}
                      style={styles.actionBtn}
                      title="Refresh activity"
                    >
                      Refresh
                    </button>

                    <button
                      type="button"
                      onClick={() => loadActivity({ reset: false })}
                      disabled={activityLoading || !activityHasMore}
                      style={styles.primaryBtn}
                      title="Load older events"
                    >
                      {activityLoading
                        ? "Loading…"
                        : activityHasMore
                        ? "Load more"
                        : "No more"}
                    </button>
                  </div>
                </div>
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
function chipBtn(active) {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(148,163,184,0.30)" : BORDER,
    background: active ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.05)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1,
    userSelect: "none",
  };
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
  if (kind === "flagged")
    return { ...base, background: "rgba(239,68,68,0.08)" };

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

function normalizeFlagsDraft(raw) {
  // Accept comma-separated flags. Emojis are valid.
  // Disallow commas inside a single flag by definition.
  return (
    String(raw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      // optional: prevent absurdly long flags
      .map((s) => s.slice(0, 40))
  );
}
// ✅ Add this tiny icon component anywhere in the same file (below helpers is fine)

function BookmarkIcon({ style }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", ...style }}
    >
      <path
        d="M6.5 4.75h11c.966 0 1.75.784 1.75 1.75v14.5l-6.2-3.4a2 2 0 0 0-1.9 0l-6.2 3.4V6.5c0-.966.784-1.75 1.75-1.75Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
// ✅ NEW: parse/normalize draft flags (emoji-safe)
function parseFlagsDraft(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ✅ NEW: serialize flags array back into input
function serializeFlags(flags) {
  return (flags || []).join(", ");
}

// ✅ NEW: toggle a single flag in draft (case-insensitive match)
function toggleDraftFlag(rawDraft, flag) {
  const list = parseFlagsDraft(rawDraft);

  const idx = list.findIndex(
    (x) => x.toLowerCase() === String(flag).toLowerCase()
  );

  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(flag);
  }

  // de-dupe (case-insensitive) while preserving order
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return serializeFlags(out);
}
function presetBtn(active) {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(148,163,184,0.35)" : BORDER,
    background: active ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.05)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1,
    userSelect: "none",
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
  primaryBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(148,163,184,0.10)",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 13,
  },
  input: {
    flex: 1,
    minWidth: 260,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(2,6,23,0.02)",
    outline: "none",
    fontSize: 13,
    fontWeight: 800,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(2,6,23,0.02)",
    outline: "none",
    fontSize: 13,
    fontWeight: 700,
    resize: "vertical",
  },
  flagChipsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 8,
  },
  flagChip: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(148,163,184,0.08)",
    fontSize: 12,
    fontWeight: 950,
  },
  noteCard: {
    padding: 12,
    borderRadius: 14,
    border: BORDER,
    background: "rgba(148,163,184,0.04)",
  },
  emptyCard: {
    padding: 14,
    borderRadius: 14,
    border: BORDER,
    background: BG_SOFT,
  },
  actionBtnSendPasswordReset: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "transparent",
    color: "#2563ebff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  actionBtnSendVerification: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "transparent",
    color: "#1cb946ff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  actionBtnForceLogout: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.25)",
    color: "#b91c1c",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  actionBtnSetPlus: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "transparent",
    color: "#4c1ea6ff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  actionBtnSetPremium: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "transparent",
    color: "#6956d1ff",
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
  actionGroupLeft: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  actionGroupRight: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginLeft: "auto",
  }, // ✅ Add these styles into your `styles` object (near primaryBtn/actionBtn)

  savePillBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(148,163,184,0.06)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
    lineHeight: 1,
    userSelect: "none",
  },

  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  activityCard: {
    padding: 12,
    borderRadius: 14,
    border: BORDER,
    background: "rgba(148,163,184,0.04)",
  },

  activityTypePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(148,163,184,0.08)",
    fontSize: 11,
    fontWeight: 950,
  },

  activityMetaText: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: 800,
  },
};
