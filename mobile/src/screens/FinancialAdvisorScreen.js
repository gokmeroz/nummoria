// mobile/src/screens/FinancialAdvisorScreen.js
/* eslint-disable no-unused-vars */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";

import api from "../lib/api";

const BG_DARK = "#020617";
const CARD_DARK = "#020819";
const BORDER_DARK = "#0f172a";
const TEXT_SOFT = "rgba(148,163,184,0.85)";
const TEXT_MUTED = "rgba(148,163,184,0.7)";
const TEXT_HEADING = "#e5e7eb";
const main = "#4f772d";
const secondary = "#90a955";

// ───────────── Plan Gate ─────────────
const ELIGIBLE_PLANS = new Set(["plus", "premium"]);
function isEligible(plan) {
  if (!plan) return false;
  return ELIGIBLE_PLANS.has(String(plan).toLowerCase());
}

export default function FinancialAdvisorScreen() {
  // ----------------------------- STATE -----------------------------
  const [fileId, setFileId] = useState(null);
  const [tone, setTone] = useState(null); // load from AsyncStorage
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [banner, setBanner] = useState(null);
  const [thinking, setThinking] = useState(false);

  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);

  const chatRef = useRef(null);
  const bannerTimeoutRef = useRef(null);

  // ----------------------------- EFFECTS -----------------------------
  // Load tone preference
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("fh_tone");
        if (saved) setTone(saved);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Persist tone when it changes
  useEffect(() => {
    if (!tone) return;
    AsyncStorage.setItem("fh_tone", tone).catch(() => {});
  }, [tone]);

  // Fetch plan once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/me");
        if (!mounted) return;
        const p =
          data?.subscription?.toLowerCase?.() ||
          data?.plan?.toLowerCase?.() ||
          null;
        setPlan(p);
      } catch {
        setPlan(null);
      } finally {
        if (mounted) setPlanLoading(false);
      }
    })();
    return () => {
      mounted = false;
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  // auto-scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollToEnd({ animated: true });
    }
  }, [messages.length, thinking]);

  // ------------------------- BANNER HELPER -------------------------
  const showBanner = useCallback((msg) => {
    const text = String(msg || "");
    setBanner(text);
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    bannerTimeoutRef.current = setTimeout(() => {
      setBanner(null);
    }, 5000);
  }, []);

  // ------------------------- FILE UPLOAD -------------------------
  const handlePickFile = useCallback(async () => {
    if (!isEligible(plan)) {
      showBanner(
        "Uploads require Plus or Premium. Please upgrade to continue."
      );
      return;
    }

    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/csv", "text/plain", "*/*"],
        multiple: false,
      });

      if (res.canceled) return;

      const file = res.assets?.[0];
      if (!file) return;

      const { uri, name, mimeType } = file;

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: name || "statement",
        type: mimeType || "application/octet-stream",
      });

      setUploading(true);
      setUploadPct(0);
      setBanner(null);

      const { data } = await api.post("/ai/financial-helper/ingest", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (evt) => {
          if (evt.total) {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            setUploadPct(pct);
          }
        },
      });

      setFileId(data.fileId || null);
      setMessages((m) => [
        ...m,
        {
          role: "system",
          content: `File processed: ${
            data?.totals?.txCount ?? 0
          } transactions loaded.`,
        },
      ]);
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg = err?.response?.data?.message || "Upload failed.";
      if (code === "NO_TRANSACTIONS") {
        showBanner(msg + " Tip: Export a CSV from your bank and upload that.");
      } else if (code === "PDF_NO_TEXT") {
        showBanner(
          "This PDF is scanned/image-only. Please export a text-based PDF or CSV."
        );
      } else if (err?.response?.status === 402) {
        showBanner("Upgrade required to use Financial Advisor.");
      } else {
        showBanner(msg);
      }
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }, [plan, showBanner]);

  // ------------------------- SEND MESSAGE -------------------------
  const onSend = useCallback(async () => {
    if (!isEligible(plan)) {
      showBanner(
        "Financial Advisor is available on Plus/Premium. Please upgrade to continue."
      );
      return;
    }

    const trimmed = input.trim();

    if (!trimmed && !tone) {
      showBanner("Pick a tone first.");
      return;
    }

    const tonePref = tone || "formal";

    const userMsg = trimmed;
    setMessages((m) => [
      ...m,
      { role: "user", content: userMsg || `(Using tone: ${tonePref})` },
    ]);
    setInput("");

    try {
      setThinking(true);
      const { data } = await api.post("/ai/financial-helper/chat", {
        message: userMsg || `Start session. Tone: ${tonePref}`,
        tonePreference: tonePref,
        fileId,
      });
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err.message ||
        "Chat failed";
      setMessages((m) => [
        ...m,
        { role: "system", content: `Chat failed: ${msg}` },
      ]);
    } finally {
      setThinking(false);
    }
  }, [input, tone, plan, fileId, showBanner]);

  // ------------------------------ RENDER HELPERS ------------------------------ //
  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <View style={styles.emptyChatWrap}>
          <Text style={styles.emptyChatText}>
            {planLoading
              ? "Checking your plan…"
              : isEligible(plan)
              ? "Upload a statement and ask about your budget, savings, or investments."
              : "Upgrade to Plus or Premium to chat with the advisor."}
          </Text>
        </View>
      );
    }

    return (
      <View>
        {messages.map((m, idx) => (
          <ChatBubble key={idx} role={m.role} text={m.content} />
        ))}
        {thinking && <TypingBubble />}
      </View>
    );
  };

  // ------------------------------ MAIN RENDER ------------------------------ //
  if (planLoading && !tone && messages.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={main} />
        <Text style={styles.loadingTitle}>Nummoria</Text>
        <Text style={styles.loadingSubtitle}>
          Initializing your AI advisor…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Text style={styles.headerIconText}>₮</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Financial Advisor</Text>
              <Text style={styles.headerSubtitle}>
                Educational only · Not licensed financial advice
              </Text>
            </View>
          </View>

          {/* Tone chips (top-right) */}
          <View style={styles.headerToneRow}>
            <Text style={styles.headerToneLabel}>Tone:</Text>
            <ToneChip
              label="Formal"
              selected={tone === "formal"}
              onPress={() => setTone("formal")}
            />
            <ToneChip
              label="Buddy"
              selected={tone === "buddy"}
              onPress={() => setTone("buddy")}
            />
          </View>
        </View>

        {/* Banner */}
        {banner ? (
          <View style={styles.bannerBox}>
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        ) : null}

        {/* Tone picker card (if none picked yet) */}
        {!tone && (
          <View style={styles.toneCard}>
            <Text style={styles.toneCardTitle}>How should I talk?</Text>
            <Text style={styles.toneCardSubtitle}>
              Choose how you want Nummoria to speak with you.
            </Text>
            <View style={styles.toneChipRowBig}>
              <ToneChip
                big
                label="Formal"
                selected={tone === "formal"}
                onPress={() => setTone("formal")}
              />
              <ToneChip
                big
                label="Buddy"
                selected={tone === "buddy"}
                onPress={() => setTone("buddy")}
              />
            </View>
          </View>
        )}

        {/* Upload card */}
        <View style={styles.uploadCard}>
          <View style={styles.uploadTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadTitle}>Upload your statement</Text>
              <Text style={styles.uploadSubtitle}>
                Accepts <Text style={styles.uploadSubtitleStrong}>PDF</Text>{" "}
                (text-based)
                {"  "}or <Text style={styles.uploadSubtitleStrong}>CSV</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.uploadBtn,
                (!isEligible(plan) || planLoading || uploading) &&
                  styles.uploadBtnDisabled,
              ]}
              disabled={!isEligible(plan) || planLoading || uploading}
              onPress={handlePickFile}
            >
              <Text style={styles.uploadBtnText}>
                {uploading ? "Uploading…" : "Choose File"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* progress */}
          {uploading && (
            <View style={styles.uploadProgressWrap}>
              <View style={styles.uploadProgressTrack}>
                <View
                  style={[
                    styles.uploadProgressFill,
                    { width: `${uploadPct}%` },
                  ]}
                />
              </View>
              <Text style={styles.uploadProgressText}>{uploadPct}%</Text>
            </View>
          )}

          {/* file status + plan gate label */}
          <View style={styles.uploadStatusRow}>
            <View
              style={[
                styles.fileStatusPill,
                fileId && styles.fileStatusPillActive,
              ]}
            >
              <View
                style={[styles.dot, fileId ? styles.dotOk : styles.dotMuted]}
              />
              <Text
                style={[
                  styles.fileStatusText,
                  fileId && styles.fileStatusTextActive,
                ]}
              >
                {fileId ? "File linked to session" : "No file yet"}
              </Text>
            </View>
            {!planLoading && !isEligible(plan) && (
              <View style={styles.planPill}>
                <Text style={styles.planPillText}>Plus/Premium required</Text>
              </View>
            )}
          </View>
        </View>

        {/* Chat card */}
        <View style={styles.chatCard}>
          <View style={styles.chatArea}>
            <ScrollView
              ref={chatRef}
              style={styles.chatScroll}
              contentContainerStyle={{ paddingBottom: 8 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {renderMessages()}
            </ScrollView>

            {/* PLAN GATE OVERLAY */}
            {!planLoading && !isEligible(plan) && (
              <UpgradeOverlay plan={plan} />
            )}
          </View>

          {/* Composer */}
          <View style={styles.composerBox}>
            <View style={styles.composerRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                multiline
                placeholder={
                  !planLoading && !isEligible(plan)
                    ? "Upgrade to Plus or Premium to chat with the advisor."
                    : tone
                    ? "Ask about your budget, risk, or investments…"
                    : "Pick a tone to start…"
                }
                placeholderTextColor={TEXT_MUTED}
                editable={!!tone && isEligible(plan) && !planLoading}
                style={[
                  styles.composerInput,
                  (!tone || !isEligible(plan) || planLoading) &&
                    styles.composerInputDisabled,
                ]}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!tone ||
                    !input.trim() ||
                    thinking ||
                    !isEligible(plan) ||
                    planLoading) &&
                    styles.sendBtnDisabled,
                ]}
                disabled={
                  !tone ||
                  !input.trim() ||
                  thinking ||
                  !isEligible(plan) ||
                  planLoading
                }
                onPress={onSend}
              >
                <Text style={styles.sendBtnText}>
                  {thinking ? "…" : "Send"}
                </Text>
              </TouchableOpacity>
            </View>
            {!tone && isEligible(plan) && !planLoading && (
              <Text style={styles.composerHint}>
                Select a tone above to enable the composer.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------------------- SMALL COMPONENTS ---------------------------- */

function ToneChip({ selected, onPress, label, big }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[
        styles.toneChip,
        big && styles.toneChipBig,
        selected && styles.toneChipSelected,
      ]}
    >
      <Text
        style={[
          styles.toneChipText,
          big && styles.toneChipTextBig,
          selected && styles.toneChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ChatBubble({ role, text }) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  const isSystem = role === "system";

  let wrapAlign = "flex-start";
  if (isUser) wrapAlign = "flex-end";

  let bubbleStyle = styles.bubbleSystem;
  if (isUser) bubbleStyle = styles.bubbleUser;
  else if (isAssistant) bubbleStyle = styles.bubbleAssistant;

  return (
    <View style={[styles.bubbleRow, { justifyContent: wrapAlign }]}>
      <View style={bubbleStyle}>
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    </View>
  );
}

function TypingBubble() {
  return (
    <View style={[styles.bubbleRow, { justifyContent: "flex-start" }]}>
      <View style={styles.bubbleAssistant}>
        <Text style={styles.typingText}>Assistant is typing…</Text>
      </View>
    </View>
  );
}

function UpgradeOverlay({ plan }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        <Text style={styles.overlayTitle}>Unlock AI Financial Advisor</Text>
        <Text style={styles.overlayText}>
          Your current plan{" "}
          <Text style={styles.overlayPlanText}>({plan || "free"})</Text> doesn’t
          include this feature. Upgrade to{" "}
          <Text style={styles.overlayPlanText}>Plus</Text> or{" "}
          <Text style={styles.overlayPlanText}>Premium</Text> to continue.
        </Text>
        <View style={styles.overlayBtnRow}>
          <TouchableOpacity
            style={styles.overlayPrimaryBtn}
            onPress={() =>
              Alert.alert(
                "Upgrade",
                "Please upgrade to Plus or Premium from the web app or subscription settings."
              )
            }
          >
            <Text style={styles.overlayPrimaryBtnText}>See Plans</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.overlaySecondaryBtn}
            onPress={() =>
              Alert.alert(
                "Go Premium",
                "Upgrade to Premium from the web app to unlock this feature."
              )
            }
          >
            <Text style={styles.overlaySecondaryBtnText}>Go Premium</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.overlayFootnote}>
          Plus & Premium include AI insights, savings tips, and more.
        </Text>
      </View>
    </View>
  );
}

