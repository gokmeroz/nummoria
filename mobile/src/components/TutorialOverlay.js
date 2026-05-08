import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

const BG      = "#030508";
const MINT    = "#00ff87";
const CYAN    = "#00d4ff";
const VIOLET  = "#a78bfa";
const CARD_BG = "rgba(255,255,255,0.03)";
const BORDER  = "rgba(255,255,255,0.09)";
const T_HI    = "#e2e8f0";
const T_MID   = "rgba(226,232,240,0.55)";
const T_DIM   = "rgba(226,232,240,0.30)";

const STORAGE_KEY = "hasSeenTutorial_v1";

/* ─── HUD corner brackets ─────────────────────────────────────── */
function Brackets({ color = MINT, size = 10, thick = 1.5 }) {
  const defs = [
    { top: 0,    left:  0, borderTopWidth: thick,    borderLeftWidth:  thick, borderTopLeftRadius:     2 },
    { top: 0,    right: 0, borderTopWidth: thick,    borderRightWidth: thick, borderTopRightRadius:    2 },
    { bottom: 0, left:  0, borderBottomWidth: thick, borderLeftWidth:  thick, borderBottomLeftRadius:  2 },
    { bottom: 0, right: 0, borderBottomWidth: thick, borderRightWidth: thick, borderBottomRightRadius: 2 },
  ];
  return (
    <>
      {defs.map((d, i) => (
        <View key={i} style={[{ position: "absolute", width: size, height: size, borderColor: color }, d]} />
      ))}
    </>
  );
}

/* ─── Scan-line divider ───────────────────────────────────────── */
function ScanLine({ color = MINT, style: extra }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, extra]}>
      <View style={{ width: 3, height: 3, borderRadius: 999, backgroundColor: color, opacity: 0.6 }} />
      <View style={{ flex: 1, height: 1, backgroundColor: color, opacity: 0.18 }} />
      <View style={{ width: 3, height: 3, borderRadius: 999, backgroundColor: color, opacity: 0.6 }} />
    </View>
  );
}

/* ─── Badge chip ─────────────────────────────────────────────── */
function Badge({ label, color }) {
  return (
    <View style={[s.badge, { borderColor: color + "40", backgroundColor: color + "12" }]}>
      <View style={[s.badgeDot, { backgroundColor: color }]} />
      <Text style={[s.badgeTxt, { color }]}>{label}</Text>
    </View>
  );
}

