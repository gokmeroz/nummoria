// mobile/src/screens/SignUpScreen.js
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
} from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../lib/api";

const BG_DARK = "#020617";
const CARD_DARK = "#020819";
const BRAND_GREEN = "#22c55e";
const TEXT_MUTED = "rgba(148,163,184,1)";
const TEXT_SOFT = "rgba(148,163,184,0.8)";

const APPLE_BG = "#000000";
const APPLE_TEXT = "#ffffff";

const PENDING_VERIFY_EMAIL_KEY = "pendingVerifyEmail";
const PENDING_REG_TOKEN_KEY = "pendingRegToken";

// ✅ NEW: cache Apple name (Apple only returns fullName once)
const APPLE_NAME_CACHE_KEY = "appleFullNameCache";

function buildAppleFullName(fn) {
  if (!fn) return "";
  return [fn.givenName, fn.middleName, fn.familyName, fn.nickname]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export default function SignUpScreen({ navigation, onSignedUp }) {
  const [name, setName] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [signErr, setSignErr] = useState("");
  const [signLoading, setSignLoading] = useState(false);

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
  const [tempPassword, setTempPassword] = useState("");

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

  function goToLogin() {
    navigation.replace("Login");
  }

  async function openVerifyModal(email, regToken) {
    const cleanEmail = (email || "").trim();
    setVerifyEmail(cleanEmail);
    setVerifyErr("");
    setVerifyMsg("");
    setCode("");

    if (regToken) {
      const rt = String(regToken);
      setVerifyRegToken(rt);
      await AsyncStorage.setItem(PENDING_REG_TOKEN_KEY, rt);
    } else {
      const stored = await AsyncStorage.getItem(PENDING_REG_TOKEN_KEY);
      setVerifyRegToken(stored || "");
    }

    await AsyncStorage.setItem(PENDING_VERIFY_EMAIL_KEY, cleanEmail);
    setShowVerify(true);
  }

  async function onSignup() {
    try {
      setSignErr("");

      if (!name || !name.trim()) {
        setSignErr("Please enter your full name.");
        return;
      }
      if (!signEmail || !signEmail.trim()) {
        setSignErr("Please enter your email address.");
        return;
      }
      if (!signPassword || !signPassword.trim()) {
        setSignErr("Please enter a password.");
        return;
      }
      if (signPassword.length < 8) {
        setSignErr("Password must be at least 8 characters long.");
        return;
      }

      setSignLoading(true);

      const resp = await api.post("/auth/register", {
        name: name.trim(),
        email: signEmail.trim(),
        password: signPassword,
      });

      const data = resp?.data || {};
      const regToken = data?.regToken;

      setTempPassword(signPassword);
      setSignLoading(false);

      await openVerifyModal(signEmail.trim(), regToken);

      Alert.alert(
        "Verify your email",
        "A verification code has been sent to your email. Please verify to continue.",
        [{ text: "OK" }],
      );
    } catch (e) {
      setSignLoading(false);
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "Registration failed. Please try again.";
      setSignErr(msg);
    }
  }

  // ✅ Apple Native Signup (no browser)
  async function signUpWithAppleNative() {
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

      const freshName = buildAppleFullName(cred.fullName);

      if (freshName) {
        await AsyncStorage.setItem(APPLE_NAME_CACHE_KEY, freshName);
      }

      const cachedName =
        freshName || (await AsyncStorage.getItem(APPLE_NAME_CACHE_KEY)) || "";

      const resp = await api.post("/auth/apple/mobile", {
        identityToken: cred.identityToken,
        fullName: cachedName,
      });

      const data = resp?.data || {};
      setSocialLoading(false);

      await storeUser(data);

      if (typeof onSignedUp === "function") {
        await onSignedUp();
        return;
      }

      // fallback
      const uid = data?.user?.id || (await AsyncStorage.getItem("defaultId"));
      navigation.replace("Terms", {
        userId: String(uid || ""),
        nextRoute: "MainTabs",
      });
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
        password: tempPassword,
      });

      await storeUser(data);

      await AsyncStorage.removeItem(PENDING_VERIFY_EMAIL_KEY);
      await AsyncStorage.removeItem(PENDING_REG_TOKEN_KEY);

      setVerifying(false);
      setShowVerify(false);

      if (typeof onSignedUp === "function") {
        await onSignedUp();
        return;
      }

      const uid = data?.user?.id || (await AsyncStorage.getItem("defaultId"));
      navigation.replace("Terms", {
        userId: String(uid || ""),
        nextRoute: "MainTabs",
      });
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
      setVerifyErr("");
      setVerifyMsg("");
      setResending(true);

      const storedRegToken =
        verifyRegToken || (await AsyncStorage.getItem(PENDING_REG_TOKEN_KEY));

      if (!storedRegToken) {
        setResending(false);
        setVerifyErr("Missing verification token. Please sign up again.");
        return;
      }

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
            <View style={styles.heroHeaderRow}>
              <View style={styles.logoBadge}>
                <Image
                  source={require("../../assets/nummoria_logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandName}>Nummoria</Text>
            </View>

            <Text style={styles.sectionTitle}>Create account</Text>
            <Text style={styles.sectionSubtitle}>
              Get started with Nummoria and take control of your finances.
            </Text>

            {signErr ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{signErr}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={TEXT_MUTED}
                editable={!signLoading}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={signEmail}
                onChangeText={setSignEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@nummoria.com"
                placeholderTextColor={TEXT_MUTED}
                editable={!signLoading}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={signPassword}
                onChangeText={setSignPassword}
                secureTextEntry={true}
                placeholder="At least 8 characters"
                placeholderTextColor={TEXT_MUTED}
                editable={!signLoading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                styles.signupBtn,
                signLoading && styles.buttonDisabled,
              ]}
              onPress={onSignup}
              disabled={signLoading}
              activeOpacity={0.7}
            >
              {signLoading ? (
                <ActivityIndicator color="#0b1120" />
              ) : (
                <Text style={styles.signupText}>Create account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign up with</Text>
              <View style={styles.dividerLine} />
            </View>

            {socialErr ? (
              <View style={styles.socialErrBox}>
                <Text style={styles.socialErrText}>{socialErr}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.socialBtn, socialLoading && styles.buttonDisabled]}
              onPress={() =>
                Alert.alert(
                  "Google signup",
                  "Use your Login screen Google flow for now.",
                )
              }
              disabled={socialLoading}
              activeOpacity={0.7}
            >
              <AntDesign name="google" size={18} color="#e5e7eb" />
              <Text style={styles.socialText}>
                {socialLoading ? "Working..." : "Continue with Google"}
              </Text>
            </TouchableOpacity>

            {Platform.OS === "ios" ? (
              <TouchableOpacity
                style={[
                  styles.socialBtn,
                  styles.appleBtn,
                  socialLoading && styles.buttonDisabled,
                ]}
                onPress={signUpWithAppleNative}
                disabled={socialLoading}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-apple" size={18} color="#fff" />
                <Text style={[styles.socialText, styles.appleText]}>
                  {socialLoading ? "Signing up..." : "Continue with Apple"}
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.loginRow}>
              <Text style={styles.loginHint}>Already have an account?</Text>
              <TouchableOpacity onPress={goToLogin} activeOpacity={0.7}>
                <Text style={styles.loginLink}>Log in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
              <TouchableOpacity
                onPress={onResendCode}
                disabled={resending}
                activeOpacity={0.7}
              >
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
  root: { flex: 1, backgroundColor: BG_DARK },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 90,
    paddingBottom: 40,
  },
  heroHeaderRow: {
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
  logo: { width: 22, height: 22 },
  brandName: { fontSize: 15, color: TEXT_SOFT, fontWeight: "600" },
  authCard: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,1)",
  },
  sectionTitle: { fontSize: 22, fontWeight: "700", color: "#f9fafb" },
  sectionSubtitle: { marginTop: 4, fontSize: 13, color: TEXT_SOFT },
  field: { marginTop: 14 },
  label: { fontSize: 13, color: "#e5e7eb", marginBottom: 4 },
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
  buttonDisabled: { opacity: 0.6 },
  signupBtn: { backgroundColor: BRAND_GREEN },
  signupText: { color: "#022c22", fontWeight: "700", fontSize: 15 },
  errorBox: {
    marginTop: 12,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(248,113,113,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
  },
  errorText: { fontSize: 13, color: "#fecaca" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(31,41,55,1)" },
  dividerText: { marginHorizontal: 8, fontSize: 12, color: TEXT_SOFT },
  socialErrBox: {
    marginTop: 4,
    marginBottom: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(248,113,113,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
  },
  socialErrText: { color: "#fecaca", fontSize: 13 },
  socialBtn: {
    marginTop: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(31,41,55,1)",
    backgroundColor: "#020617",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  socialText: {
    fontSize: 14,
    color: "#e5e7eb",
    fontWeight: "500",
  },
  appleBtn: {
    backgroundColor: APPLE_BG,
    borderColor: "rgba(255,255,255,0.15)",
  },
  appleText: {
    color: APPLE_TEXT,
    fontWeight: "600",
  },
  loginRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginHint: { fontSize: 13, color: TEXT_SOFT },
  loginLink: {
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
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#f9fafb" },
  modalClose: { fontSize: 24, color: TEXT_SOFT },
  modalText: { marginTop: 6, fontSize: 13, color: TEXT_SOFT },
  modalEmail: { color: "#e5e7eb", fontWeight: "600" },
  modalErrorBox: {
    marginTop: 10,
    borderRadius: 10,
    padding: 8,
    backgroundColor: "rgba(248,113,113,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
  },
  modalErrorText: { fontSize: 13, color: "#fecaca" },
  modalMsgBox: {
    marginTop: 10,
    borderRadius: 10,
    padding: 8,
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.4)",
  },
  modalMsgText: { fontSize: 13, color: BRAND_GREEN },
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
  modalHint: { marginTop: 4, fontSize: 11, color: TEXT_SOFT },
  modalBtn: { marginTop: 16, backgroundColor: BRAND_GREEN },
  modalBtnText: { fontSize: 15, fontWeight: "700", color: "#022c22" },
  modalFooterRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalFooterText: { fontSize: 13, color: TEXT_SOFT },
  modalFooterLink: {
    fontSize: 13,
    color: BRAND_GREEN,
    textDecorationLine: "underline",
  },
});
