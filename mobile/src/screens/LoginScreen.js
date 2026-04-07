// mobile/src/screens/LoginScreen.js
/* eslint-disable no-unused-vars */

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  SafeAreaView,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";

/* ──────────────────────────────────────────────────────────
   THEME — synced with Dashboard / Expenses cyberpunk HUD
────────────────────────────────────────────────────────── */
const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const CARD_BG = "rgba(255,255,255,0.025)";
const CARD_BD = "rgba(255,255,255,0.07)";
const T_HI = "#e2e8f0";
const T_MID = "rgba(226,232,240,0.55)";
const T_DIM = "rgba(226,232,240,0.32)";
const DANGER = "#fb7185";

/* Consent (local gate) */
const CONSENT_KEY = (userId) => `consent:${String(userId)}`;

/* Verification persistence keys */
const PENDING_VERIFY_EMAIL_KEY = "pendingVerifyEmail";
const PENDING_REG_TOKEN_KEY = "pendingRegToken";

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
          top: height * 0.42,
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

function ChipButton({ label, accent = MINT, onPress, disabled, loading }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.ctrlPill,
        { borderColor: `${accent}55` },
        disabled && { opacity: 0.6 },
      ]}
    >
      <View style={[styles.ctrlDot, { backgroundColor: accent }]} />
      <Text style={[styles.ctrlTxt, { color: accent }]}>
        {loading ? "PROCESSING" : label}
      </Text>
    </TouchableOpacity>
  );
}

