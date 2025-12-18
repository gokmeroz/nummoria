import React, { useMemo, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";

const BG_DARK = "#020617";
const CARD_DARK = "#020819";
const BORDER_DARK = "#0f172a";
const BRAND_MAIN = "#4f772d";
const TEXT_SOFT = "rgba(148,163,184,0.95)";

function polarToCartesian(r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

/**
 * items: [{ key, label, onPress }]
 * placement: "bottom-right" (default)
 */
export default function RadialMenuFab({
  items = [],
  radius = 160,
  startAngle = -100,
  endAngle = -190,
  buttonSize = 60,
  mainSize = 70,
  placement = "bottom-right",
}) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const points = useMemo(() => {
    const n = Math.max(items.length, 1);
    const step = n === 1 ? 0 : (endAngle - startAngle) / (n - 1);
    return items.map((_, i) => polarToCartesian(radius, startAngle + step * i));
  }, [items, radius, startAngle, endAngle]);

  function toggle() {
    const next = !open;
    setOpen(next);

    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function closeAndRun(fn) {
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setOpen(false);
      fn?.();
    });
  }

  const overlayOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.65],
  });
  const menuScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  const wrapStyle =
    placement === "bottom-right" ? styles.wrapBR : styles.wrapBL;
  const itemWrapStyle =
    placement === "bottom-right" ? styles.itemWrapBR : styles.itemWrapBL;

  return (
    <>
      {open && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={toggle}
          />
        </Animated.View>
      )}

      <View pointerEvents="box-none" style={wrapStyle}>
        {items.map((it, idx) => {
          const { x, y } = points[idx];

          const translateX = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, x],
          });
          const translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, y],
          });
          const opacity = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
          });

          return (
            <Animated.View
              key={it.key}
              style={[
                itemWrapStyle,
                {
                  width: buttonSize,
                  height: buttonSize,
                  opacity,
                  transform: [
                    { translateX },
                    { translateY },
                    { scale: menuScale },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => closeAndRun(it.onPress)}
                style={styles.itemBtn}
              >
                <Text style={styles.itemText} numberOfLines={2}>
                  {it.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={toggle}
          style={[styles.mainFab, { width: mainSize, height: mainSize }]}
        >
          <Text style={styles.mainIcon}>{open ? "×" : "≡"}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_DARK,
    zIndex: 10,
  },

  // Bottom-left
  wrapBL: {
    position: "absolute",
    left: 20,
    bottom: 35,
    zIndex: 20,
    width: 350,
    height: 350,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  itemWrapBL: {
    position: "absolute",
    left: 12,
    bottom: 12,
  },

  // Bottom-right (improved spacing)
  wrapBR: {
    position: "absolute",
    right: 20,
    bottom: 40,
    zIndex: 20,
    width: 400,
    height: 400,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  itemWrapBR: {
    position: "absolute",
    right: 15,
    bottom: 15,
  },

  mainFab: {
    backgroundColor: "#16a34a",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",

    // Enhanced visibility and tap area
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  mainIcon: {
    fontSize: 32,
    fontWeight: "900",
    color: "#ffffff",
    lineHeight: 32,
  },

  itemBtn: {
    flex: 1,
    width: 60,
    height: 60,
    borderRadius: 30,

    backgroundColor: "#0a1628",
    borderWidth: 2.5,
    borderColor: "#16a34a",

    alignItems: "center",
    justifyContent: "center",

    // Strong shadow for visibility
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  itemText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 28,
    lineHeight: 30,
    textAlign: "center",
  },
});
