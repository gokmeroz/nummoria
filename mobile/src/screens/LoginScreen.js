// mobile/src/screens/LoginScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Adjust this to your backend
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:4000";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export default function LoginScreen({ navigation }) {
  // ───────────── login state ─────────────
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginReason, setLoginReason] = useState("");

  // ───────────── signup state (for later) ────────────
  const [name, setName] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [signErr, setSignErr] = useState("");
  const [signLoading, setSignLoading] = useState(false);

  // ───────────── social state ────────────
  const [socialLoading, setSocialLoading] = useState("");
  const [socialErr, setSocialErr] = useState("");

  // ───────────── /me probe (debug) ───────
  const [meProbe, setMeProbe] = useState({
    tried: false,
    ok: false,
    body: null,
  });

  // =============== email verification modal state ===============
  const [showVerify, setShowVerify] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [verifyErr, setVerifyErr] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

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

  // On mount: quick probe of /me
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/me");
        setMeProbe({ tried: true, ok: true, body: data });
        console.log("Mobile /me ok:", data);
      } catch (e) {
        const body = e?.response?.data || { error: e?.message || "Unknown" };
        setMeProbe({ tried: true, ok: false, body });
        console.log("Mobile /me failed:", body);
      }
    })();
  }, []);

  async function storeUser(data) {
    try {
      if (data?.user?.id) {
        await AsyncStorage.setItem("defaultId", String(data.user.id));
        await AsyncStorage.setItem("userEmail", data.user.email || "");
        await AsyncStorage.setItem("userName", data.user.name || "");
      }
      if (data?.token) {
        await AsyncStorage.setItem("token", data.token);
      }
    } catch (e) {
      console.warn("Failed to store user locally:", e);
    }
  }

  function goToDashboard() {
    if (navigation && navigation.replace) {
      navigation.replace("Dashboard");
    } else {
      Alert.alert("Success", "Logged in successfully.");
    }
  }

  // ====================== LOGIN ======================
  async function onLogin() {
    setLoginErr("");
    setLoginReason("");
    setLoginLoading(true);

    try {
      const resp = await api.post("/auth/login", {
        email: loginEmail,
        password: loginPassword,
      });
      const data = resp?.data || {};

      await storeUser(data);

      try {
        const meResp = await api.get("/me");
        setMeProbe({ tried: true, ok: true, body: meResp.data });
      } catch (meErr) {
        const body = meErr?.response?.data || {
          error: meErr?.message || "Unknown",
        };
        console.log("Sanity /me failed after login:", body);
        setMeProbe({ tried: true, ok: false, body });
      }

      goToDashboard();
    } catch (e) {
      const status = e.response?.status;
      const body = e.response?.data || {};
      const errMsg = body.error || "Login failed";

      if (
        status === 403 &&
        (body.reason === "UNVERIFIED" || body.needsVerification === true)
      ) {
        const email = (loginEmail || "").trim();
        setVerifyEmail(email);
        setLoginReason("UNVERIFIED");
        const message = body.maskedEmail
          ? `Your account is not verified yet. Check your inbox (${body.maskedEmail}) or resend the code.`
          : "Your account is not verified yet. Check your inbox or resend the code.";
        setLoginErr(message);
        setLoginLoading(false);
        setShowVerify(true);
        return;
      }

      setLoginErr(errMsg);
    } finally {
      setLoginLoading(false);
    }
  }

  // ====================== SIGNUP (placeholder) ======================
  async function onSignup() {
    setSignErr("");
    setSignLoading(true);
    try {
      await api.post("/auth/register", {
        name,
        email: signEmail,
        password: signPassword,
      });

      const email = (signEmail || "").trim();
      setVerifyEmail(email);
      await AsyncStorage.setItem("pendingVerifyEmail", email);
      setShowVerify(true);
    } catch (e) {
      setSignErr(e.response?.data?.error || "Registration failed");
    } finally {
      setSignLoading(false);
    }
  }

  // ====================== SOCIAL ======================
  async function startSocial(provider) {
    try {
      setSocialErr("");
      setSocialLoading(provider);
      const next = encodeURIComponent("/dashboard");
      const url = `${API_BASE}/auth/${provider}?next=${next}`;
      Alert.alert(
        "Social sign-in",
        `Open this in a browser:\n\n${url}`,
        [{ text: "OK" }],
        { cancelable: true }
      );
      setSocialLoading("");
    } catch (err) {
      setSocialErr(
        `Could not start social sign in. Please try again. ${String(err)}`
      );
      setSocialLoading("");
    }
  }

  // =================== VERIFY HANDLERS ===================
  async function onVerifySubmit() {
    if (!verifyEmail) return;
    setVerifyErr("");
    setVerifyMsg("");
    setVerifying(true);
    try {
      await api.post("/auth/verify-email", {
        email: verifyEmail,
        code: code.trim(),
      });

      setVerifyMsg("Email verified. Signing you in.");

      const { data } = await api.post("/auth/login", {
        email: verifyEmail,
        password: signPassword || loginPassword,
      });

      await storeUser(data);
      await AsyncStorage.removeItem("pendingVerifyEmail");

      try {
        const meResp = await api.get("/me");
        setMeProbe({ tried: true, ok: true, body: meResp.data });
      } catch (meErr) {
        setMeProbe({
          tried: true,
          ok: false,
          body: meErr?.response?.data || { error: meErr?.message || "Unknown" },
        });
      }

      setShowVerify(false);
      goToDashboard();
    } catch (e) {
      setVerifyErr(
        e.response?.data?.error ||
          "Verification failed. Check the code and try again."
      );
    } finally {
      setVerifying(false);
    }
  }

  async function onResendCode() {
    if (!verifyEmail) return;
    setVerifyErr("");
    setVerifyMsg("");
    setResending(true);
    try {
      await api.post("/auth/resend-code", { email: verifyEmail });
      setVerifyMsg("A new verification code was sent.");
    } catch (e) {
      setVerifyErr(e.response?.data?.error || "Could not resend the code.");
    } finally {
      setResending(false);
    }
  }

  // ====================== UI ======================
  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* FULLSCREEN PANEL */}
          <View style={styles.card}>
            {/* Brand */}
            <View style={styles.logoWrap}>
              <Image
                source={require("../assets/nummoria_logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.brand}>Nummoria</Text>
              <Text style={styles.brandSub}>
                Personal finance that actually helps.
              </Text>
            </View>

            {/* SIGN IN */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sign in</Text>

              {loginErr ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{loginErr}</Text>
                  {loginReason === "UNVERIFIED" && (
                    <View style={styles.row}>
                      <TouchableOpacity
                        onPress={onResendCode}
                        disabled={!verifyEmail || resending}
                      >
                        <Text style={styles.linkText}>
                          {resending ? "Resending code…" : "Resend code"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowVerify(true)}>
                        <Text style={styles.linkText}>Enter code</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.label}>Email address</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.inputIcon}>✉️</Text>
                  <TextInput
                    style={styles.input}
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="you@nummoria.com"
                    placeholderTextColor="rgba(148,163,184,1)"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={styles.input}
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="rgba(148,163,184,1)"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.button, styles.loginBtn]}
                onPress={onLogin}
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <ActivityIndicator color="#f9fafb" />
                ) : (
                  <Text style={styles.loginText}>Login</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotWrapper}
                onPress={() =>
                  Alert.alert("Forgot password", "Password reset coming soon.")
                }
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* SOCIAL LOGIN */}
            {socialErr ? (
              <Text style={styles.socialError}>{socialErr}</Text>
            ) : null}

            <View style={styles.socialCol}>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => startSocial("google")}
                disabled={!!socialLoading}
              >
                <Text style={styles.socialText}>Sign in with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => startSocial("github")}
                disabled={!!socialLoading}
              >
                <Text style={styles.socialText}>Sign in with GitHub</Text>
              </TouchableOpacity>

              {socialLoading ? (
                <Text style={styles.socialStatus}>
                  Redirecting to {socialLoading}…
                </Text>
              ) : null}
            </View>

            {/* SIGN UP HINT */}
            <View style={styles.footerSignupRow}>
              <Text style={styles.footerSignupText}>New around here?</Text>
              <TouchableOpacity onPress={onSignup}>
                <Text style={styles.footerSignupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* VERIFY MODAL */}
      {showVerify && (
        <Modal
          visible={showVerify}
          transparent
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
                We sent a six digit code to{" "}
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
                  placeholder="Enter 6 digit code"
                  placeholderTextColor="rgba(148,163,184,1)"
                />
                <Text style={styles.modalHint}>
                  Expires around fifteen minutes after request.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.button, styles.loginBtn]}
                onPress={onVerifySubmit}
                disabled={verifying || !verifyEmail}
              >
                {verifying ? (
                  <ActivityIndicator color="#f9fafb" />
                ) : (
                  <Text style={styles.loginText}>Verify & continue</Text>
                )}
              </TouchableOpacity>

              <View style={styles.modalFooterRow}>
                <Text style={styles.modalFooterText}>Didn’t get the code?</Text>
                <TouchableOpacity
                  onPress={onResendCode}
                  disabled={resending || !verifyEmail}
                >
                  <Text style={styles.modalFooterLink}>
                    {resending ? "Resending…" : "Resend code"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const DARK_GREEN = "#4f772d";

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Fullscreen background (no gaps)
  root: {
    flex: 1,
    backgroundColor: "#fdfefb",
  },

  scrollContent: {
    flexGrow: 1,
  },

  // Main panel now TAKES THE WHOLE SCREEN
  card: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: "#fdfefb",
  },

  // Brand
  logoWrap: {
    alignItems: "center",
    marginBottom: 18,
    marginTop: 8,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 24,
    marginBottom: 10,
  },
  brand: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK_GREEN,
  },
  brandSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(107,114,128,1)",
  },

  // Sections
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },

  field: {
    marginTop: 10,
  },
  label: {
    fontSize: 13,
    color: "rgba(55,65,81,1)",
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(209,213,219,1)",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  input: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 14,
    color: "#111827",
  },

  button: {
    marginTop: 16,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtn: {
    backgroundColor: DARK_GREEN,
  },
  loginText: {
    color: "#f9fafb",
    fontWeight: "700",
    fontSize: 15,
  },

  forgotWrapper: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  forgotText: {
    fontSize: 12,
    color: "rgba(107,114,128,1)",
  },

  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    marginTop: 6,
    columnGap: 16,
  },
  linkText: {
    color: DARK_GREEN,
    fontSize: 13,
    textDecorationLine: "underline",
  },

  dividerRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(209,213,219,1)",
  },
  dividerText: {
    fontSize: 11,
    color: "rgba(107,114,128,1)",
  },

  socialCol: {
    marginTop: 14,
    rowGap: 10,
  },
  socialBtn: {
    height: 45,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(209,213,219,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  socialText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  socialStatus: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(107,114,128,1)",
    textAlign: "center",
  },
  socialError: {
    marginTop: 8,
    fontSize: 12,
    color: "#b91c1c",
  },

  footerSignupRow: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerSignupText: {
    fontSize: 13,
    color: "rgba(75,85,99,1)",
  },
  footerSignupLink: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: "600",
    color: DARK_GREEN,
    textDecorationLine: "underline",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: DARK_GREEN,
  },
  modalClose: {
    fontSize: 22,
    color: "#6b7280",
  },
  modalText: {
    marginTop: 4,
    color: "#4b5563",
    fontSize: 13,
  },
  modalEmail: {
    fontWeight: "600",
    color: "#111827",
  },
  modalErrorBox: {
    marginTop: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 8,
  },
  modalErrorText: {
    fontSize: 13,
    color: "#b91c1c",
  },
  modalMsgBox: {
    marginTop: 8,
    backgroundColor: "#ecfdf3",
    borderRadius: 8,
    padding: 8,
  },
  modalMsgText: {
    fontSize: 13,
    color: "#15803d",
  },
  modalLabel: {
    marginTop: 10,
    fontSize: 13,
    color: "#374151",
    marginBottom: 4,
  },
  modalInput: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(209,213,219,1)",
    color: "#111827",
    fontSize: 14,
  },
  modalHint: {
    marginTop: 4,
    fontSize: 11,
    color: "#6b7280",
  },
  modalFooterRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalFooterText: {
    fontSize: 13,
    color: "#4b5563",
  },
  modalFooterLink: {
    fontSize: 13,
    color: DARK_GREEN,
    textDecorationLine: "underline",
  },
});
