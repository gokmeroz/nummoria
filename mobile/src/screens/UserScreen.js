// mobile/src/screens/UserScreen.js
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
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
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";

/* ──────────────────────────────────────────────────────────
   THEME — synced with Dashboard / Income / Investment HUD
────────────────────────────────────────────────────────── */
const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const ORANGE = "#f97316";
const GOLD = "#fbbf24";

const CARD_BG = "rgba(255,255,255,0.025)";
const CARD_BD = "rgba(255,255,255,0.07)";
const T_HI = "#e2e8f0";
const T_MID = "rgba(226,232,240,0.55)";
const T_DIM = "rgba(226,232,240,0.32)";

const ACCOUNT_TYPES = ["checking", "savings", "credit", "cash", "other"];
const CURRENCIES = ["USD", "EUR", "TRY", "GBP"];

/* ──────────────────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────────────────── */
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
function fmtMoneyMinor(minor, cur = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur || "USD",
    }).format((minor || 0) / Math.pow(10, decimalsForCurrency(cur || "USD")));
  } catch {
    return `${minorToMajorString(minor, cur)} ${cur}`;
  }
}

/* ──────────────────────────────────────────────────────────
   HUD PRIMITIVES
────────────────────────────────────────────────────────── */
function Brackets({ color = MINT, size = 10, thick = 1.5 }) {
  const defs = [
    {
      top: 0,
      left: 0,
      borderTopWidth: thick,
      borderLeftWidth: thick,
      borderTopLeftRadius: 2,
    },
    {
      top: 0,
      right: 0,
      borderTopWidth: thick,
      borderRightWidth: thick,
      borderTopRightRadius: 2,
    },
    {
      bottom: 0,
      left: 0,
      borderBottomWidth: thick,
      borderLeftWidth: thick,
      borderBottomLeftRadius: 2,
    },
    {
      bottom: 0,
      right: 0,
      borderBottomWidth: thick,
      borderRightWidth: thick,
      borderBottomRightRadius: 2,
    },
  ];

  return (
    <>
      {defs.map((d, i) => (
        <View
          key={i}
          style={[
            {
              position: "absolute",
              width: size,
              height: size,
              borderColor: color,
            },
            d,
          ]}
        />
      ))}
    </>
  );
}

function ScanLine({ color = MINT, style: extra }) {
  return (
    <View
      style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, extra]}
    >
      <View
        style={{
          width: 3,
          height: 3,
          borderRadius: 999,
          backgroundColor: color,
          opacity: 0.6,
        }}
      />
      <View
        style={{ flex: 1, height: 1, backgroundColor: color, opacity: 0.2 }}
      />
      <View
        style={{
          width: 3,
          height: 3,
          borderRadius: 999,
          backgroundColor: color,
          opacity: 0.6,
        }}
      />
    </View>
  );
}

function GridBG() {
  const { width, height } = require("react-native").Dimensions.get("window");
  const COLS = 10;
  const ROWS = 22;
  const cw = width / COLS;
  const rh = height / ROWS;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: ROWS + 1 }, (_, i) => (
        <View
          key={`h${i}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: i * rh,
            height: 1,
            backgroundColor: "rgba(0,255,135,0.035)",
          }}
        />
      ))}
      {Array.from({ length: COLS + 1 }, (_, i) => (
        <View
          key={`v${i}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: i * cw,
            width: 1,
            backgroundColor: "rgba(0,212,255,0.025)",
          }}
        />
      ))}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: MINT,
          opacity: 0.15,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: height * 0.44,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: CYAN,
          opacity: 0.06,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: VIOLET,
          opacity: 0.1,
        }}
      />
    </View>
  );
}

