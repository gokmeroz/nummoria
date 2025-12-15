// mobile/src/screens/LoginScreen.js
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../lib/api";

const BG_DARK = "#020617";
const CARD_DARK = "#020819";
const BRAND_GREEN = "#22c55e";
const TEXT_MUTED = "rgba(148,163,184,1)";
const TEXT_SOFT = "rgba(148,163,184,0.8)";

// Consent (local gate)
const CONSENT_KEY = (userId) => `consent:${String(userId)}`;

// ✅ Verification persistence keys
const PENDING_VERIFY_EMAIL_KEY = "pendingVerifyEmail";
const PENDING_REG_TOKEN_KEY = "pendingRegToken";

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
  const [verifyRegToken, setVerifyRegToken] = useState(""); // ✅ NEW
  const [code, setCode] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [verifyErr, setVerifyErr] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  // ✅ Define API_BASE (your old code referenced API_BASE but never defined)
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
        ? u[0] + "*"
        : u[0] + "*".repeat(Math.max(1, u.length - 2)) + u[u.length - 1];
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
        "You must accept Terms & Conditions and Cookies to continue."
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
      // try load any existing pending regToken
      const stored = await AsyncStorage.getItem(PENDING_REG_TOKEN_KEY);
      setVerifyRegToken(stored || "");
    }

    await AsyncStorage.setItem(PENDING_VERIFY_EMAIL_KEY, cleanEmail);
    setShowVerify(true);
  }

  async function onLogin() {
    console.log("[Login] button pressed (MOBILE)");

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
      console.log("[Login] error:", e?.message, e?.response?.data);
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

        // ✅ If backend provides regToken here, store it. Otherwise user can press Resend.
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

      // ✅ regToken required by backend
      const storedRegToken =
        verifyRegToken || (await AsyncStorage.getItem(PENDING_REG_TOKEN_KEY));

      if (!storedRegToken) {
        setVerifying(false);
        setVerifyErr("Missing verification token. Please tap “Resend code”.");
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
          "Verification failed. Please check the code and try again."
      );
    }
  }

  async function onResendCode() {
    try {
      const email =
        (verifyEmail || "").trim() ||
        (await AsyncStorage.getItem(PENDING_VERIFY_EMAIL_KEY)) ||
        "";

      if (!email) return;

      setVerifyErr("");
      setVerifyMsg("");
      setResending(true);

      const resp = await api.post("/auth/resend-code", { email });
      const data = resp?.data || {};

      // ✅ IMPORTANT: capture regToken if backend returns it
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

  // ─────────────────────── UI ───────────────────────
  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authCard}>
            {/* small brand row */}
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Image
                  source={require("../assets/nummoria_logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandName}>Nummoria</Text>
            </View>

            <Text style={styles.sectionTitle}>Sign in</Text>
            <Text style={styles.sectionSubtitle}>
              Log in with your Nummoria account to see your dashboard.
            </Text>

            {loginErr ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{loginErr}</Text>
                {loginReason === "UNVERIFIED" && (
                  <View style={styles.errorActionsRow}>
                    <TouchableOpacity
                      onPress={onResendCode}
                      disabled={resending}
                    >
                      <Text style={styles.errorLink}>
                        {resending ? "Resending..." : "Resend code"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowVerify(true)}>
                      <Text style={styles.errorLink}>Enter code</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={loginEmail}
                onChangeText={setLoginEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@nummoria.com"
                placeholderTextColor={TEXT_MUTED}
                editable={!loginLoading}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry={true}
                placeholder="••••••••"
                placeholderTextColor={TEXT_MUTED}
                editable={!loginLoading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                styles.loginBtn,
                loginLoading && styles.buttonDisabled,
              ]}
              onPress={onLogin}
              disabled={loginLoading}
              activeOpacity={0.7}
            >
              {loginLoading ? (
                <ActivityIndicator color="#0b1120" />
              ) : (
                <Text style={styles.loginText}>Log in</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Forgot password",
                  "Password reset flow coming soon."
                )
              }
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {socialErr ? (
              <View style={styles.socialErrBox}>
                <Text style={styles.socialErrText}>{socialErr}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.socialBtn, socialLoading && styles.buttonDisabled]}
              onPress={() => startSocial("google")}
              disabled={socialLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.socialText}>
                {socialLoading ? "Redirecting..." : "Sign in with Google"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialBtn, socialLoading && styles.buttonDisabled]}
              onPress={() => startSocial("github")}
              disabled={socialLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.socialText}>
                {socialLoading ? "Redirecting..." : "Sign in with GitHub"}
              </Text>
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <Text style={styles.signupHint}>New around here?</Text>
              <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Verification Modal */}
      <Modal
        visible={showVerify}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowVerify(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verify your email</Text>
              <TouchableOpacity onPress={() => setShowVerify(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              We sent a six-digit code to{" "}
              <Text style={styles.modalEmail}>{maskedEmail}</Text>.
            </Text>

            {verifyErr ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{verifyErr}</Text>
              </View>
            ) : null}

            {verifyMsg ? (
              <View style={styles.modalMsgBox}>
                <Text style={styles.modalMsgText}>{verifyMsg}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.modalLabel}>Verification code</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
                placeholder="Enter 6-digit code"
                placeholderTextColor={TEXT_MUTED}
                editable={!verifying}
              />
              <Text style={styles.modalHint}>
                Code expires 15 minutes after request.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                styles.modalBtn,
                verifying && styles.buttonDisabled,
              ]}
              onPress={onVerifySubmit}
              disabled={verifying}
              activeOpacity={0.7}
            >
              {verifying ? (
                <ActivityIndicator color="#0b1120" />
              ) : (
                <Text style={styles.modalBtnText}>Verify & continue</Text>
              )}
            </TouchableOpacity>

            <View style={styles.modalFooterRow}>
              <Text style={styles.modalFooterText}>Didn't get the code?</Text>
              <TouchableOpacity onPress={onResendCode} disabled={resending}>
                <Text style={styles.modalFooterLink}>
                  {resending ? "Resending..." : "Resend code"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 90,
    paddingBottom: 40,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  logo: {
    width: 22,
    height: 22,
  },
  brandName: {
    fontSize: 15,
    color: TEXT_SOFT,
    fontWeight: "600",
  },

  authCard: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,1)",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f9fafb",
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: TEXT_SOFT,
  },
  field: {
    marginTop: 14,
  },
  label: {
    fontSize: 13,
    color: "#e5e7eb",
    marginBottom: 4,
  },
  input: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(31,41,55,1)",
    backgroundColor: "#020617",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#f9fafb",
  },
  button: {
    marginTop: 18,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginBtn: {
    backgroundColor: BRAND_GREEN,
  },
  loginText: {
    color: "#022c22",
    fontWeight: "700",
    fontSize: 15,
  },
  forgotText: {
    marginTop: 10,
    fontSize: 13,
    color: TEXT_SOFT,
    textAlign: "right",
  },
  errorBox: {
    marginTop: 12,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(248,113,113,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
  },
  errorText: {
    fontSize: 13,
    color: "#fecaca",
  },
  errorActionsRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 16,
  },
  errorLink: {
    fontSize: 13,
    color: BRAND_GREEN,
    textDecorationLine: "underline",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(31,41,55,1)",
  },
  dividerText: {
    marginHorizontal: 8,
    fontSize: 12,
    color: TEXT_SOFT,
  },
  socialErrBox: {
    marginTop: 4,
    marginBottom: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(248,113,113,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
  },
  socialErrText: {
    color: "#fecaca",
    fontSize: 13,
  },
  socialBtn: {
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(31,41,55,1)",
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  socialText: {
    fontSize: 14,
    color: "#e5e7eb",
    fontWeight: "500",
  },
  signupRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupHint: {
    fontSize: 13,
    color: TEXT_SOFT,
  },
  signupLink: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: "600",
    color: BRAND_GREEN,
    textDecorationLine: "underline",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    padding: 18,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "rgba(31,41,55,1)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f9fafb",
  },
  modalClose: {
    fontSize: 24,
    color: TEXT_SOFT,
  },
  modalText: {
    marginTop: 6,
    fontSize: 13,
    color: TEXT_SOFT,
  },
  modalEmail: {
    color: "#e5e7eb",
    fontWeight: "600",
  },
  modalErrorBox: {
    marginTop: 10,
    borderRadius: 10,
    padding: 8,
    backgroundColor: "rgba(248,113,113,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
  },
  modalErrorText: {
    fontSize: 13,
    color: "#fecaca",
  },
  modalMsgBox: {
    marginTop: 10,
    borderRadius: 10,
    padding: 8,
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.4)",
  },
  modalMsgText: {
    fontSize: 13,
    color: BRAND_GREEN,
  },
  modalLabel: {
    marginTop: 12,
    fontSize: 13,
    color: "#e5e7eb",
    marginBottom: 4,
  },
  modalInput: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(31,41,55,1)",
    backgroundColor: "#020617",
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 14,
    color: "#f9fafb",
  },
  modalHint: {
    marginTop: 4,
    fontSize: 11,
    color: TEXT_SOFT,
  },
  modalBtn: {
    marginTop: 16,
    backgroundColor: BRAND_GREEN,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#022c22",
  },
  modalFooterRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalFooterText: {
    fontSize: 13,
    color: TEXT_SOFT,
  },
  modalFooterLink: {
    fontSize: 13,
    color: BRAND_GREEN,
    textDecorationLine: "underline",
  },
});