function StatusCard({ title, body, accent = VIOLET }) {
  return (
    <View
      style={[
        styles.infoCard,
        {
          borderColor: `${accent}33`,
          backgroundColor:
            accent === DANGER
              ? "rgba(251,113,133,0.08)"
              : accent === MINT
                ? "rgba(0,255,135,0.08)"
                : "rgba(167,139,250,0.08)",
        },
      ]}
    >
      <Brackets color={accent} size={8} thick={1} />
      <Text style={[styles.infoTitle, { color: accent }]}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

export default function LoginScreen({ navigation, onLoggedIn }) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginReason, setLoginReason] = useState("");

  const [socialLoading, setSocialLoading] = useState(false);
  const [socialErr, setSocialErr] = useState("");

  const [showVerify, setShowVerify] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyRegToken, setVerifyRegToken] = useState("");
  const [code, setCode] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [verifyErr, setVerifyErr] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const API_BASE =
    (api?.defaults?.baseURL || "").replace(/\/+$/, "") ||
    "http://localhost:4000";

  const maskedEmail = useMemo(() => {
    const email = verifyEmail?.trim();
    if (!email) return "";
    const [u, d] = email.split("@");
    if (!d) return email;
    const maskU =
      u.length <= 2
        ? `${u[0]}*`
        : `${u[0]}${"*".repeat(Math.max(1, u.length - 2))}${u[u.length - 1]}`;
    return `${maskU}@${d}`;
  }, [verifyEmail]);

  async function storeUser(data) {
    try {
      if (data?.user?.id) {
        await AsyncStorage.setItem("defaultId", String(data.user.id));
        await AsyncStorage.setItem("userEmail", data.user.email || "");
        await AsyncStorage.setItem("userName", data.user.name || "");
      }
      if (data?.token) {
        await AsyncStorage.setItem("token", data.token);
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
      }
    } catch (e) {
      console.warn("Failed to store user locally:", e);
    }
  }

  function goToDashboard() {
    if (typeof onLoggedIn === "function") {
      onLoggedIn();
      return;
    }
    navigation?.replace?.("MainTabs");
  }

  async function hasAcceptedConsent(userId) {
    try {
      if (!userId) return false;
      const raw = await AsyncStorage.getItem(CONSENT_KEY(userId));
      if (!raw) return false;
      const consent = JSON.parse(raw);
      return !!(consent?.termsAccepted && consent?.cookiesAccepted);
    } catch {
      return false;
    }
  }

  async function routeAfterAuth(data) {
    await storeUser(data);

    const userId =
      data?.user?.id || (await AsyncStorage.getItem("defaultId")) || null;

    const ok = await hasAcceptedConsent(userId);
    if (!ok) {
      if (navigation?.replace) {
        navigation.replace("Terms", {
          userId: String(userId || ""),
          nextRoute: "MainTabs",
        });
        return;
      }

      Alert.alert(
        "Terms required",
        "You must accept Terms & Conditions and Cookies to continue.",
      );
      return;
    }

    goToDashboard();
  }

  async function openVerifyModal(email, regTokenMaybe) {
    const cleanEmail = (email || "").trim();
    setVerifyEmail(cleanEmail);
    setCode("");
    setVerifyErr("");
    setVerifyMsg("");

    if (regTokenMaybe) {
      setVerifyRegToken(String(regTokenMaybe));
      await AsyncStorage.setItem(PENDING_REG_TOKEN_KEY, String(regTokenMaybe));
    } else {
      const stored = await AsyncStorage.getItem(PENDING_REG_TOKEN_KEY);
      setVerifyRegToken(stored || "");
    }

    await AsyncStorage.setItem(PENDING_VERIFY_EMAIL_KEY, cleanEmail);
    setShowVerify(true);
  }

  async function onLogin() {
    try {
      setLoginErr("");
      setLoginReason("");

      if (!loginEmail || !loginEmail.trim()) {
        setLoginErr("Please enter your email address.");
        return;
      }

      if (!loginPassword || !loginPassword.trim()) {
        setLoginErr("Please enter your password.");
        return;
      }

      setLoginLoading(true);

      const resp = await api.post("/auth/login", {
        email: loginEmail.trim(),
        password: loginPassword,
      });

      const data = resp?.data || {};
      setLoginLoading(false);

      await routeAfterAuth(data);
    } catch (e) {
      setLoginLoading(false);

      const status = e?.response?.status;
      const body = e?.response?.data || {};
      const errMsg =
        body.error || e.message || "Login failed. Please try again.";

      if (
        status === 403 &&
        (body.reason === "UNVERIFIED" || body.needsVerification === true)
      ) {
        const email = (loginEmail || "").trim();
        setLoginReason("UNVERIFIED");

        const message = body.maskedEmail
          ? `Your account is not verified yet. Check your inbox (${body.maskedEmail}) or resend the code.`
          : "Your account is not verified yet. Check your inbox or resend the code.";
        setLoginErr(message);

        await openVerifyModal(email, body?.regToken);
        return;
      }

      setLoginErr(errMsg);
    }
  }

  async function startSocial(provider) {
    try {
      setSocialErr("");
      setSocialLoading(true);
      const next = encodeURIComponent("/dashboard");
      const url = `${API_BASE}/auth/${provider}?next=${next}`;
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      } else {
        setSocialErr("Cannot open browser. Please try again.");
        setSocialLoading(false);
      }
    } catch (err) {
      setSocialErr(`Could not start social sign in. ${String(err)}`);
      setSocialLoading(false);
    }
  }

  async function signInWithAppleNative() {
    try {
      if (Platform.OS !== "ios") {
        Alert.alert(
          "Unavailable",
          "Sign in with Apple is available on iOS only.",
        );
        return;
      }

      setSocialErr("");
      setSocialLoading(true);

      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!cred?.identityToken) {
        setSocialLoading(false);
        setSocialErr("Apple sign-in failed: missing identity token.");
        return;
      }

      const fullName = cred?.fullName
        ? [cred.fullName.givenName, cred.fullName.familyName]
            .filter(Boolean)
            .join(" ")
        : "";

      const resp = await api.post("/auth/apple/mobile", {
        identityToken: cred.identityToken,
        fullName,
      });

      const data = resp?.data || {};
      setSocialLoading(false);

      await routeAfterAuth(data);
    } catch (e) {
      setSocialLoading(false);

      if (e?.code === "ERR_REQUEST_CANCELED") return;

      setSocialErr(
        e?.response?.data?.error ||
          e?.message ||
          "Apple sign-in failed. Please try again.",
      );
    }
  }

  async function onVerifySubmit() {
    try {
      const email = (verifyEmail || "").trim();
      if (!email) {
        setVerifyErr("Email is missing.");
        return;
      }

      const codeTrimmed = (code || "").trim();
      if (!codeTrimmed) {
        setVerifyErr("Please enter the verification code.");
        return;
      }

      setVerifyErr("");
      setVerifyMsg("");
      setVerifying(true);

      const storedRegToken =
        verifyRegToken || (await AsyncStorage.getItem(PENDING_REG_TOKEN_KEY));

      if (!storedRegToken) {
        setVerifying(false);
        setVerifyErr("Missing verification token. Please tap Resend code.");
        return;
      }

      await api.post("/auth/verify-email", {
        regToken: storedRegToken,
        code: codeTrimmed,
      });

      setVerifyMsg("Email verified. Signing you in...");

      const { data } = await api.post("/auth/login", {
        email,
        password: loginPassword,
      });

      await AsyncStorage.removeItem(PENDING_VERIFY_EMAIL_KEY);
      await AsyncStorage.removeItem(PENDING_REG_TOKEN_KEY);

      setVerifying(false);
      setShowVerify(false);

      await routeAfterAuth(data);
    } catch (e) {
      setVerifying(false);
      setVerifyErr(
        e?.response?.data?.error ||
          "Verification failed. Please check the code and try again.",
      );
    }
  }

  async function onResendCode() {
    try {
      const storedRegToken =
        verifyRegToken || (await AsyncStorage.getItem(PENDING_REG_TOKEN_KEY));

      if (!storedRegToken) {
        setVerifyErr("Missing regToken. Please sign up again.");
        return;
      }

      setVerifyErr("");
      setVerifyMsg("");
      setResending(true);

      const resp = await api.post("/auth/resend-code", {
        regToken: storedRegToken,
      });
      const data = resp?.data || {};

      if (data?.regToken) {
        const rt = String(data.regToken);
        setVerifyRegToken(rt);
        await AsyncStorage.setItem(PENDING_REG_TOKEN_KEY, rt);
      }

      setVerifyMsg("A new verification code has been sent to your email.");
      setResending(false);
    } catch (e) {
      setResending(false);
      setVerifyErr(e?.response?.data?.error || "Could not resend the code.");
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <GridBG />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerCard}>
            <Brackets color={MINT} size={12} thick={1.5} />
            <View style={[styles.headerHairline, { backgroundColor: MINT }]} />

            <View style={styles.topBar}>
              <View style={styles.logoRow}>
                <View style={[styles.statusDot, { backgroundColor: MINT }]} />
                <Text style={styles.logoTxt}>AUTH</Text>
                <View
                  style={[
                    styles.livePill,
                    {
                      borderColor: "rgba(0,255,135,0.25)",
                      backgroundColor: "rgba(0,255,135,0.12)",
                    },
                  ]}
                >
                  <Text style={[styles.livePillTxt, { color: MINT }]}>
                    LOGIN MODULE
                  </Text>
                </View>
              </View>

              <View style={styles.homeBtn}>
                <Image source={logo} style={styles.homeBtnImg} />
                <Brackets color={MINT} size={7} thick={1} />
              </View>
            </View>

            <Text style={styles.heroTitle}>Access{"\n"}Nummoria</Text>
            <Text style={styles.heroSub}>
              Sign in to your account and return to your financial command
              center.
            </Text>

            <ScanLine
              color={MINT}
              style={{ marginTop: 12, marginBottom: 14 }}
            />

            <View style={styles.controlsRow}>
              <ChipButton
                label="LOGIN"
                accent={MINT}
                disabled={loginLoading || socialLoading}
              />
              <ChipButton
                label="SECURE"
                accent={CYAN}
                disabled={loginLoading || socialLoading}
              />
            </View>

            {loginErr ? (
              <StatusCard
                title={
                  loginReason === "UNVERIFIED" ? "UNVERIFIED" : "AUTH ERROR"
                }
                body={loginErr}
                accent={DANGER}
              />
            ) : null}

            {socialErr ? (
              <StatusCard
                title="SOCIAL AUTH"
                body={socialErr}
                accent={VIOLET}
              />
            ) : null}

            <View style={styles.formBlock}>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <View style={styles.inputWrap}>
                <View style={[styles.inputDot, { backgroundColor: MINT }]} />
                <TextInput
                  style={styles.input}
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="you@nummoria.com"
                  placeholderTextColor={T_DIM}
                  editable={!loginLoading}
                />
              </View>

              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View style={styles.inputWrap}>
                <View style={[styles.inputDot, { backgroundColor: VIOLET }]} />
                <TextInput
                  style={styles.input}
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={T_DIM}
                  editable={!loginLoading}
                />
              </View>

              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    "Forgot password",
                    "Password reset flow coming soon.",
                  )
                }
                activeOpacity={0.75}
              >
                <Text style={styles.forgotText}>FORGOT PASSWORD?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  loginLoading && styles.buttonDisabled,
                ]}
                onPress={onLogin}
                disabled={loginLoading}
                activeOpacity={0.8}
              >
                <Brackets color={BG} size={8} thick={1} />
                {loginLoading ? (
                  <ActivityIndicator color={BG} />
                ) : (
                  <Text style={styles.primaryBtnTxt}>ENTER SYSTEM</Text>
                )}
              </TouchableOpacity>

              {loginReason === "UNVERIFIED" ? (
                <View style={styles.inlineActions}>
                  <TouchableOpacity
                    style={styles.inlineBtn}
                    onPress={onResendCode}
                    disabled={resending}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.inlineBtnTxt, { color: CYAN }]}>
                      {resending ? "RESENDING..." : "RESEND CODE"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.inlineBtn,
                      { borderColor: "rgba(0,255,135,0.22)" },
                    ]}
                    onPress={() => setShowVerify(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.inlineBtnTxt, { color: MINT }]}>
                      ENTER CODE
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <ScanLine
              color={CYAN}
              style={{ marginTop: 18, marginBottom: 14 }}
            />

            <View style={styles.sectionRow}>
              <Text style={styles.sectionEyebrow}>SOCIAL ACCESS</Text>
              <Text style={styles.sectionHint}>Browser / native providers</Text>
            </View>

            <TouchableOpacity
              style={[styles.socialBtn, socialLoading && styles.buttonDisabled]}
              onPress={() => startSocial("google")}
              disabled={socialLoading}
              activeOpacity={0.8}
            >
              <View
                style={[styles.socialIconBox, { borderColor: `${CYAN}44` }]}
              >
                <AntDesign name="google" size={16} color={CYAN} />
              </View>
              <Text style={styles.socialText}>
                {socialLoading ? "REDIRECTING..." : "SIGN IN WITH GOOGLE"}
              </Text>
            </TouchableOpacity>

            {Platform.OS === "ios" ? (
              <View style={{ marginTop: 10 }}>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={
                    AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                  }
                  buttonStyle={
                    AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={4}
                  style={{ width: "100%", height: 48 }}
                  onPress={signInWithAppleNative}
                  disabled={socialLoading}
                />
              </View>
            ) : null}

            <View style={styles.footerRow}>
              <Text style={styles.footerHint}>NEW AROUND HERE?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("SignUp")}
                activeOpacity={0.75}
              >
                <Text style={styles.footerLink}>CREATE ACCOUNT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showVerify}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVerify(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <Brackets color={VIOLET} size={10} thick={1.5} />
            <View style={[styles.modalHairline, { backgroundColor: VIOLET }]} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>VERIFY EMAIL</Text>
                <Text style={styles.modalSub}>
                  We sent a six-digit code to{" "}
                  <Text style={styles.modalEmail}>{maskedEmail}</Text>
                </Text>
              </View>

              <TouchableOpacity onPress={() => setShowVerify(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            {verifyErr ? (
              <StatusCard
                title="VERIFY ERROR"
                body={verifyErr}
                accent={DANGER}
              />
            ) : null}

            {verifyMsg ? (
              <StatusCard
                title="VERIFY STATUS"
                body={verifyMsg}
                accent={MINT}
              />
            ) : null}

            <Text style={styles.fieldLabel}>VERIFICATION CODE</Text>
            <View style={styles.inputWrap}>
              <View style={[styles.inputDot, { backgroundColor: VIOLET }]} />
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
                placeholder="Enter 6-digit code"
                placeholderTextColor={T_DIM}
                editable={!verifying}
              />
            </View>

            <Text style={styles.modalHint}>
              Code expires 15 minutes after request.
            </Text>

            <ScanLine
              color={VIOLET}
              style={{ marginTop: 16, marginBottom: 14 }}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setShowVerify(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnTxt, { color: T_MID }]}>
                  CANCEL
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtnPrimary,
                  verifying && styles.buttonDisabled,
                ]}
                onPress={onVerifySubmit}
                disabled={verifying}
                activeOpacity={0.8}
              >
                {verifying ? (
                  <ActivityIndicator color={BG} />
                ) : (
                  <Text style={styles.modalPrimaryTxt}>VERIFY & CONTINUE</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={onResendCode}
              disabled={resending}
              activeOpacity={0.75}
              style={{ marginTop: 12 }}
            >
              <Text style={styles.resendLink}>
                {resending ? "RESENDING..." : "RESEND CODE"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: BG },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingTop: 26,
    paddingBottom: 32,
  },

  headerCard: {
    marginVertical: 8,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.20)",
    backgroundColor: "rgba(0,255,135,0.035)",
    overflow: "hidden",
    position: "relative",
  },
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
  livePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
  },
  livePillTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 1.3 },

  homeBtn: {
    width: 38,
    height: 38,
    borderRadius: 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.20)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  homeBtnImg: { width: "100%", height: "100%", resizeMode: "cover" },

  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: -0.7,
    lineHeight: 32,
    marginBottom: 6,
  },
  heroSub: { fontSize: 13, color: T_MID, lineHeight: 18 },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  ctrlPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  ctrlDot: { width: 5, height: 5, borderRadius: 999 },
  ctrlTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },

  infoCard: {
    position: "relative",
    borderRadius: 4,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  infoTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  infoBody: {
    fontSize: 12,
    color: T_HI,
    lineHeight: 17,
    paddingRight: 6,
  },

  formBlock: { marginTop: 2 },

  fieldLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: 10,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: CARD_BD,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  inputDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginRight: 8,
    opacity: 0.75,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: T_HI,
    paddingVertical: 10,
  },

  forgotText: {
    marginTop: 10,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: CYAN,
    textAlign: "right",
  },

  primaryBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 2,
    backgroundColor: MINT,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  primaryBtnTxt: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: BG,
  },

  buttonDisabled: { opacity: 0.65 },

  inlineActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  inlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  inlineBtnTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },

  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionEyebrow: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
  },
  sectionHint: {
    fontSize: 9,
    color: T_DIM,
    letterSpacing: 0.6,
  },

  socialBtn: {
    marginTop: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: CARD_BG,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  socialIconBox: {
    width: 28,
    height: 28,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
    alignItems: "center",
    justifyContent: "center",
  },
  socialText: {
    fontSize: 11,
    color: T_HI,
    fontWeight: "800",
    letterSpacing: 1.1,
  },

  footerRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  footerHint: {
    fontSize: 11,
    color: T_DIM,
    letterSpacing: 0.8,
  },
  footerLink: {
    fontSize: 11,
    fontWeight: "800",
    color: MINT,
    letterSpacing: 1,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3,5,8,0.92)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 4,
    padding: 18,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: CARD_BD,
    overflow: "hidden",
    position: "relative",
  },
  modalHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: 2.4,
    marginBottom: 6,
    marginTop: 4,
  },
  modalSub: { fontSize: 12, color: T_MID, lineHeight: 18, maxWidth: "92%" },
  modalEmail: { color: T_HI, fontWeight: "700" },
  modalClose: {
    fontSize: 26,
    lineHeight: 26,
    color: T_DIM,
    marginTop: 2,
  },
  modalHint: {
    marginTop: 5,
    fontSize: 10,
    color: T_DIM,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalBtnCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  modalBtnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 2,
    backgroundColor: VIOLET,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 138,
  },
  modalBtnTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  modalPrimaryTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: BG,
  },
  resendLink: {
    textAlign: "center",
    fontSize: 10,
    color: CYAN,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