/* ──────────────────────────────────────────────────────────
   REUSABLE UI
────────────────────────────────────────────────────────── */
function Chip({ label, selected, onPress, accent = MINT, small }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        s.chip,
        small && s.chipSmall,
        selected && [s.chipSelected, { borderColor: `${accent}66` }],
      ]}
      activeOpacity={0.75}
    >
      {selected && <View style={[s.chipDot, { backgroundColor: accent }]} />}
      <Text
        style={[
          s.chipText,
          small && s.chipTextSmall,
          selected && [s.chipTextSelected, { color: accent }],
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StatCard({
  title,
  value,
  accent = "mint",
  hint = "Live profile metric",
}) {
  const accentMap = {
    mint: {
      color: MINT,
      glow: "rgba(0,255,135,0.09)",
      bd: "rgba(0,255,135,0.22)",
    },
    cyan: {
      color: CYAN,
      glow: "rgba(0,212,255,0.09)",
      bd: "rgba(0,212,255,0.22)",
    },
    violet: {
      color: VIOLET,
      glow: "rgba(167,139,250,0.10)",
      bd: "rgba(167,139,250,0.22)",
    },
  };

  const a = accentMap[accent] || accentMap.mint;

  return (
    <View style={[s.statCard, { borderColor: a.bd, backgroundColor: a.glow }]}>
      <Brackets color={a.color} size={8} thick={1.5} />
      <View style={[s.statHairline, { backgroundColor: a.color }]} />
      <Text style={s.statLabel}>{title}</Text>
      <Text style={[s.statValue, { color: a.color }]}>{value}</Text>
      <ScanLine color={a.color} style={{ marginTop: 10 }} />
      <Text style={s.statHint}>{hint}</Text>
    </View>
  );
}

function Labeled({ label, children }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════ */
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

  const [avatarUri, setAvatarUri] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");

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
        (Array.isArray(data) ? data : []).filter((a) => !a.isDeleted),
      );
    } catch (e) {
      setAccErr(e?.response?.data?.error || "Failed to load accounts");
    }
  }

  const pickAvatar = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "We need access to your photo library to change your profile picture.",
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

      setAvatarUri(asset.uri);
      await AsyncStorage.setItem("userAvatarUri", asset.uri);

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

  async function saveProfile() {
    try {
      setSaving(true);
      setErr("");
      setMsg("");
      const token = await AsyncStorage.getItem("token");

      const { data } = await api.put(
        "/me",
        { email, name, profession, baseCurrency, tz },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
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

  async function logout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([
              "token",
              "userAvatarUri",
              "userName",
            ]);
            delete api.defaults.headers.Authorization;
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
    Alert.alert("Delete account", `Delete account "${acc.name}"?`, [
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
    ]);
  }

  const initials = useMemo(() => {
    return (
      (name || email || "U")
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "U"
    );
  }, [name, email]);

  if (loading) {
    return (
      <SafeAreaView style={s.loadingScreen}>
        <GridBG />
        <View style={s.loadingInner}>
          <View
            style={{
              width: 70,
              height: 70,
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              marginBottom: 16,
            }}
          >
            <Brackets color={MINT} size={20} thick={2} />
            <ActivityIndicator size="large" color={MINT} />
          </View>
          <Text style={s.loadingTitle}>USER</Text>
          <Text style={s.loadingMono}>Loading profile module…</Text>
        </View>
      </SafeAreaView>
    );
  }

  function Header() {
    return (
      <View
        style={[
          s.headerCard,
          {
            borderColor: "rgba(0,255,135,0.22)",
            backgroundColor: "rgba(0,255,135,0.04)",
          },
        ]}
      >
        <Brackets color={MINT} size={12} thick={1.5} />
        <View style={[s.headerHairline, { backgroundColor: MINT }]} />

        <View style={s.topBar}>
          <View style={s.logoRow}>
            <View style={[s.statusDot, { backgroundColor: MINT }]} />
            <Text style={s.logoTxt}>USER MODULE</Text>
            <View
              style={[
                s.livePill,
                {
                  borderColor: "rgba(0,255,135,0.25)",
                  backgroundColor: "rgba(0,255,135,0.12)",
                },
              ]}
            >
              <Text style={[s.livePillTxt, { color: MINT }]}>PROFILE</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate("Dashboard")}
            activeOpacity={0.8}
            style={s.homeBtn}
          >
            <Image source={logo} style={s.homeBtnImg} />
            <Brackets color={MINT} size={7} thick={1} />
          </TouchableOpacity>
        </View>

        <Text style={s.heroTitle}>Profile{"\n"}Control</Text>
        <Text style={s.heroSub}>
          Manage identity, settings, accounts, and access state from one control
          surface.
        </Text>

        <ScanLine color={MINT} style={{ marginTop: 12, marginBottom: 12 }} />

        <View style={s.heroStatusRow}>
          <View style={[s.heroPill, { borderColor: "rgba(0,255,135,0.22)" }]}>
            <View style={[s.ctrlDot, { backgroundColor: MINT }]} />
            <Text style={[s.heroPillTxt, { color: MINT }]}>
              {subscription.toUpperCase()}
            </Text>
          </View>

          <View style={[s.heroPill, { borderColor: "rgba(0,212,255,0.22)" }]}>
            <View style={[s.ctrlDot, { backgroundColor: CYAN }]} />
            <Text style={[s.heroPillTxt, { color: CYAN }]}>{baseCurrency}</Text>
          </View>

          <View style={[s.heroPill, { borderColor: "rgba(167,139,250,0.22)" }]}>
            <View style={[s.ctrlDot, { backgroundColor: VIOLET }]} />
            <Text style={[s.heroPillTxt, { color: VIOLET }]}>{tz}</Text>
          </View>
        </View>
      </View>
    );
  }

  function IdentityPanel() {
    return (
      <View style={s.sectionCard}>
        <Brackets color={CYAN} size={10} thick={1} />
        <View style={[s.sectionHairline, { backgroundColor: CYAN }]} />
        <View style={s.sectionHeaderRow}>
          <View>
            <Text style={s.sectionEyebrow}>IDENTITY</Text>
            <Text style={s.sectionTitle}>Profile snapshot</Text>
          </View>
        </View>

        <View style={s.profileBlock}>
          <TouchableOpacity
            onPress={pickAvatar}
            style={s.avatarTouchable}
            activeOpacity={0.8}
          >
            <View style={s.avatarCircle}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatarImage} />
              ) : (
                <Text style={s.avatarText}>{initials}</Text>
              )}
            </View>
            <Text style={s.changePhotoText}>CHANGE PHOTO</Text>
          </TouchableOpacity>

          <Text style={s.profileName}>{name || "Your name"}</Text>
          <Text style={s.profileProfession}>
            {profession || "Add your profession"}
          </Text>
          <Text style={s.profileEmail}>{email || "No email"}</Text>
        </View>

        <View style={s.profileMiniStatsRow}>
          <View style={s.profileMiniPill}>
            <Text style={s.profileMiniValue}>{accounts.length}</Text>
            <Text style={s.profileMiniLabel}>ACCOUNTS</Text>
          </View>

          <View style={s.profileMiniPill}>
            <Text style={s.profileMiniValue}>{baseCurrency}</Text>
            <Text style={s.profileMiniLabel}>BASE</Text>
          </View>

          <View style={s.profileMiniPill}>
            <Text style={s.profileMiniValue} numberOfLines={1}>
              {tz}
            </Text>
            <Text style={s.profileMiniLabel}>TIME ZONE</Text>
          </View>
        </View>
      </View>
    );
  }

  function SettingsPanel() {
    return (
      <View style={s.sectionCard}>
        <Brackets color={MINT} size={10} thick={1} />
        <View style={[s.sectionHairline, { backgroundColor: MINT }]} />
        <View style={s.sectionHeaderRow}>
          <View>
            <Text style={s.sectionEyebrow}>PROFILE SETTINGS</Text>
            <Text style={s.sectionTitle}>Edit details</Text>
          </View>
        </View>

        {!!msg && (
          <View
            style={[
              s.noticeBox,
              {
                borderColor: "rgba(0,255,135,0.22)",
                backgroundColor: "rgba(0,255,135,0.06)",
              },
            ]}
          >
            <Text style={[s.noticeText, { color: MINT }]}>{msg}</Text>
          </View>
        )}

        {!!err && (
          <View
            style={[
              s.noticeBox,
              {
                borderColor: "rgba(167,139,250,0.22)",
                backgroundColor: "rgba(167,139,250,0.06)",
              },
            ]}
          >
            <Text style={[s.noticeText, { color: VIOLET }]}>{err}</Text>
          </View>
        )}

        <Labeled label="EMAIL ADDRESS">
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="name@example.com"
            placeholderTextColor={T_DIM}
          />
        </Labeled>

        <Labeled label="NAME">
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={T_DIM}
          />
        </Labeled>

        <Labeled label="PROFESSION">
          <TextInput
            style={s.input}
            value={profession}
            onChangeText={setProfession}
            placeholder="e.g. Software Engineer"
            placeholderTextColor={T_DIM}
          />
        </Labeled>

        <Labeled label="TIME ZONE">
          <TextInput
            style={s.input}
            value={tz}
            onChangeText={setTz}
            placeholder="e.g. Europe/Istanbul"
            placeholderTextColor={T_DIM}
          />
        </Labeled>

        <Labeled label="SUBSCRIPTION PLAN">
          <View style={[s.input, { justifyContent: "center" }]}>
            <Text style={{ color: T_HI, fontWeight: "700" }}>
              {subscription}
            </Text>
          </View>
        </Labeled>

        <Labeled label="BASE CURRENCY">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: "row", gap: 8 }}
          >
            {CURRENCIES.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={baseCurrency === c}
                onPress={() => setBaseCurrency(c)}
                accent={CYAN}
              />
            ))}
          </ScrollView>
        </Labeled>

        <ScanLine color={MINT} style={{ marginTop: 10, marginBottom: 12 }} />

        <View style={s.actionsRow}>
          <TouchableOpacity
            onPress={saveProfile}
            disabled={saving}
            style={[s.primaryBtn, saving && { opacity: 0.65 }]}
          >
            <Text style={s.primaryBtnText}>
              {saving ? "SAVING…" : "SAVE CHANGES"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setDeleteConfirmVisible(true)}
            disabled={deleting}
            style={[s.dangerOutlineBtn, deleting && { opacity: 0.65 }]}
          >
            <Text style={s.dangerOutlineText}>
              {deleting ? "DELETING…" : "DELETE"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={logout} style={s.logoutOutlineBtn}>
          <Text style={s.logoutOutlineText}>LOG OUT</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function AccountsPanel() {
    return (
      <View style={s.sectionCard}>
        <Brackets color={ORANGE} size={10} thick={1} />
        <View style={[s.sectionHairline, { backgroundColor: ORANGE }]} />
        <View style={s.sectionHeaderRow}>
          <View>
            <Text style={s.sectionEyebrow}>ACCOUNT REGISTRY</Text>
            <Text style={s.sectionTitle}>Linked accounts</Text>
          </View>

          <TouchableOpacity
            style={s.smallPrimaryBtn}
            onPress={() => {
              setEditingAcc(null);
              setAccModalVisible(true);
            }}
            disabled={accBusy}
            activeOpacity={0.8}
          >
            <Text style={s.smallPrimaryBtnText}>+ ADD</Text>
          </TouchableOpacity>
        </View>

        {!!accErr && (
          <View
            style={[
              s.noticeBox,
              {
                borderColor: "rgba(167,139,250,0.22)",
                backgroundColor: "rgba(167,139,250,0.06)",
              },
            ]}
          >
            <Text style={[s.noticeText, { color: VIOLET }]}>{accErr}</Text>
          </View>
        )}

        {accounts.length === 0 ? (
          <Text style={s.emptyText}>
            No accounts yet. Add your first account to start tracking balances.
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {accounts.map((a) => (
              <View key={a._id} style={s.accountRow}>
                <Brackets color={ORANGE} size={7} thick={1} />

                <View style={s.accountTopRow}>
                  <View
                    style={[
                      s.rowCatPill,
                      { borderColor: "rgba(249,115,22,0.22)" },
                    ]}
                  >
                    <View style={[s.rowCatDot, { backgroundColor: ORANGE }]} />
                    <Text style={[s.rowCatTxt, { color: ORANGE }]}>
                      {a.type?.toUpperCase?.() || "ACCOUNT"}
                    </Text>
                  </View>

                  <Text style={[s.accountBalance, { color: ORANGE }]}>
                    {fmtMoneyMinor(a.balance || 0, a.currency || "USD")}
                  </Text>
                </View>

                <Text style={s.accountName}>{a.name}</Text>
                <Text style={s.accountMeta}>
                  {a.currency} • {a.institution || "No institution"}{" "}
                  {a.last4 ? `• **** ${a.last4}` : ""}
                </Text>

                <ScanLine
                  color={ORANGE}
                  style={{ marginTop: 10, marginBottom: 8 }}
                />

                <View style={s.accountActionRow}>
                  <TouchableOpacity
                    style={s.rowBtnEdit}
                    onPress={() => {
                      setEditingAcc(a);
                      setAccModalVisible(true);
                    }}
                  >
                    <Text style={[s.rowBtnTxt, { color: CYAN }]}>EDIT</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.rowBtnDel}
                    onPress={() => deleteAccount(a)}
                  >
                    <Text style={[s.rowBtnTxt, { color: VIOLET }]}>DELETE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <GridBG />

      <ScrollView
        style={s.content}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {Header()}
        {IdentityPanel()}
        {SettingsPanel()}
        {AccountsPanel()}
      </ScrollView>

      {/* Delete confirmation */}
      <Modal
        transparent
        visible={deleteConfirmVisible}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Brackets color={VIOLET} size={10} thick={1.5} />
            <View style={[s.modalHairline, { backgroundColor: VIOLET }]} />

            <Text style={s.modalTitle}>DELETE YOUR ACCOUNT?</Text>
            <Text style={s.modalText}>
              This is a soft delete. Your account will be deactivated and
              hidden. You can contact support to restore it.
            </Text>

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setDeleteConfirmVisible(false)}
                disabled={deleting}
              >
                <Text style={s.modalCancelText}>NO, KEEP IT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.modalDangerBtn}
                onPress={deleteMe}
                disabled={deleting}
              >
                <Text style={s.modalDangerText}>
                  {deleting ? "DELETING…" : "YES, DELETE"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AccountModal
        visible={accModalVisible}
        onClose={() => setAccModalVisible(false)}
        initial={editingAcc}
        onSubmit={saveAccount}
        busy={accBusy}
      />
    </SafeAreaView>
  );
}

/* ───────────────────────────── account modal ─────────────────────────────── */
function AccountModal({ visible, onClose, initial, onSubmit, busy }) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "checking");
  const [currency, setCurrency] = useState(initial?.currency || "USD");
  const [balanceMajor, setBalanceMajor] = useState(
    initial
      ? minorToMajorString(initial.balance || 0, initial.currency || "USD")
      : "0",
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
          : "0",
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
      <KeyboardAvoidingView
        style={s.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.modalCard}>
          <Brackets color={ORANGE} size={10} thick={1.5} />
          <View style={[s.modalHairline, { backgroundColor: ORANGE }]} />

          <Text style={s.modalTitle}>
            {initial ? "EDIT ACCOUNT" : "ADD ACCOUNT"}
          </Text>

          <ScrollView
            style={{ maxHeight: 380, marginTop: 10 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Labeled label="ACCOUNT NAME">
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Main Checking"
                placeholderTextColor={T_DIM}
              />
            </Labeled>

            <Labeled label="TYPE">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: "row", gap: 8 }}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={type === t}
                    onPress={() => setType(t)}
                    accent={ORANGE}
                  />
                ))}
              </ScrollView>
            </Labeled>

            <Labeled label="CURRENCY">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: "row", gap: 8 }}
              >
                {CURRENCIES.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    selected={currency === c}
                    onPress={() => setCurrency(c)}
                    accent={CYAN}
                  />
                ))}
              </ScrollView>
            </Labeled>

            <Labeled label="CURRENT BALANCE">
              <TextInput
                style={s.input}
                value={balanceMajor}
                onChangeText={setBalanceMajor}
                inputMode="decimal"
                placeholder="e.g. 1250.00"
                placeholderTextColor={T_DIM}
              />
            </Labeled>

            <Labeled label="INSTITUTION (OPTIONAL)">
              <TextInput
                style={s.input}
                value={institution}
                onChangeText={setInstitution}
                placeholder="Your bank"
                placeholderTextColor={T_DIM}
              />
            </Labeled>

            <Labeled label="LAST 4 (OPTIONAL)">
              <TextInput
                style={s.input}
                value={last4}
                onChangeText={setLast4}
                placeholder="1234"
                placeholderTextColor={T_DIM}
                maxLength={4}
                keyboardType="number-pad"
              />
            </Labeled>
          </ScrollView>

          <View style={s.modalActions}>
            <TouchableOpacity
              style={s.modalCancelBtn}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={s.modalCancelText}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.modalPrimaryBtn}
              onPress={handleSubmit}
              disabled={busy}
            >
              <Text style={s.modalPrimaryText}>
                {busy ? "SAVING…" : initial ? "SAVE" : "ADD"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ───────────────────────────── styles ────────────────────────────────────── */
const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    flex: 1,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingInner: { alignItems: "center", position: "relative", padding: 30 },
  loadingTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: 4,
    marginBottom: 6,
  },
  loadingMono: { fontSize: 10, color: T_DIM, letterSpacing: 1.5 },

  headerHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  logoTxt: { fontSize: 13, fontWeight: "800", color: T_HI, letterSpacing: 3 },
  homeBtn: {
    width: 36,
    height: 36,
    borderRadius: 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.20)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sectionCard: {
    margin: 12,
    marginTop: 0,
    marginBottom: 12,
    padding: 16,
    borderRadius: 4,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BD,
    overflow: "hidden",
    position: "relative",
  },
  sectionHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
    marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: -0.3,
  },

  profileBlock: {
    alignItems: "center",
  },
  avatarTouchable: {
    alignItems: "center",
    marginBottom: 8,
  },
  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: 999,
    backgroundColor: "rgba(0,255,135,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  changePhotoText: {
    fontSize: 10,
    color: MINT,
    fontWeight: "800",
    letterSpacing: 1,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: "800",
    color: T_HI,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: T_HI,
    marginTop: 2,
  },
  profileProfession: {
    marginTop: 2,
    fontSize: 13,
    color: T_MID,
  },
  profileEmail: {
    marginTop: 2,
    fontSize: 12,
    color: T_DIM,
  },

  statCard: {
    position: "relative",
    borderRadius: 4,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    overflow: "hidden",
  },
  statHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },
  statLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: T_DIM,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  statHint: {
    fontSize: 9,
    color: T_DIM,
    marginTop: 5,
    letterSpacing: 0.3,
  },

  noticeBox: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  noticeText: {
    fontSize: 12,
    fontWeight: "600",
  },

  label: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: 2,
  },
  input: {
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: T_HI,
    backgroundColor: "rgba(255,255,255,0.025)",
    fontSize: 13,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.025)",
    marginRight: 6,
  },
  chipSmall: { paddingHorizontal: 8, paddingVertical: 5 },
  chipSelected: { backgroundColor: "rgba(255,255,255,0.04)" },
  chipDot: { width: 4, height: 4, borderRadius: 999 },
  chipText: { fontSize: 11, color: T_DIM },
  chipTextSmall: { fontSize: 10 },
  chipTextSelected: { fontWeight: "700" },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 2,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: MINT,
  },
  primaryBtnText: {
    color: BG,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
  },
  dangerOutlineBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.28)",
    backgroundColor: "rgba(167,139,250,0.08)",
  },
  dangerOutlineText: {
    color: VIOLET,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
  },
  logoutOutlineBtn: {
    marginTop: 10,
    borderRadius: 2,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  logoutOutlineText: {
    color: T_MID,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
  },

  smallPrimaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 2,
    backgroundColor: ORANGE,
  },
  smallPrimaryBtnText: {
    color: BG,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  emptyText: {
    paddingVertical: 12,
    fontSize: 12,
    color: T_DIM,
    textAlign: "center",
    letterSpacing: 0.5,
  },

  accountRow: {
    position: "relative",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  accountTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  accountName: {
    fontSize: 14,
    fontWeight: "700",
    color: T_HI,
    marginBottom: 2,
  },
  accountMeta: {
    fontSize: 11,
    color: T_MID,
  },
  accountBalance: {
    marginLeft: "auto",
    fontSize: 15,
    fontWeight: "800",
  },

  rowCatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  rowCatDot: { width: 5, height: 5, borderRadius: 999 },
  rowCatTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },

  accountActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  rowBtnEdit: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.25)",
    backgroundColor: "rgba(0,212,255,0.06)",
  },
  rowBtnDel: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)",
    backgroundColor: "rgba(167,139,250,0.06)",
  },
  rowBtnTxt: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3,5,8,0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 4,
    backgroundColor: BG,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BD,
    position: "relative",
    overflow: "hidden",
  },
  modalHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: 3,
    marginBottom: 6,
    marginTop: 4,
  },
  modalText: {
    marginTop: 6,
    fontSize: 13,
    color: T_MID,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  modalCancelText: {
    color: T_MID,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  modalDangerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 2,
    backgroundColor: VIOLET,
  },
  modalDangerText: {
    color: BG,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  modalPrimaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 2,
    backgroundColor: ORANGE,
  },
  modalPrimaryText: {
    color: BG,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  profileMiniStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },

  profileMiniPill: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.025)",
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },

  profileMiniValue: {
    fontSize: 13,
    fontWeight: "800",
    color: T_HI,
    marginBottom: 3,
  },

  profileMiniLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 1.4,
  },
  headerCard: {
    margin: 12,
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  logoTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: 2.4,
  },

  livePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 1,
  },

  livePillTxt: {
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  homeBtn: {
    width: 32,
    height: 32,
    borderRadius: 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.20)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: -0.5,
    lineHeight: 24,
    marginBottom: 4,
  },

  heroSub: {
    fontSize: 11,
    color: T_MID,
    lineHeight: 15,
  },

  heroStatusRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },

  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
  },

  heroPillTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
