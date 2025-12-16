// mobile/src/screens/UserScreen.js
/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import api from "../lib/api";

const BG_DARK = "#020617";
const CARD_DARK = "#020819";
const BRAND_MAIN = "#4f772d";
const BRAND_SECONDARY = "#90a955";
const TEXT_SOFT = "rgba(148,163,184,0.9)";

const ACCOUNT_TYPES = ["checking", "savings", "credit", "cash", "other"];
const CURRENCIES = ["USD", "EUR", "TRY", "GBP"];

// ───────────────────────────────── helpers ─────────────────────────────────
function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}
function majorToMinor(amountStr, cur) {
  const decimals = decimalsForCurrency(cur);
  const n = Number(String(amountStr).replace(",", "."));
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * Math.pow(10, decimals));
}
function minorToMajorString(minor, cur) {
  const decimals = decimalsForCurrency(cur);
  const n = (minor || 0) / Math.pow(10, decimals);
  return String(n);
}

// ───────────────────────────────── screen ──────────────────────────────────
export default function UserScreen() {
  const navigation = useNavigation();

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [subscription, setSubscription] = useState("Standard");
  const [tz, setTz] = useState("UTC");

  const [accounts, setAccounts] = useState([]);
  const [accErr, setAccErr] = useState("");
  const [accBusy, setAccBusy] = useState(false);
  const [accModalVisible, setAccModalVisible] = useState(false);
  const [editingAcc, setEditingAcc] = useState(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  // avatar
  const [avatarUri, setAvatarUri] = useState(null);

  // ─────────────────────────────── init load ────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // make sure api has token on this screen too
        const token = await AsyncStorage.getItem("token");
        if (token) {
          api.defaults.headers.Authorization = `Bearer ${token}`;
        }

        const [meResp, accResp, storedAvatar] = await Promise.all([
          api.get("/me"),
          api.get("/accounts"),
          AsyncStorage.getItem("userAvatarUri"),
        ]);

        const raw = meResp?.data || {};
        const meData = raw.user || raw || {};

        setMe(meData);
        setEmail(meData.email || "");
        setName(meData.name || "");
        setProfession(meData.profession || "");
        setSubscription(meData.subscription || "Standard");
        setBaseCurrency(meData.baseCurrency || "USD");
        setTz(meData.tz || "UTC");

        const accs = Array.isArray(accResp?.data) ? accResp.data : [];
        setAccounts(accs.filter((a) => !a.isDeleted));

        // backend avatar has priority; local cache is fallback
        const backendAvatar = meData.avatarUrl || meData.profilePicture || null;
        if (backendAvatar) {
          const baseURL = api.defaults.baseURL || "";
          const full =
            backendAvatar.startsWith("http") || backendAvatar.startsWith("file")
              ? backendAvatar
              : `${baseURL}${backendAvatar}`;
          setAvatarUri(full);
        } else if (storedAvatar) {
          setAvatarUri(storedAvatar);
        }
      } catch (e) {
        console.warn("User load failed:", e);
        setErr(e?.response?.data?.error || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function refreshAccounts() {
    try {
      setAccErr("");
      const { data } = await api.get("/accounts");
      setAccounts(
        (Array.isArray(data) ? data : []).filter((a) => !a.isDeleted)
      );
    } catch (e) {
      setAccErr(e?.response?.data?.error || "Failed to load accounts");
    }
  }

  // ───────────────────────────── avatar picker ──────────────────────────────
  const pickAvatar = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "We need access to your photo library to change your profile picture."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets && result.assets[0];
      if (!asset?.uri) return;

      // update UI + cache
      setAvatarUri(asset.uri);
      await AsyncStorage.setItem("userAvatarUri", asset.uri);

      // try to upload to backend (you need /me/avatar endpoint)
      const token = await AsyncStorage.getItem("token");
      const form = new FormData();
      form.append("avatar", {
        uri: asset.uri,
        name: "avatar.jpg",
        type: "image/jpeg",
      });

      await api.post("/me/avatar", form, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (e) {
      console.warn("pickAvatar failed:", e);
      Alert.alert("Error", "Could not update profile picture.");
    }
  };

  // ───────────────────────────── profile save ───────────────────────────────
  async function saveProfile() {
    try {
      setSaving(true);
      setErr("");
      setMsg("");
      const token = await AsyncStorage.getItem("token");
      const { data } = await api.put(
        "/me",
        { email, name, profession, baseCurrency, tz },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const updated = data.user || data || {};
      setMe(updated);
      setMsg("Profile updated");
      if (updated.name) {
        await AsyncStorage.setItem("userName", updated.name);
      }
    } catch (e) {
      console.warn("Save profile failed:", e);
      setErr(e?.response?.data?.error || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }
  // ───────────────────────────── logout ─────────────────────────────
  async function logout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            // Clear auth + cached user assets
            await AsyncStorage.multiRemove([
              "token",
              "userAvatarUri",
              "userName",
            ]);

            // Clear axios auth header to avoid leaking the old token
            delete api.defaults.headers.Authorization;

            // Reset navigation to Login
            navigation.reset({
              index: 0,
              routes: [{ name: "Login" }],
            });
          } catch (e) {
            console.warn("Logout failed:", e);
            Alert.alert("Error", "Could not log out. Please try again.");
          }
        },
      },
    ]);
  }

  // ───────────────────────────── delete account ─────────────────────────────
  async function deleteMe() {
    try {
      setDeleting(true);
      setErr("");
      setMsg("");
      const token = await AsyncStorage.getItem("token");
      await api.delete("/me", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("userAvatarUri");
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (e) {
      console.warn("Delete me failed:", e);
      setErr(e?.response?.data?.error || "Failed to delete account");
    } finally {
      setDeleteConfirmVisible(false);
      setDeleting(false);
    }
  }

  // ───────────────────────────── accounts save ──────────────────────────────
  async function saveAccount(payload) {
    try {
      setAccBusy(true);
      setAccErr("");

      if (payload._id) {
        const { _id, ...rest } = payload;
        await api.put(`/accounts/${_id}`, rest);
      } else {
        await api.post("/accounts", payload);
      }
      setAccModalVisible(false);
      await refreshAccounts();
    } catch (e) {
      console.warn("Save account failed:", e);
      setAccErr(e?.response?.data?.error || "Failed to save account");
    } finally {
      setAccBusy(false);
    }
  }

  async function deleteAccount(acc) {
    Alert.alert(
      "Delete account",
      `Delete account "${acc.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setAccBusy(true);
              await api.delete(`/accounts/${acc._id}`);
              await refreshAccounts();
            } catch (e) {
              console.warn("Delete account failed:", e);
              setAccErr(e?.response?.data?.error || "Delete failed");
            } finally {
              setAccBusy(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }

  // ───────────────────────────── render ─────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="small" color={BRAND_SECONDARY} />
        <Text style={{ color: TEXT_SOFT, marginTop: 8 }}>Loading profile…</Text>
      </View>
    );
  }

  const initials =
    (name || email || "U")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* HERO */}
        <View style={styles.hero}>
          <Text style={styles.heroGreeting}>
            Hello {name ? name.split(" ")[0] : "there"}
          </Text>
          <Text style={styles.heroSubtitle}>
            Manage your profile and financial accounts.
          </Text>
        </View>

        {/* PROFILE CARD */}
        <View style={styles.profileRow}>
          <View style={styles.profileSide}>
            <TouchableOpacity
              onPress={pickAvatar}
              style={styles.avatarTouchable}
            >
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </View>
              <Text style={styles.changePhotoText}>Change photo</Text>
            </TouchableOpacity>

            <Text style={styles.profileName}>{name || "Your name"}</Text>
            <Text style={styles.profileProfession}>
              {profession || "Add your profession"}
            </Text>

            <View style={styles.statsRow}>
              <StatPill label="Accounts" value={String(accounts.length)} />
              <StatPill label="Base" value={baseCurrency} />
              <StatPill label="TZ" value={tz} />
            </View>
          </View>
        </View>

        {/* EDIT PROFILE FORM */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          {msg ? <Text style={styles.msgText}>{msg}</Text> : null}
          {err ? <Text style={styles.errText}>{err}</Text> : null}

          <Labeled label="Email address">
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Labeled>

          <Labeled label="Name">
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
            />
          </Labeled>

          <Labeled label="Profession">
            <TextInput
              style={styles.input}
              value={profession}
              onChangeText={setProfession}
              placeholder="e.g., Software Engineer"
            />
          </Labeled>

          <Labeled label="Time zone">
            <TextInput
              style={styles.input}
              value={tz}
              onChangeText={setTz}
              placeholder="e.g., Europe/Istanbul"
            />
          </Labeled>

          <Labeled label="Subscription Plan">
            <View style={[styles.input, { backgroundColor: "#f1f5f9" }]}>
              <Text style={{ color: "#0f172a", fontWeight: "500" }}>
                {subscription}
              </Text>
            </View>
          </Labeled>

          <Labeled label="Base currency">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: "row", gap: 8 }}
            >
              {CURRENCIES.map((c) => {
                const active = baseCurrency === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.chip,
                      active && { backgroundColor: BRAND_SECONDARY },
                    ]}
                    onPress={() => setBaseCurrency(c)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && { color: "#022c22", fontWeight: "700" },
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Labeled>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={saveProfile}
              disabled={saving}
              style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
            >
              <Text style={styles.primaryBtnText}>
                {saving ? "Saving…" : "Save changes"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setDeleteConfirmVisible(true)}
              disabled={deleting}
              style={[styles.dangerOutlineBtn, deleting && { opacity: 0.6 }]}
            >
              <Text style={styles.dangerOutlineText}>
                {deleting ? "Deleting…" : "Delete account"}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutOutlineBtn}>
            <Text style={styles.logoutOutlineText}>Log out</Text>
          </TouchableOpacity>
        </View>

        {/* ACCOUNTS CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Accounts</Text>
            <TouchableOpacity
              style={styles.smallPrimaryBtn}
              onPress={() => {
                setEditingAcc(null);
                setAccModalVisible(true);
              }}
              disabled={accBusy}
            >
              <Text style={styles.smallPrimaryBtnText}>+ Add account</Text>
            </TouchableOpacity>
          </View>

          {accErr ? <Text style={styles.errText}>{accErr}</Text> : null}

          {accounts.length === 0 ? (
            <Text style={{ color: TEXT_SOFT }}>
              No accounts yet. Tap “Add account”.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {accounts.map((a) => (
                <View key={a._id} style={styles.accountRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>{a.name}</Text>
                    <Text style={styles.accountMeta}>
                      {a.type} • {a.currency}
                    </Text>
                    <Text style={styles.accountMeta}>
                      {a.institution || "—"}{" "}
                      {a.last4 ? `• **** ${a.last4}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.accountBalance}>
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: a.currency || "USD",
                      }).format((a.balance || 0) / 100)}
                    </Text>
                    <View style={{ flexDirection: "row", marginTop: 4 }}>
                      <TouchableOpacity
                        style={styles.accountAction}
                        onPress={() => {
                          setEditingAcc(a);
                          setAccModalVisible(true);
                        }}
                      >
                        <Text style={styles.accountActionText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.accountAction, { marginLeft: 8 }]}
                        onPress={() => deleteAccount(a)}
                      >
                        <Text
                          style={[
                            styles.accountActionText,
                            { color: "#b91c1c" },
                          ]}
                        >
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Delete confirmation */}
      <Modal
        transparent
        visible={deleteConfirmVisible}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete your account?</Text>
            <Text style={styles.modalText}>
              This is a soft delete. Your account will be deactivated and
              hidden. You can contact support to restore it.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteConfirmVisible(false)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>No, keep it</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDangerBtn}
                onPress={deleteMe}
                disabled={deleting}
              >
                <Text style={styles.modalDangerText}>Yes, delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Account add/edit modal */}
      <AccountModal
        visible={accModalVisible}
        onClose={() => setAccModalVisible(false)}
        initial={editingAcc}
        onSubmit={saveAccount}
        busy={accBusy}
      />
    </View>
  );
}