/* =============================== STYLES =============================== */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  content: {
    flex: 1,
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    backgroundColor: BG_DARK,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingTitle: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "700",
    color: main,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 4,
  },

  /* Header */
  headerCard: {
    marginTop: 12,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: CARD_DARK,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: main,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f9fafb",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_HEADING,
  },
  headerSubtitle: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 1,
  },
  headerToneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerToneLabel: {
    fontSize: 11,
    color: TEXT_MUTED,
  },

  /* Banner */
  bannerBox: {
    marginTop: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(251,191,36,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
  },
  bannerText: {
    fontSize: 12,
    color: "#fbbf24",
  },

  /* Tone card */
  toneCard: {
    marginTop: 10,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  toneCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_HEADING,
  },
  toneCardSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
    marginBottom: 8,
  },
  toneChipRowBig: {
    flexDirection: "row",
    gap: 8,
  },

  /* Upload card */
  uploadCard: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  uploadTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_HEADING,
  },
  uploadSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  uploadSubtitleStrong: {
    fontWeight: "600",
    color: TEXT_SOFT,
  },
  uploadBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: main,
    backgroundColor: "#020617",
  },
  uploadBtnDisabled: {
    opacity: 0.5,
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: secondary,
  },
  uploadProgressWrap: {
    marginTop: 10,
  },
  uploadProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#020617",
    overflow: "hidden",
  },
  uploadProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(144,169,85,1)",
  },
  uploadProgressText: {
    marginTop: 4,
    fontSize: 11,
    color: TEXT_MUTED,
  },
  uploadStatusRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  fileStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  fileStatusPillActive: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.7)",
  },
  fileStatusText: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  fileStatusTextActive: {
    color: "#bbf7d0",
  },
  planPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(251,191,36,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
  },
  planPillText: {
    fontSize: 11,
    color: "#fbbf24",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOk: {
    backgroundColor: "#22c55e",
  },
  dotMuted: {
    backgroundColor: "#4b5563",
  },

  /* Chat card */
  chatCard: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    overflow: "hidden",
  },
  chatArea: {
    height: 320,
    backgroundColor: "#020617",
  },
  chatScroll: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  emptyChatWrap: {
    flex: 1,
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyChatText: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: "center",
    paddingHorizontal: 16,
  },

  /* Bubbles */
  bubbleRow: {
    marginBottom: 6,
    flexDirection: "row",
  },
  bubbleUser: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#166534",
  },
  bubbleAssistant: {
    maxWidth: "85%",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#020819",
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  bubbleSystem: {
    maxWidth: "85%",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#111827",
  },
  bubbleText: {
    fontSize: 13,
    color: "#e5e7eb",
  },
  typingText: {
    fontSize: 12,
    color: TEXT_MUTED,
  },

  /* Composer */
  composerBox: {
    borderTopWidth: 1,
    borderTopColor: BORDER_DARK,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#020617",
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  composerInput: {
    flex: 1,
    maxHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: TEXT_HEADING,
    backgroundColor: "#020617",
    textAlignVertical: "top",
  },
  composerInputDisabled: {
    opacity: 0.5,
  },
  sendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: main,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f9fafb",
  },
  composerHint: {
    marginTop: 4,
    fontSize: 11,
    color: TEXT_MUTED,
  },

  /* Tone chip */
  toneChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: main,
    backgroundColor: "#020617",
  },
  toneChipBig: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toneChipSelected: {
    backgroundColor: main,
    borderColor: main,
  },
  toneChipText: {
    fontSize: 11,
    color: secondary,
  },
  toneChipTextBig: {
    fontSize: 13,
  },
  toneChipTextSelected: {
    color: "#f9fafb",
    fontWeight: "600",
  },

  /* Overlay */
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15,23,42,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  overlayCard: {
    width: "100%",
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  overlayTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_HEADING,
  },
  overlayText: {
    marginTop: 6,
    fontSize: 13,
    color: TEXT_SOFT,
  },
  overlayPlanText: {
    fontWeight: "600",
    color: secondary,
  },
  overlayBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  overlayPrimaryBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: main,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayPrimaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f9fafb",
  },
  overlaySecondaryBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: main,
    alignItems: "center",
    justifyContent: "center",
  },
  overlaySecondaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: secondary,
  },
  overlayFootnote: {
    marginTop: 8,
    fontSize: 11,
    color: TEXT_MUTED,
  },
});