/* ─── Steps ──────────────────────────────────────────────────── */
const STEPS = [
  {
    badge:  "INITIALISING",
    accent: MINT,
    icon:   "⬡",
    title:  "Welcome to Nummoria",
    body:   "Your AI-powered financial terminal. This tour covers the 5 core modules — takes about 60 seconds.",
    note:   null,
    navigateTo: null,
    hints:  null,
  },
  {
    badge:  "MODULE 01 — EXPENSES",
    accent: VIOLET,
    icon:   "💸",
    title:  "Expense Ledger",
    body:   "Opening the Expense Ledger now. Two ways to log a transaction:",
    note:   "Every expense feeds the AI — the more detail, the sharper the advice.",
    navigateTo: "Expenses",
    hints: [
      {
        icon:  "＋",
        color: VIOLET,
        label: "TAP THE GLOWING +",
        desc:  "Manually enter amount, category, date, and a note. Takes 10 seconds.",
      },
      {
        icon:  "📷",
        color: CYAN,
        label: "SCAN A RECEIPT",
        desc:  "Point the camera at any barcode on a receipt. Nummoria reads it instantly and pre-fills the form for you.",
      },
    ],
  },
  {
    badge:  "MODULE 02 — INCOME",
    accent: MINT,
    icon:   "💰",
    title:  "Income Tracker",
    body:   "Opening Income now. Log your salary, freelance pay, dividends — anything coming in.",
    note:   "No income data = no savings rate. The AI can't plan without it.",
    navigateTo: "Income",
    hints: [
      {
        icon:  "📅",
        color: MINT,
        label: "SET RECURRING INCOME",
        desc:  "Mark a source as recurring and Nummoria reminds you when it's due — great for irregular freelance income.",
      },
    ],
  },
  {
    badge:  "MODULE 03 — INVESTMENTS",
    accent: CYAN,
    icon:   "📈",
    title:  "Portfolio Terminal",
    body:   "Opening Investments. Track stocks, crypto, gold, or any asset class.",
    note:   "Even rough estimates help the AI calculate your real net worth and risk profile.",
    navigateTo: "Investments",
    hints: [
      {
        icon:  "⬡",
        color: CYAN,
        label: "LIVE PRICE SYNC",
        desc:  "Add a ticker symbol (e.g. AAPL, BTC) and Nummoria fetches live prices to calculate your P&L automatically.",
      },
    ],
  },
  {
    badge:  "MODULE 04 — AI ADVISOR",
    accent: CYAN,
    icon:   "🤖",
    title:  "Financial AI",
    body:   "Opening your AI advisor. It reads every transaction you've logged — ask it anything.",
    note:   "More transactions = more personalised, accurate answers.",
    navigateTo: "Financial Helper",
    hints: [
      {
        icon:  "💬",
        color: CYAN,
        label: "TRY ASKING",
        desc:  "\"Where is my money going?\" · \"Can I afford a holiday in June?\" · \"What are my top 3 biggest expenses?\"",
      },
      {
        icon:  "📄",
        color: VIOLET,
        label: "IMPORT BANK STATEMENTS",
        desc:  "Upload a CSV or PDF from any bank to layer in data the AI can analyse alongside your logged transactions.",
      },
    ],
  },
  {
    badge:  "SYSTEM READY",
    accent: MINT,
    icon:   "🚀",
    title:  "Terminal Active",
    body:   "You're all set. Start by logging your first expense or income entry.",
    note:   "5–10 transactions unlocks meaningful AI insights. 30+ and it gets really good.",
    navigateTo: "Dashboard",
    hints:  null,
  },
];

export async function shouldShowTutorial() {
  const val = await AsyncStorage.getItem(STORAGE_KEY);
  return val !== "true";
}

export async function markTutorialSeen() {
  await AsyncStorage.setItem(STORAGE_KEY, "true");
}

