// mobile/src/screens/SignUpScreen.js
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
import { Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";
import { useTheme } from "../theme/ThemeContext";

const PENDING_VERIFY_EMAIL_KEY = "pendingVerifyEmail";
const PENDING_REG_TOKEN_KEY = "pendingRegToken";
const APPLE_NAME_CACHE_KEY = "appleFullNameCache";

function buildAppleFullName(fn) {
  if (!fn) return "";
  return [fn.givenName, fn.middleName, fn.familyName, fn.nickname]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export default function SignUpScreen({ navigation, onSignedUp }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [name, setName] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [signErr, setSignErr] = useState("");
  const [signLoading, setSignLoading] = useState(false);
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
  const [tempPassword, setTempPassword] = useState("");

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
        setSignErr("Please choose a password.");
        return;
      }
      if (signPassword.length < 8) {
        setSignErr("Password must be at least 8 characters.");
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
        "We sent a 6-digit code to your inbox. Enter it to continue.",
      );
    } catch (e) {
      setSignLoading(false);
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "Sign-up failed. Please try again.";
      setSignErr(msg);
    }
  }

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
        setVerifyErr("Missing token. Please sign up again.");
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
      setVerifyMsg("A new code has been sent to your email.");
      setResending(false);
    } catch (e) {
      setResending(false);
      setVerifyErr(e?.response?.data?.error || "Could not resend the code.");
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* ambient gradient blobs */}
      <View pointerEvents="none" style={styles.bgWrap}>
        <LinearGradient
          colors={[colors.lilacSoft, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.blob, { top: -60, right: -40 }]}
        />
        <LinearGradient
          colors={[colors.mintSoft, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.blob, { bottom: 40, left: -50 }]}
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
          <View style={styles.hero}>
            <View style={styles.logoBubble}>
              <Image source={logo} style={styles.logoImg} />
            </View>
            <Text style={styles.heroTitle}>Join Nummoria</Text>
            <Text style={styles.heroSub}>
              Your finances, beautifully simple — built around how you actually
              spend.
            </Text>
          </View>

          <View style={styles.card}>
            {signErr ? (
              <View style={styles.notice}>
                <Feather name="alert-circle" size={14} color={colors.rose} />
                <Text style={styles.noticeTxt}>{signErr}</Text>
              </View>
            ) : null}
            {socialErr ? (
              <View style={styles.notice}>
                <Feather name="alert-circle" size={14} color={colors.rose} />
                <Text style={styles.noticeTxt}>{socialErr}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Full name</Text>
            <View style={styles.inputWrap}>
              <Feather
                name="user"
                size={16}
                color={colors.textLow}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Alex Morgan"
                placeholderTextColor={colors.textLow}
                editable={!signLoading}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.labelRow}>
              <Text style={styles.label}>Email</Text>
            </View>
            <View style={styles.inputWrap}>
              <Feather
                name="mail"
                size={16}
                color={colors.textLow}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={signEmail}
                onChangeText={setSignEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@nummoria.com"
                placeholderTextColor={colors.textLow}
                editable={!signLoading}
              />
            </View>

            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <Text style={styles.hintTrail}>min. 8 characters</Text>
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
                value={signPassword}
                onChangeText={setSignPassword}
                secureTextEntry={!showPwd}
                placeholder="••••••••"
                placeholderTextColor={colors.textLow}
                editable={!signLoading}
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

            <TouchableOpacity
              style={[styles.primaryBtn, signLoading && { opacity: 0.6 }]}
              onPress={onSignup}
              disabled={signLoading}
              activeOpacity={0.85}
            >
              {signLoading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.primaryBtnTxt}>Create Account</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.terms}>
              By continuing you agree to our Terms and Privacy Policy.
            </Text>

            {Platform.OS === "ios" ? (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerTxt}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={
                    AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                  }
                  buttonStyle={
                    isDark
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={14}
                  style={{ width: "100%", height: 50 }}
                  onPress={signUpWithAppleNative}
                  disabled={socialLoading}
                />
              </>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerTxt}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.replace("Login")}
              hitSlop={8}
            >
              <Text style={styles.footerLink}>Sign in</Text>
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

    hero: { alignItems: "center", marginTop: 20, marginBottom: 22 },
    logoBubble: {
      width: 76,
      height: 76,
      borderRadius: 20,
      backgroundColor: c.cardSoft,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
      shadowColor: c.lilac,
      shadowOpacity: isDark ? 0.3 : 0.15,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    logoImg: { width: 46, height: 46, resizeMode: "contain" },
    heroTitle: {
      fontSize: 26,
      fontWeight: "700",
      color: c.textHi,
      letterSpacing: -0.4,
    },
    heroSub: {
      fontSize: 14,
      color: c.textMid,
      marginTop: 6,
      textAlign: "center",
      lineHeight: 20,
      maxWidth: 320,
    },

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
    hintTrail: { fontSize: 12, color: c.textLow },
    linkTxt: { fontSize: 13, fontWeight: "600", color: c.sky },
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
    hint: { fontSize: 12, color: c.textLow, marginTop: 6 },

    primaryBtn: {
      marginTop: 22,
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
    terms: {
      fontSize: 12,
      color: c.textLow,
      textAlign: "center",
      marginTop: 12,
      lineHeight: 18,
    },

    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 18,
      marginBottom: 12,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.divider },
    dividerTxt: { fontSize: 12, color: c.textLow, fontWeight: "500" },

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
    modalBtnGhostTxt: { fontSize: 15, fontWeight: "600", color: c.textMid },
  });
}
