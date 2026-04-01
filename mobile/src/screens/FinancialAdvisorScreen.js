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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { useNavigation } from "@react-navigation/native";
import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";

/* ──────────────────────────────────────────────────────────
   THEME
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

/* ──────────────────────────────────────────────────────────
   PLAN GATE
────────────────────────────────────────────────────────── */
const ELIGIBLE_PLANS = new Set(["plus", "premium"]);
function isEligible(plan) {
  if (!plan) return false;
  return ELIGIBLE_PLANS.has(String(plan).toLowerCase());
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
   SMALL COMPONENTS
────────────────────────────────────────────────────────── */
function ToneChip({ selected, onPress, label }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[s.toneChip, selected && s.toneChipSelected]}
    >
      <Text
        style={[s.toneChipText, selected && s.toneChipTextSelected]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ChatBubble({ role, text }) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";

  let wrapAlign = "flex-start";
  if (isUser) wrapAlign = "flex-end";

  let bubbleStyle = s.bubbleSystem;
  let bracketColor = VIOLET;

  if (isUser) {
    bubbleStyle = s.bubbleUser;
    bracketColor = MINT;
  } else if (isAssistant) {
    bubbleStyle = s.bubbleAssistant;
    bracketColor = CYAN;
  }

  return (
    <View style={[s.bubbleRow, { justifyContent: wrapAlign }]}>
      <View style={[bubbleStyle, { position: "relative" }]}>
        <Brackets color={bracketColor} size={7} thick={1} />
        <Text style={s.bubbleText}>{text}</Text>
      </View>
    </View>
  );
}

function TypingBubble() {
  return (
    <View style={[s.bubbleRow, { justifyContent: "flex-start" }]}>
      <View style={[s.bubbleAssistant, { position: "relative" }]}>
        <Brackets color={CYAN} size={7} thick={1} />
        <Text style={s.typingText}>Assistant is typing…</Text>
      </View>
    </View>
  );
}

function UpgradeOverlay({ plan }) {
  return (
    <View style={s.overlay}>
      <View style={s.overlayCard}>
        <Brackets color={GOLD} size={10} thick={1.5} />
        <View style={[s.overlayHairline, { backgroundColor: GOLD }]} />

        <Text style={s.overlayTitle}>Unlock AI Financial Advisor</Text>
        <Text style={s.overlayText}>
          Your current plan{" "}
          <Text style={s.overlayPlanText}>({plan || "free"})</Text> doesn’t
          include this feature. Upgrade to{" "}
          <Text style={s.overlayPlanText}>Plus</Text> or{" "}
          <Text style={s.overlayPlanText}>Premium</Text> to continue.
        </Text>

        <ScanLine color={GOLD} style={{ marginTop: 14, marginBottom: 14 }} />

        <View style={s.overlayBtnRow}>
          <TouchableOpacity
            style={s.overlayPrimaryBtn}
            onPress={() =>
              Alert.alert(
                "Upgrade",
                "Please upgrade to Plus or Premium from the web app or subscription settings.",
              )
            }
          >
            <Text style={s.overlayPrimaryBtnText}>SEE PLANS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.overlaySecondaryBtn}
            onPress={() =>
              Alert.alert(
                "Go Premium",
                "Upgrade to Premium from the web app to unlock this feature.",
              )
            }
          >
            <Text style={s.overlaySecondaryBtnText}>GO PREMIUM</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.overlayFootnote}>
          Plus & Premium include AI insights, savings tips, and more.
        </Text>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════ */
export default function FinancialAdvisorScreen() {
  const navigation = useNavigation();

  const [fileId, setFileId] = useState(null);
  const [tone, setTone] = useState("formal");
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

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("fh_tone");
        if (saved === "formal" || saved === "buddy") setTone(saved);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("fh_tone", tone).catch(() => {});
  }, [tone]);

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

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollToEnd({ animated: true });
    }
  }, [messages.length, thinking]);

  const showBanner = useCallback((msg) => {
    const text = String(msg || "");
    setBanner(text);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => setBanner(null), 5000);
  }, []);

  const toneLabel = useMemo(
    () => (tone === "buddy" ? "Buddy" : "Formal"),
    [tone],
  );

  const handlePickFile = useCallback(async () => {
    if (!isEligible(plan)) {
      showBanner(
        "Uploads require Plus or Premium. Please upgrade to continue.",
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
          "This PDF is scanned/image-only. Please export a text-based PDF or CSV.",
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

  const onSend = useCallback(async () => {
    if (!isEligible(plan)) {
      showBanner(
        "Financial Advisor is available on Plus/Premium. Please upgrade to continue.",
      );
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      showBanner("Type a message first.");
      return;
    }

    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");

    const backendMessage = [
      `User message: ${trimmed}`,
      "",
      `Tone preference: ${tone || "formal"}.`,
      "Reply in English unless the user explicitly writes in another language.",
      "If there is no attached file/report, still answer the question generally and helpfully.",
      "Do not refuse only because there is no uploaded statement.",
      fileId
        ? `Use attached file context when relevant. fileId=${fileId}`
        : "No file is attached. Give a general educational answer.",
    ].join("\n");

    try {
      setThinking(true);
      const { data } = await api.post("/ai/financial-helper/chat", {
        message: backendMessage,
        tonePreference: tone || "formal",
        fileId: fileId || null,
      });

      setMessages((m) => [
        ...m,
        { role: "assistant", content: data?.reply || "No reply returned." },
      ]);
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
        <Brackets color={MINT} size={10} thick={1.5} />
        <View style={[s.headerHairline, { backgroundColor: MINT }]} />

        <View style={s.topBar}>
          <View style={s.logoRow}>
            <View style={[s.statusDot, { backgroundColor: MINT }]} />
            <Text style={s.logoTxt}>FINANCIAL ADVISOR</Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate("Dashboard")}
            activeOpacity={0.8}
            style={s.homeBtn}
          >
            <Image source={logo} style={s.homeBtnImg} />
            <Brackets color={MINT} size={6} thick={1} />
          </TouchableOpacity>
        </View>

        <View style={s.headerBottomRow}>
          <View style={s.headerTextWrap}>
            <Text style={s.heroTitle}>Advisor Console</Text>
            <Text style={s.heroSub}>Educational finance guidance.</Text>
          </View>

          <View style={s.headerStatusWrap}>
            <View
              style={[
                s.ctrlPillCompact,
                { borderColor: "rgba(0,255,135,0.25)" },
              ]}
            >
              <View style={[s.ctrlDot, { backgroundColor: MINT }]} />
              <Text style={[s.ctrlTxt, { color: MINT }]}>
                {toneLabel.toUpperCase()}
              </Text>
            </View>

            <View
              style={[
                s.ctrlPillCompact,
                { borderColor: "rgba(0,212,255,0.22)" },
              ]}
            >
              <View style={[s.ctrlDot, { backgroundColor: CYAN }]} />
              <Text style={[s.ctrlTxt, { color: CYAN }]}>
                {planLoading
                  ? "CHECKING"
                  : String(plan || "free").toUpperCase()}
              </Text>
            </View>

            <View
              style={[
                s.ctrlPillCompact,
                { borderColor: "rgba(167,139,250,0.22)" },
              ]}
            >
              <View style={[s.ctrlDot, { backgroundColor: VIOLET }]} />
              <Text style={[s.ctrlTxt, { color: VIOLET }]}>
                {fileId ? "FILE READY" : "NO FILE"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  function BannerCard() {
    if (!banner) return null;

    return (
      <View
        style={[
          s.errorCard,
          {
            backgroundColor: "rgba(251,191,36,0.06)",
            borderColor: "rgba(251,191,36,0.22)",
          },
        ]}
      >
        <Brackets color={GOLD} size={8} thick={1} />
        <View
          style={[
            s.errorIconBox,
            {
              backgroundColor: "rgba(251,191,36,0.18)",
              borderColor: "rgba(251,191,36,0.28)",
            },
          ]}
        >
          <Text style={[s.errorIconTxt, { color: GOLD }]}>!</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.errorTitle}>Notice</Text>
          <Text style={s.errorBody}>{banner}</Text>
        </View>
      </View>
    );
  }

  function SetupBar() {
    return (
      <View style={s.setupCard}>
        <Brackets color={ORANGE} size={10} thick={1} />
        <View style={[s.sectionHairline, { backgroundColor: ORANGE }]} />

        <View style={s.setupRow}>
          <View style={s.setupLeft}>
            <View style={s.toneChipRowBig}>
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

          <View style={s.setupRight}>
            <TouchableOpacity
              style={[
                s.uploadBtn,
                (!isEligible(plan) || planLoading || uploading) &&
                  s.uploadBtnDisabled,
              ]}
              disabled={!isEligible(plan) || planLoading || uploading}
              onPress={handlePickFile}
            >
              <Text style={s.uploadBtnText}>
                {uploading ? "UPLOADING…" : "UPLOAD"}
              </Text>
            </TouchableOpacity>

            <View style={[s.fileStatusPill, fileId && s.fileStatusPillActive]}>
              <View style={[s.dot, fileId ? s.dotOk : s.dotMuted]} />
              <Text
                style={[s.fileStatusText, fileId && s.fileStatusTextActive]}
              >
                {fileId ? "Linked" : "None"}
              </Text>
            </View>
          </View>
        </View>

        {uploading && (
          <View style={s.uploadProgressWrap}>
            <View style={s.uploadProgressTrack}>
              <View
                style={[s.uploadProgressFill, { width: `${uploadPct}%` }]}
              />
            </View>
            <Text style={s.uploadProgressText}>{uploadPct}%</Text>
          </View>
        )}
      </View>
    );
  }

  function ChatPanel() {
    return (
      <View style={s.chatCard}>
        <Brackets color={MINT} size={10} thick={1} />
        <View style={[s.sectionHairline, { backgroundColor: MINT }]} />

        <View style={s.sectionHeaderRow}>
          <View>
            <Text style={s.sectionEyebrow}>ADVISOR CHAT</Text>
            <Text style={s.sectionTitle}>Conversation</Text>
          </View>
          <View
            style={[s.currencyPill, { borderColor: "rgba(0,255,135,0.22)" }]}
          >
            <View style={[s.ctrlDot, { backgroundColor: MINT }]} />
            <Text style={[s.currencyPillTxt, { color: MINT }]}>
              {messages.length} msgs
            </Text>
          </View>
        </View>

        <View style={s.chatMain}>
          <View style={s.chatArea}>
            <ScrollView
              ref={chatRef}
              style={s.chatScroll}
              contentContainerStyle={{ paddingBottom: 8, flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 ? (
                <View style={s.emptyChatWrap}>
                  <Text style={s.emptyChatText}>
                    {planLoading
                      ? "Checking your plan…"
                      : isEligible(plan)
                        ? "Upload a statement and ask about your budget, savings, or investments."
                        : "Upgrade to Plus or Premium to chat with the advisor."}
                  </Text>
                </View>
              ) : (
                <View>
                  {messages.map((m, idx) => (
                    <ChatBubble key={idx} role={m.role} text={m.content} />
                  ))}
                  {thinking && <TypingBubble />}
                </View>
              )}
            </ScrollView>

            {!planLoading && !isEligible(plan) && (
              <UpgradeOverlay plan={plan} />
            )}
          </View>

          <View style={s.composerBox}>
            <View style={s.composerRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                multiline
                placeholder={
                  !planLoading && !isEligible(plan)
                    ? "Upgrade to Plus or Premium to chat with the advisor."
                    : "Ask about your budget, risk, or investments…"
                }
                placeholderTextColor={T_DIM}
                editable={isEligible(plan) && !planLoading}
                style={[
                  s.composerInput,
                  (!isEligible(plan) || planLoading) && s.composerInputDisabled,
                ]}
              />

              <TouchableOpacity
                style={[
                  s.sendBtn,
                  (!input.trim() ||
                    thinking ||
                    !isEligible(plan) ||
                    planLoading) &&
                    s.sendBtnDisabled,
                ]}
                disabled={
                  !input.trim() || thinking || !isEligible(plan) || planLoading
                }
                onPress={onSend}
              >
                <Text style={s.sendBtnText}>{thinking ? "…" : "SEND"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (planLoading && messages.length === 0) {
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
          <Text style={s.loadingTitle}>ADVISOR</Text>
          <Text style={s.loadingMono}>Initialising AI financial console…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <GridBG />
      <View style={s.page}>
        {Header()}
        {BannerCard()}
        {SetupBar()}
        {ChatPanel()}
      </View>
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  page: {
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

  headerCard: {
    margin: 12,
    marginBottom: 6,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
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
    marginBottom: 6,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  logoTxt: { fontSize: 11, fontWeight: "800", color: T_HI, letterSpacing: 2.2 },
  homeBtn: {
    width: 34,
    height: 34,
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

  headerBottomRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 6,
  },
  headerStatusWrap: {
    alignItems: "flex-end",
    gap: 6,
    maxWidth: "42%",
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: -0.3,
    lineHeight: 18,
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 10,
    color: T_MID,
    lineHeight: 13,
  },

  ctrlPillCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  ctrlDot: { width: 5, height: 5, borderRadius: 999 },
  ctrlTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 0.9 },

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
    marginBottom: 8,
  },
  sectionEyebrow: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
    marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: -0.3,
  },

  currencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  currencyPillTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  setupCard: {
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 8,
    borderRadius: 4,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BD,
    position: "relative",
    overflow: "hidden",
  },
  setupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  setupLeft: {
    flex: 1,
  },
  setupRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    flex: 1.25,
  },

  toneChipRowBig: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  toneChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.22)",
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  toneChipSelected: {
    backgroundColor: "rgba(0,255,135,0.10)",
    borderColor: "rgba(0,255,135,0.40)",
  },
  toneChipText: {
    fontSize: 11,
    color: T_MID,
    fontWeight: "700",
  },
  toneChipTextSelected: {
    color: MINT,
  },

  uploadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.35)",
    backgroundColor: "rgba(249,115,22,0.10)",
  },
  uploadBtnDisabled: {
    opacity: 0.5,
  },
  uploadBtnText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: ORANGE,
  },
  uploadProgressWrap: {
    marginTop: 8,
  },
  uploadProgressTrack: {
    height: 5,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  uploadProgressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: ORANGE,
  },
  uploadProgressText: {
    marginTop: 3,
    fontSize: 10,
    color: T_MID,
  },
  fileStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: CARD_BD,
  },
  fileStatusPillActive: {
    backgroundColor: "rgba(0,255,135,0.10)",
    borderColor: "rgba(0,255,135,0.35)",
  },
  fileStatusText: {
    fontSize: 10,
    color: T_MID,
  },
  fileStatusTextActive: {
    color: MINT,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOk: {
    backgroundColor: MINT,
  },
  dotMuted: {
    backgroundColor: T_DIM,
  },

  chatCard: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 10,
    borderRadius: 4,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BD,
    position: "relative",
    overflow: "hidden",
    minHeight: 0,
  },
  chatArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: "rgba(255,255,255,0.015)",
    borderWidth: 1,
    borderColor: CARD_BD,
    borderRadius: 2,
    overflow: "hidden",
  },
  chatMain: {
    flex: 1,
    minHeight: 0,
  },
  chatScroll: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  emptyChatWrap: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyChatText: {
    fontSize: 13,
    color: T_MID,
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 20,
  },

  bubbleRow: {
    marginBottom: 8,
    flexDirection: "row",
  },
  bubbleUser: {
    maxWidth: "82%",
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(0,255,135,0.10)",
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.22)",
  },
  bubbleAssistant: {
    maxWidth: "85%",
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(0,212,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.18)",
  },
  bubbleSystem: {
    maxWidth: "85%",
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(167,139,250,0.06)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.18)",
  },
  bubbleText: {
    fontSize: 13,
    color: T_HI,
    lineHeight: 19,
  },
  typingText: {
    fontSize: 12,
    color: T_MID,
  },

  composerBox: {
    borderTopWidth: 1,
    borderTopColor: CARD_BD,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: "rgba(255,255,255,0.015)",
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  composerInput: {
    flex: 1,
    maxHeight: 90,
    minHeight: 42,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: T_HI,
    backgroundColor: "rgba(255,255,255,0.025)",
    textAlignVertical: "top",
  },
  composerInputDisabled: {
    opacity: 0.5,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 2,
    backgroundColor: MINT,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: BG,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 4,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  errorIconBox: {
    width: 34,
    height: 34,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  errorIconTxt: { fontSize: 15, fontWeight: "800" },
  errorTitle: { fontSize: 12, fontWeight: "700", color: T_HI, marginBottom: 2 },
  errorBody: { fontSize: 12, color: T_MID, lineHeight: 17 },

  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(3,5,8,0.86)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  overlayCard: {
    width: "100%",
    borderRadius: 4,
    padding: 16,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: CARD_BD,
    position: "relative",
    overflow: "hidden",
  },
  overlayHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },
  overlayTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: T_HI,
  },
  overlayText: {
    marginTop: 6,
    fontSize: 13,
    color: T_MID,
    lineHeight: 20,
  },
  overlayPlanText: {
    fontWeight: "800",
    color: GOLD,
  },
  overlayBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  overlayPrimaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 2,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayPrimaryBtnText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: BG,
  },
  overlaySecondaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251,191,36,0.08)",
  },
  overlaySecondaryBtnText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: GOLD,
  },
  overlayFootnote: {
    marginTop: 8,
    fontSize: 11,
    color: T_DIM,
  },
});