/* ─── Main component ─────────────────────────────────────────── */
export default function TutorialOverlay({ visible, onDone, navigation }) {
  const [step, setStep] = React.useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep(0);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [visible]);

  function navigateForStep(index) {
    const target = STEPS[index]?.navigateTo;
    if (target && navigation) navigation.navigate(target);
  }

  function animateStep(next) {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 16, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      navigateForStep(next);
      slideAnim.setValue(-16);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  function handleNext() {
    if (step < STEPS.length - 1) animateStep(step + 1);
    else handleDone();
  }

  function handleBack() {
    if (step > 0) animateStep(step - 1);
  }

  async function handleDone() {
    if (navigation) navigation.navigate("Dashboard");
    await markTutorialSeen();
    onDone();
  }

  const cur    = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDone}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(3,5,8,0.95)" />

      {/* Backdrop with subtle grid lines */}
      <View style={s.backdrop}>

        {/* Grid overlay */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={`h${i}`} style={[s.gridH, { top: `${(i / 12) * 100}%` }]} />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <View key={`v${i}`} style={[s.gridV, { left: `${(i / 7) * 100}%` }]} />
          ))}
        </View>

        {/* Ambient glow behind card */}
        <Animated.View
          pointerEvents="none"
          style={[s.ambientGlow, { backgroundColor: cur.accent, opacity: glowOpacity }]}
        />

        <Animated.View
          style={[
            s.card,
            { borderColor: cur.accent + "35" },
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* HUD corner brackets */}
          <Brackets color={cur.accent} size={12} thick={1.5} />

          {/* Header row: badge + skip */}
          <View style={s.headerRow}>
            <Badge label={cur.badge} color={cur.accent} />
            <TouchableOpacity onPress={handleDone} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={s.skipTxt}>SKIP ✕</Text>
            </TouchableOpacity>
          </View>

          <ScanLine color={cur.accent} style={{ marginBottom: 20 }} />

          {/* Icon */}
          <View style={[s.iconWrap, { borderColor: cur.accent + "35", backgroundColor: cur.accent + "14" }]}>
            <Text style={s.icon}>{cur.icon}</Text>
            {/* inner corner brackets on icon */}
            <Brackets color={cur.accent} size={7} thick={1} />
          </View>

          {/* Title */}
          <Text style={s.title}>{cur.title}</Text>
          <Text style={s.body}>{cur.body}</Text>

          {/* Hint rows */}
          {cur.hints && (
            <View style={s.hintsWrap}>
              {cur.hints.map((h) => (
                <View key={h.label} style={[s.hintRow, { borderColor: h.color + "30", backgroundColor: h.color + "0b" }]}>
                  <Brackets color={h.color} size={6} thick={1} />
                  <View style={[s.hintIconBox, { backgroundColor: h.color + "1e" }]}>
                    <Text style={[s.hintIcon, { color: h.color }]}>{h.icon}</Text>
                  </View>
                  <View style={s.hintText}>
                    <Text style={[s.hintLabel, { color: h.color }]}>{h.label}</Text>
                    <Text style={s.hintDesc}>{h.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Note */}
          {cur.note && (
            <>
              <ScanLine color={cur.accent} style={{ marginBottom: 10 }} />
              <View style={[s.noteWrap, { borderLeftColor: cur.accent }]}>
                <Text style={[s.noteTxt, { color: cur.accent }]}>{cur.note}</Text>
              </View>
            </>
          )}

          {/* Progress dots */}
          <View style={s.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  i === step
                    ? { backgroundColor: cur.accent, width: 20, borderRadius: 2 }
                    : i < step
                    ? { backgroundColor: cur.accent + "55" }
                    : { backgroundColor: BORDER },
                ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={s.btnRow}>
            {step > 0 && (
              <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.7}>
                <Text style={s.backTxt}>← BACK</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.nextBtn, { backgroundColor: cur.accent }, step === 0 && { flex: 1 }]}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={s.nextTxt}>{isLast ? "LAUNCH →" : "NEXT →"}</Text>
            </TouchableOpacity>
          </View>

          {/* Counter */}
          <Text style={s.counter}>{step + 1} / {STEPS.length}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3,5,8,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  gridH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  gridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  ambientGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.06,
    filter: "blur(60px)",
  },
  card: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: CARD_BG,
    borderRadius: 6,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginBottom: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    borderWidth: 1,
  },
  badgeDot: { width: 4, height: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 1.4 },
  skipTxt: { color: T_DIM, fontSize: 9, fontWeight: "700", letterSpacing: 1.2 },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  icon: { fontSize: 30 },
  title: {
    color: T_HI,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  body: {
    color: T_MID,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 0.1,
  },
  hintsWrap: { alignSelf: "stretch", gap: 8, marginBottom: 14 },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 4,
    padding: 11,
  },
  hintIconBox: {
    width: 34,
    height: 34,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  hintIcon: { fontSize: 15, fontWeight: "800" },
  hintText: { flex: 1 },
  hintLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.3, marginBottom: 3 },
  hintDesc:  { fontSize: 12, color: T_MID, lineHeight: 17 },
  noteWrap: {
    alignSelf: "stretch",
    borderLeftWidth: 2,
    paddingLeft: 10,
    marginBottom: 18,
  },
  noteTxt: { fontSize: 11.5, fontWeight: "600", lineHeight: 17, letterSpacing: 0.2 },
  dots: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 20,
    alignItems: "center",
  },
  dot: { height: 4, borderRadius: 999, width: 6 },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "stretch",
  },
  backBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  backTxt: { color: T_MID, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  nextBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 4,
    alignItems: "center",
  },
  nextTxt: { color: BG, fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  counter: { color: T_DIM, fontSize: 10, marginTop: 12, letterSpacing: 0.8 },
});
