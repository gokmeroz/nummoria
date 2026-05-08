// mobile/src/components/TutorialOverlay.js
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

const { width, height } = Dimensions.get("window");

const BG       = "#030508";
const MINT     = "#00ff87";
const CYAN     = "#00d4ff";
const VIOLET   = "#a78bfa";
const SURFACE  = "rgba(255,255,255,0.05)";
const BORDER   = "rgba(255,255,255,0.09)";
const T_HI     = "#e2e8f0";
const T_MID    = "rgba(226,232,240,0.55)";
const T_DIM    = "rgba(226,232,240,0.32)";

const STORAGE_KEY = "hasSeenTutorial_v1";

const STEPS = [
  {
    icon: "👋",
    accent: MINT,
    title: "Welcome to Nummoria!",
    body: "You're all set. This quick tour shows you how to get the most out of your AI-powered money companion.",
    note: null,
  },
  {
    icon: "💸",
    accent: VIOLET,
    title: "Track your expenses",
    body: "Tap the + button on the Dashboard to log any expense. Categorize it — dining, transport, subscriptions — and the AI will start spotting patterns for you.",
    note: "The more you log, the smarter your advice gets.",
  },
  {
    icon: "💰",
    accent: MINT,
    title: "Add your income",
    body: "Log your salary, freelance payments, or any other income. This gives the AI your full financial picture so it can calculate your real savings rate.",
    note: "No income data = no savings advice.",
  },
  {
    icon: "📈",
    accent: CYAN,
    title: "Track investments",
    body: "Add stocks, crypto, gold, or any asset. Nummoria tracks your real net worth and shows you P&L over time.",
    note: "Even rough numbers help the AI assess your risk profile.",
  },
  {
    icon: "🤖",
    accent: CYAN,
    title: "Meet your AI advisor",
    body: "Head to Financial Helper and ask anything — 'Where is my money going?' or 'Can I afford a vacation in June?' It reads all your transactions and answers based on your actual numbers.",
    note: "More transactions = more personalized answers.",
  },
  {
    icon: "🚀",
    accent: MINT,
    title: "You're ready!",
    body: "Start by adding your first transaction. Even 5-10 entries unlocks meaningful AI insights.",
    note: null,
  },
];

export async function shouldShowTutorial() {
  const val = await AsyncStorage.getItem(STORAGE_KEY);
  return val !== "true";
}

export async function markTutorialSeen() {
  await AsyncStorage.setItem(STORAGE_KEY, "true");
}

export default function TutorialOverlay({ visible, onDone }) {
  const [step, setStep] = React.useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      setStep(0);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  function animateStep(next) {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 20, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(-20);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      animateStep(step + 1);
    } else {
      handleDone();
    }
  }

  function handleBack() {
    if (step > 0) animateStep(step - 1);
  }

  async function handleDone() {
    await markTutorialSeen();
    onDone();
  }

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDone}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(3,5,8,0.92)" />

      {/* Backdrop */}
      <View style={s.backdrop}>

        {/* Card */}
        <Animated.View
          style={[
            s.card,
            { borderColor: current.accent + "33" },
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Skip */}
          <TouchableOpacity style={s.skipBtn} onPress={handleDone} activeOpacity={0.7}>
            <Text style={s.skipTxt}>Skip</Text>
          </TouchableOpacity>

          {/* Icon */}
          <View style={[s.iconWrap, { backgroundColor: current.accent + "18", borderColor: current.accent + "30" }]}>
            <Text style={s.icon}>{current.icon}</Text>
          </View>

          {/* Content */}
          <Text style={s.title}>{current.title}</Text>
          <Text style={s.body}>{current.body}</Text>

          {current.note && (
            <View style={[s.noteWrap, { borderLeftColor: current.accent }]}>
              <Text style={[s.noteTxt, { color: current.accent }]}>{current.note}</Text>
            </View>
          )}

          {/* Progress dots */}
          <View style={s.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  i === step
                    ? { backgroundColor: current.accent, width: 18 }
                    : { backgroundColor: BORDER },
                ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={s.btnRow}>
            {step > 0 && (
              <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.7}>
                <Text style={s.backTxt}>← Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[s.nextBtn, { backgroundColor: current.accent }, step === 0 && { flex: 1 }]}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={s.nextTxt}>
                {isLast ? "Let's go 🚀" : "Next →"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Step counter */}
          <Text style={s.counter}>{step + 1} / {STEPS.length}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3,5,8,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
  },
  skipBtn: {
    position: "absolute",
    top: 16,
    right: 18,
  },
  skipTxt: {
    color: T_DIM,
    fontSize: 13,
    fontWeight: "500",
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  icon: {
    fontSize: 34,
  },
  title: {
    color: T_HI,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  body: {
    color: T_MID,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
  },
  noteWrap: {
    alignSelf: "stretch",
    borderLeftWidth: 2,
    paddingLeft: 12,
    marginBottom: 20,
  },
  noteTxt: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 24,
    alignItems: "center",
  },
  dot: {
    height: 6,
    borderRadius: 3,
    width: 6,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    alignSelf: "stretch",
  },
  backBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  backTxt: {
    color: T_MID,
    fontSize: 14,
    fontWeight: "600",
  },
  nextBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  nextTxt: {
    color: BG,
    fontSize: 14,
    fontWeight: "700",
  },
  counter: {
    color: T_DIM,
    fontSize: 11,
    marginTop: 14,
    fontVariant: ["tabular-nums"],
  },
});
