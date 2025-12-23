// mobile/src/screens/TermsScreen.js
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  SafeAreaView,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BG_DARK = "#020617";
const CARD_DARK = "#020819";
const BRAND_GREEN = "#22c55e";
const TEXT_MUTED = "rgba(148,163,184,1)";
const TEXT_SOFT = "rgba(148,163,184,0.85)";

export default function TermsScreen({ route, navigation }) {
  // NEW: default route must match App.js stack (you use "Main", not "MainTabs")
  const nextRoute = route?.params?.nextRoute || "Main";

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [cookiesAccepted, setCookiesAccepted] = useState(false);

  const versions = useMemo(
    () => ({
      termsVersion: new Date().toISOString().slice(0, 10),
      privacyVersion: new Date().toISOString().slice(0, 10),
    }),
    []
  );

  async function resolveUserId() {
    const fromParams = route?.params?.userId;
    if (fromParams) return String(fromParams);
    const fromStorage = await AsyncStorage.getItem("defaultId");
    return fromStorage ? String(fromStorage) : "";
  }

  async function handleAccept() {
    const userId = await resolveUserId();

    if (!userId) {
      Alert.alert("Error", "Missing user id. Please log in again.");
      return;
    }

    if (!termsAccepted || !cookiesAccepted) {
      Alert.alert(
        "Action required",
        "You must accept Terms & Conditions and Cookies to continue."
      );
      return;
    }

    const payload = {
      termsAccepted: true,
      cookiesAccepted: true,
      acceptedAt: new Date().toISOString(),
      ...versions,
    };

    await AsyncStorage.setItem(`consent:${userId}`, JSON.stringify(payload));

    // NEW: guard against older callers still passing "MainTabs"
    const targetRoute = nextRoute === "MainTabs" ? "Main" : nextRoute;

    navigation.reset({
      index: 0,
      routes: [{ name: targetRoute }], // NEW: ensure valid route name
    });
  }

  function handleDecline() {
    Alert.alert(
      "Cannot continue",
      "You must accept the Terms & Conditions and Cookies to use the app."
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Brand row (matches Login/SignUp style) */}
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Image
                  source={require("../../assets/nummoria_logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandName}>Nummoria</Text>
            </View>

            <Text style={styles.title}>Terms & Cookies</Text>
            <Text style={styles.subtitle}>
              Before using Nummoria, you must accept the Terms of Service and
              Cookies.
            </Text>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>terms</Text>
              <View style={styles.dividerLine} />
            </View>

            <Section
              title="1. Acceptance of Terms"
              body="By creating an account or using Nummoria, you agree to these Terms of Service and our Privacy Policy. If you disagree with any part, you may stop using the service at any time."
            />
            <Section
              title="2. Use of the Service"
              body="You agree to use Nummoria responsibly, for lawful purposes only, and not to exploit vulnerabilities, distribute malware, or attempt to access other users’ data."
            />
            <Section
              title="3. Intellectual Property"
              body="Nummoria’s code, design, and brand assets are protected by intellectual property laws. You may not reproduce, distribute, or modify them without prior written permission."
            />
            <Section
              title="4. Termination"
              body="We reserve the right to suspend or terminate accounts that violate these terms, abuse resources, or compromise platform security. Users may also delete their accounts at any time from the profile settings."
            />
            <Section
              title="5. Limitation of Liability"
              body="Nummoria is provided “as is.” We strive for reliability but cannot guarantee uninterrupted access or the accuracy of insights. We are not liable for financial losses or damages resulting from use of the service."
            />
            <Section
              title="6. Changes to Terms"
              body="These terms may be updated periodically. Continued use after changes constitutes acceptance of the revised version."
            />

            <Text style={styles.updatedText}>
              Last updated: {new Date().toLocaleDateString()}
            </Text>

            {/* Required checkboxes */}
            <TouchableOpacity
              onPress={() => setTermsAccepted((v) => !v)}
              activeOpacity={0.8}
              style={styles.checkRow}
            >
              <View
                style={[
                  styles.checkbox,
                  termsAccepted && styles.checkboxChecked,
                ]}
              >
                {termsAccepted ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkLabel}>
                I accept the Terms of Service and Privacy Policy (required)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCookiesAccepted((v) => !v)}
              activeOpacity={0.8}
              style={styles.checkRow}
            >
              <View
                style={[
                  styles.checkbox,
                  cookiesAccepted && styles.checkboxChecked,
                ]}
              >
                {cookiesAccepted ? (
                  <Text style={styles.checkMark}>✓</Text>
                ) : null}
              </View>
              <Text style={styles.checkLabel}>I accept Cookies (required)</Text>
            </TouchableOpacity>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={handleDecline}
                activeOpacity={0.8}
              >
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.acceptBtn,
                  (!termsAccepted || !cookiesAccepted) && styles.acceptDisabled,
                ]}
                onPress={handleAccept}
                activeOpacity={0.8}
              >
                <Text style={styles.acceptText}>Accept & Continue</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footerNote}>
              Note: If you decline, you cannot use the application.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Section({ title, body }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.p}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG_DARK },
  root: { flex: 1, backgroundColor: BG_DARK },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 90,
    paddingBottom: 40,
  },

  card: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,1)",
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
  logo: { width: 22, height: 22 },
  brandName: {
    fontSize: 15,
    color: TEXT_SOFT,
    fontWeight: "600",
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f9fafb",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: TEXT_SOFT,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(31,41,55,1)" },
  dividerText: { marginHorizontal: 8, fontSize: 12, color: TEXT_SOFT },

  section: { marginTop: 12 },
  h2: {
    fontSize: 14,
    fontWeight: "800",
    color: "#e5e7eb",
    marginBottom: 6,
  },
  p: { fontSize: 13, color: TEXT_SOFT, lineHeight: 19 },

  updatedText: { marginTop: 12, fontSize: 12, color: TEXT_MUTED },

  checkRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(31,41,55,1)",
    backgroundColor: "#020617",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: BRAND_GREEN,
    backgroundColor: BRAND_GREEN,
  },
  checkMark: {
    color: "#022c22",
    fontWeight: "900",
    fontSize: 14,
    marginTop: -1,
  },
  checkLabel: { flex: 1, fontSize: 13, color: "#e5e7eb" },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  declineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(31,41,55,1)",
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#020617",
  },
  declineText: { color: "#e5e7eb", fontWeight: "700" },

  acceptBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: BRAND_GREEN,
  },
  acceptDisabled: {
    opacity: 0.55,
  },
  acceptText: {
    color: "#022c22",
    fontWeight: "800",
  },

  footerNote: { marginTop: 14, fontSize: 12, color: TEXT_MUTED },
});
