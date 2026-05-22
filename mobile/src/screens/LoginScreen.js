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
  Modal,
  SafeAreaView,
} from "react-native";
import { AntDesign, Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";
import { useTheme } from "../theme/ThemeContext";

WebBrowser.maybeCompleteAuthSession();

/* Consent / local persistence */
const CONSENT_KEY = (userId) => `consent:${String(userId)}`;
const PENDING_VERIFY_EMAIL_KEY = "pendingVerifyEmail";
const PENDING_REG_TOKEN_KEY = "pendingRegToken";

/* Google mobile OAuth */
const GOOGLE_MOBILE_REDIRECT_URI = "nummoria://auth/google";

function getQueryParamFromUrl(url, key) {
  try {
    const query =
      String(url || "")
        .split("?")[1]
        ?.split("#")[0] || "";
    const params = new URLSearchParams(query);
    return params.get(key);
  } catch {
    return null;
  }
}

function normalizeUser(raw) {
  const user = raw?.user || raw || {};
  return {
    id: user.id || user._id,
    email: user.email || "",
    name: user.name || "",
    role: user.role || "user",
    tz: user.tz || "UTC",
    baseCurrency: user.baseCurrency || "USD",
    profession: user.profession || "",
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    subscription: user.subscription || "Standard",
  };
}

export default function LoginScreen({ navigation, onLoggedIn }) {
  const { colors, mode, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginReason, setLoginReason] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

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
        rememberMe: stayLoggedIn,
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
          ? `Your account isn't verified yet. Check ${body.maskedEmail} or resend the code.`
          : "Your account isn't verified yet. Check your inbox or resend the code.";
        setLoginErr(message);
        await openVerifyModal(email, body?.regToken);
        return;
      }
      setLoginErr(errMsg);
    }
  }

  async function startGoogleMobile() {
    try {
      setSocialErr("");
      setSocialLoading(true);
      const authUrl = `${API_BASE}/auth/google/mobile?redirect_uri=${encodeURIComponent(
        GOOGLE_MOBILE_REDIRECT_URI,
      )}&next=${encodeURIComponent("/dashboard")}`;
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        GOOGLE_MOBILE_REDIRECT_URI,
      );
      if (result.type !== "success" || !result.url) {
        setSocialLoading(false);
        return;
      }
      const token = getQueryParamFromUrl(result.url, "token");
      if (!token) {
        throw new Error("Google login did not return a token.");
      }
      await AsyncStorage.setItem("token", token);
      api.defaults.headers.Authorization = `Bearer ${token}`;
      const meResp = await api.get("/me");
      const user = normalizeUser(meResp?.data);
      setSocialLoading(false);
      await routeAfterAuth({ ok: true, token, user });
    } catch (err) {
      console.warn("Google mobile login failed:", err);
      setSocialLoading(false);
      setSocialErr(
        err?.response?.data?.error ||
          err?.message ||
          "Google sign-in failed. Please try again.",
      );
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

      setVerifyMsg("Email verified. Signing you in…");

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
        setVerifyErr("Missing token. Please sign up again.");
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
      setVerifyMsg("A new code has been sent to your email.");
      setResending(false);
    } catch (e) {
      setResending(false);
      setVerifyErr(e?.response?.data?.error || "Could not resend the code.");
    }
  }

  /* ──────────────────────────────────────────────────────────
     RENDER
  ────────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.screen}>
      {/* Soft ambient gradient blobs in the background */}
      <View pointerEvents="none" style={styles.bgWrap}>
        <LinearGradient
          colors={[colors.mintSoft, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.blob, { top: -60, left: -40 }]}
        />
        <LinearGradient
          colors={[colors.lilacSoft, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.blob, { bottom: 40, right: -50 }]}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.logoBubble}>
              <Image source={logo} style={styles.logoImg} />
            </View>
            <Text style={styles.heroTitle}>Welcome back</Text>
            <Text style={styles.heroSub}>
              Sign in to pick up where you left off.
            </Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            {loginErr ? (
              <View style={styles.notice}>
                <Feather name="alert-circle" size={14} color={colors.rose} />
                <Text style={styles.noticeTxt}>{loginErr}</Text>
              </View>
            ) : null}

            {socialErr ? (
              <View style={styles.notice}>
                <Feather name="alert-circle" size={14} color={colors.rose} />
                <Text style={styles.noticeTxt}>{socialErr}</Text>
              </View>
            ) : null}

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Feather
                name="mail"
                size={16}
                color={colors.textLow}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={loginEmail}
                onChangeText={setLoginEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@nummoria.com"
                placeholderTextColor={colors.textLow}
                editable={!loginLoading}
              />
            </View>

            {/* Password */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    "Forgot password",
                    "Password reset is coming very soon.",
                  )
                }
                hitSlop={8}
              >
                <Text style={styles.linkTxt}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrap}>
              <Feather
                name="lock"
                size={16}
                color={colors.textLow}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry={!showPwd}
                placeholder="••••••••"
                placeholderTextColor={colors.textLow}
                editable={!loginLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPwd((v) => !v)}
                hitSlop={8}
                style={styles.inputTrail}
              >
                <Feather
                  name={showPwd ? "eye-off" : "eye"}
                  size={16}
                  color={colors.textLow}
                />
              </TouchableOpacity>
            </View>

            {/* Stay logged in */}
            <TouchableOpacity
              style={styles.stayRow}
              onPress={() => setStayLoggedIn((v) => !v)}
              activeOpacity={0.7}
              disabled={loginLoading}
            >
              <View
                style={[
                  styles.checkbox,
                  stayLoggedIn && {
                    backgroundColor: colors.mint,
                    borderColor: colors.mint,
                  },
                ]}
              >
                {stayLoggedIn ? (
                  <Feather name="check" size={12} color={colors.textInverse} />
                ) : null}
              </View>
              <Text style={styles.stayTxt}>Keep me signed in</Text>
            </TouchableOpacity>

            {/* Primary CTA */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                loginLoading && { opacity: 0.6 },
              ]}
              onPress={onLogin}
              disabled={loginLoading}
              activeOpacity={0.85}
            >
              {loginLoading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.primaryBtnTxt}>Sign In</Text>
              )}
            </TouchableOpacity>

            {loginReason === "UNVERIFIED" ? (
              <View style={styles.unverifiedRow}>
                <TouchableOpacity
                  onPress={onResendCode}
                  disabled={resending}
                  style={styles.ghostBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.ghostBtnTxt}>
                    {resending ? "Resending…" : "Resend code"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowVerify(true)}
                  style={[styles.ghostBtn, { borderColor: colors.mintBorder }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.ghostBtnTxt, { color: colors.mint }]}>
                    Enter code
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerTxt}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social */}
            <TouchableOpacity
              style={[
                styles.socialBtn,
                socialLoading && { opacity: 0.6 },
              ]}
              onPress={startGoogleMobile}
              disabled={socialLoading}
              activeOpacity={0.85}
            >
              <AntDesign name="google" size={18} color={colors.sky} />
              <Text style={styles.socialTxt}>
                {socialLoading ? "Redirecting…" : "Continue with Google"}
              </Text>
            </TouchableOpacity>

            {Platform.OS === "ios" ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  isDark
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={14}
                style={{ width: "100%", height: 50, marginTop: 10 }}
                onPress={signInWithAppleNative}
                disabled={socialLoading}
              />
            ) : null}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerTxt}>New to Nummoria? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("SignUp")}
              hitSlop={8}
            >
              <Text style={styles.footerLink}>Create an account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Verify modal */}
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
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Verify your email</Text>
                <Text style={styles.modalSub}>
                  We sent a 6-digit code to{" "}
                  <Text style={styles.modalEmail}>{maskedEmail}</Text>
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowVerify(false)}
                hitSlop={10}
                style={styles.modalCloseBtn}
              >
                <Feather name="x" size={18} color={colors.textMid} />
              </TouchableOpacity>
            </View>

            {verifyErr ? (
              <View style={styles.notice}>
                <Feather name="alert-circle" size={14} color={colors.rose} />
                <Text style={styles.noticeTxt}>{verifyErr}</Text>
              </View>
            ) : null}
            {verifyMsg ? (
              <View
                style={[
                  styles.notice,
                  {
                    backgroundColor: colors.mintSoft,
                    borderColor: colors.mintBorder,
                  },
                ]}
              >
                <Feather name="check-circle" size={14} color={colors.mint} />
                <Text style={[styles.noticeTxt, { color: colors.textHi }]}>
                  {verifyMsg}
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Verification code</Text>
            <View style={styles.inputWrap}>
              <Feather
                name="hash"
                size={16}
                color={colors.textLow}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { letterSpacing: 8 }]}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
                placeholder="000000"
                placeholderTextColor={colors.textLow}
                editable={!verifying}
              />
            </View>
            <Text style={styles.hint}>
              The code expires 15 minutes after request.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnGhost}
                onPress={() => setShowVerify(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnGhostTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { flex: 1, marginTop: 0 },
                  verifying && { opacity: 0.6 },
                ]}
                onPress={onVerifySubmit}
                disabled={verifying}
                activeOpacity={0.85}
              >
                {verifying ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.primaryBtnTxt}>Verify & Continue</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={onResendCode}
              disabled={resending}
              activeOpacity={0.75}
              style={{ marginTop: 14, alignSelf: "center" }}
            >
              <Text style={styles.linkTxt}>
                {resending ? "Resending…" : "Resend code"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/* ──────────────────────────────────────────────────────────
   STYLES (theme-aware)
────────────────────────────────────────────────────────── */
function makeStyles(c, isDark) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    bgWrap: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
    blob: {
      position: "absolute",
      width: 320,
      height: 320,
      borderRadius: 999,
      opacity: 0.9,
    },
    scrollContent: {
      paddingHorizontal: 22,
      paddingTop: 18,
      paddingBottom: 40,
    },

    /* hero */
    hero: { alignItems: "center", marginTop: 28, marginBottom: 28 },
    logoBubble: {
      width: 84,
      height: 84,
      borderRadius: 22,
      backgroundColor: c.cardSoft,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
      shadowColor: c.mint,
      shadowOpacity: isDark ? 0.3 : 0.15,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    logoImg: { width: 52, height: 52, resizeMode: "contain" },
    heroTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: c.textHi,
      letterSpacing: -0.4,
    },
    heroSub: {
      fontSize: 15,
      color: c.textMid,
      marginTop: 6,
      textAlign: "center",
    },

    /* card */
    card: {
      backgroundColor: c.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.25 : 0.06,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
    },

    /* notice */
    notice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: c.roseSoft,
      borderWidth: 1,
      borderColor: c.roseBorder,
      marginBottom: 12,
    },
    noticeTxt: { flex: 1, fontSize: 13, color: c.textHi, lineHeight: 18 },

    /* labels & inputs */
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textMid,
      marginBottom: 8,
    },
    labelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
      marginTop: 14,
    },
    linkTxt: {
      fontSize: 13,
      fontWeight: "600",
      color: c.sky,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.cardSoft,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      height: 50,
      marginBottom: 4,
    },
    inputIcon: { marginRight: 8 },
    inputTrail: { paddingLeft: 8 },
    input: {
      flex: 1,
      color: c.textHi,
      fontSize: 15,
      paddingVertical: 0,
    },
    hint: {
      fontSize: 12,
      color: c.textLow,
      marginTop: 6,
    },

    /* stay logged */
    stayRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 16,
      marginBottom: 4,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: c.borderStrong,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    stayTxt: { fontSize: 14, color: c.textMid, fontWeight: "500" },

    /* primary cta */
    primaryBtn: {
      marginTop: 18,
      height: 52,
      borderRadius: 14,
      backgroundColor: c.mint,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.mint,
      shadowOpacity: isDark ? 0.35 : 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    primaryBtnTxt: {
      fontSize: 16,
      fontWeight: "700",
      color: c.textInverse,
      letterSpacing: 0.2,
    },

    /* unverified inline actions */
    unverifiedRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 12,
    },
    ghostBtn: {
      flex: 1,
      height: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.skyBorder,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.skySoft,
    },
    ghostBtnTxt: {
      fontSize: 13,
      fontWeight: "600",
      color: c.sky,
    },

    /* divider */
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 22,
      marginBottom: 14,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.divider },
    dividerTxt: { fontSize: 12, color: c.textLow, fontWeight: "500" },

    /* social */
    socialBtn: {
      height: 50,
      borderRadius: 14,
      backgroundColor: c.cardSoft,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    socialTxt: { fontSize: 15, fontWeight: "600", color: c.textHi },

    /* footer */
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 22,
    },
    footerTxt: { fontSize: 14, color: c.textMid },
    footerLink: { fontSize: 14, fontWeight: "700", color: c.mint },

    /* modal */
    modalBackdrop: {
      flex: 1,
      backgroundColor: c.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 22,
    },
    modalCard: {
      width: "100%",
      backgroundColor: c.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      padding: 22,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 19,
      fontWeight: "700",
      color: c.textHi,
      marginBottom: 4,
    },
    modalSub: { fontSize: 13, color: c.textMid, lineHeight: 18 },
    modalEmail: { color: c.textHi, fontWeight: "600" },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.cardSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    modalActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
    },
    modalBtnGhost: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.cardSoft,
    },
    modalBtnGhostTxt: {
      fontSize: 15,
      fontWeight: "600",
      color: c.textMid,
    },
  });
}