// ───────────────────────────── subcomponents ────────────────────────────────
function Labeled({ label, children }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function StatPill({ label, value }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AccountModal({ visible, onClose, initial, onSubmit, busy }) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "checking");
  const [currency, setCurrency] = useState(initial?.currency || "USD");
  const [balanceMajor, setBalanceMajor] = useState(
    initial
      ? minorToMajorString(initial.balance || 0, initial.currency || "USD")
      : "0"
  );
  const [institution, setInstitution] = useState(initial?.institution || "");
  const [last4, setLast4] = useState(initial?.last4 || "");

  useEffect(() => {
    if (visible) {
      setName(initial?.name || "");
      setType(initial?.type || "checking");
      setCurrency(initial?.currency || "USD");
      setBalanceMajor(
        initial
          ? minorToMajorString(initial.balance || 0, initial.currency || "USD")
          : "0"
      );
      setInstitution(initial?.institution || "");
      setLast4(initial?.last4 || "");
    }
  }, [visible, initial]);

  function handleSubmit() {
    const balance = majorToMinor(balanceMajor || "0", currency);
    if (Number.isNaN(balance)) {
      Alert.alert("Invalid balance amount");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Name is required");
      return;
    }
    onSubmit({
      ...(initial?._id ? { _id: initial._id } : {}),
      name: name.trim(),
      type,
      currency,
      balance,
      institution: institution.trim() || undefined,
      last4: last4.trim() || undefined,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {initial ? "Edit account" : "Add account"}
          </Text>

          <ScrollView
            style={{ maxHeight: 340, marginTop: 10 }}
            showsVerticalScrollIndicator={false}
          >
            <Labeled label="Account name">
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Main Checking"
              />
            </Labeled>

            <Labeled label="Type">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: "row", gap: 8 }}
              >
                {ACCOUNT_TYPES.map((t) => {
                  const active = t === type;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.chip,
                        active && { backgroundColor: BRAND_SECONDARY },
                      ]}
                      onPress={() => setType(t)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && { color: "#022c22", fontWeight: "700" },
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Labeled>

            <Labeled label="Currency">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: "row", gap: 8 }}
              >
                {CURRENCIES.map((c) => {
                  const active = c === currency;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.chip,
                        active && { backgroundColor: BRAND_SECONDARY },
                      ]}
                      onPress={() => setCurrency(c)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && { color: "#022c22", fontWeight: "700" },
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Labeled>

            <Labeled label="Current balance">
              <TextInput
                style={styles.input}
                value={balanceMajor}
                onChangeText={setBalanceMajor}
                inputMode="decimal"
                placeholder="e.g., 1250.00"
              />
            </Labeled>

            <Labeled label="Institution (optional)">
              <TextInput
                style={styles.input}
                value={institution}
                onChangeText={setInstitution}
                placeholder="Your bank"
              />
            </Labeled>

            <Labeled label="Last 4 (optional)">
              <TextInput
                style={styles.input}
                value={last4}
                onChangeText={setLast4}
                placeholder="1234"
                maxLength={4}
                keyboardType="number-pad"
              />
            </Labeled>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={handleSubmit}
              disabled={busy}
            >
              <Text style={styles.modalPrimaryText}>
                {busy ? "Saving…" : initial ? "Save" : "Add"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ───────────────────────────── styles ───────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  heroGreeting: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f9fafb",
  },
  heroSubtitle: {
    marginTop: 4,
    color: TEXT_SOFT,
    fontSize: 13,
  },
  profileRow: {
    marginBottom: 16,
  },
  profileSide: {
    alignItems: "center",
  },
  avatarTouchable: {
    alignItems: "center",
    marginBottom: 4,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: BRAND_MAIN,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  changePhotoText: {
    fontSize: 11,
    color: BRAND_SECONDARY,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: "800",
    color: "#f9fafb",
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f9fafb",
  },
  profileProfession: {
    marginTop: 2,
    fontSize: 13,
    color: TEXT_SOFT,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 8,
  },
  statPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: "#1f2933",
    alignItems: "center",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f9fafb",
  },
  statLabel: {
    fontSize: 10,
    color: TEXT_SOFT,
  },
  card: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: "#1f2933",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f9fafb",
  },
  label: {
    fontSize: 12,
    color: TEXT_SOFT,
    marginBottom: 4,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#f9fafb",
    backgroundColor: "#020617",
    fontSize: 14,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#020617",
  },
  chipText: {
    fontSize: 13,
    color: "#e5e7eb",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: BRAND_MAIN,
  },
  primaryBtnText: {
    color: "#f9fafb",
    fontWeight: "700",
    fontSize: 14,
  },
  dangerOutlineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  dangerOutlineText: {
    color: "#fca5a5",
    fontWeight: "600",
  },
  smallPrimaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: BRAND_MAIN,
  },
  smallPrimaryBtnText: {
    color: "#f9fafb",
    fontSize: 12,
    fontWeight: "600",
  },
  msgText: {
    color: "#bbf7d0",
    fontSize: 12,
    marginBottom: 6,
  },
  errText: {
    color: "#fecaca",
    fontSize: 12,
    marginBottom: 6,
  },
  accountRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    gap: 8,
  },
  accountName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f9fafb",
  },
  accountMeta: {
    fontSize: 11,
    color: TEXT_SOFT,
  },
  accountBalance: {
    fontSize: 14,
    fontWeight: "700",
    color: BRAND_SECONDARY,
  },
  accountAction: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374151",
  },
  accountActionText: {
    fontSize: 11,
    color: "#e5e7eb",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    backgroundColor: "#020617",
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f9fafb",
  },
  modalText: {
    marginTop: 6,
    fontSize: 13,
    color: TEXT_SOFT,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  modalCancelText: {
    color: "#e5e7eb",
    fontSize: 13,
  },
  modalDangerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#dc2626",
  },
  modalDangerText: {
    color: "#f9fafb",
    fontSize: 13,
    fontWeight: "600",
  },
  modalPrimaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: BRAND_MAIN,
  },
  modalPrimaryText: {
    color: "#f9fafb",
    fontSize: 13,
    fontWeight: "600",
  },
  logoutOutlineBtn: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "transparent",
  },
  logoutOutlineText: {
    color: TEXT_SOFT,
    fontWeight: "700",
    fontSize: 14,
  },
});
