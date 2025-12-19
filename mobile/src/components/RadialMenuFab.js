// mobile/src/components/RadialMenuFab.js
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

function polarToCartesian(r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

/**
 * items: [{ key, icon, title, onPress }]
 * placement: "bottom-right" (default) | "bottom-left"
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
    outputRange: [0.9, 1],
  });

  const itemOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Labels appear after opening starts
  const labelOpacity = anim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
  });

  // Slide toward center (bottom-right => slide left, bottom-left => slide right)
  const labelSlide = anim.interpolate({
    inputRange: [0, 1],
    outputRange: placement === "bottom-right" ? [10, 0] : [-10, 0],
  });

  const wrapStyle =
    placement === "bottom-right" ? styles.wrapBR : styles.wrapBL;
  const itemWrapStyle =
    placement === "bottom-right" ? styles.itemWrapBR : styles.itemWrapBL;

  // NEW: Put titles slightly TOP-LEFT of each icon (tooltip-style)
  // For bottom-right placement, "top-left" means up + left (toward screen center).
  // For bottom-left placement, "top-left" means up + right (toward screen center).
  const diagGap = 10;
  const diagX =
    placement === "bottom-right"
      ? -(buttonSize * 0.65 + diagGap)
      : buttonSize * 0.65 + diagGap;
  const diagY = -(buttonSize * 0.55 + 6);

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

          // Keep earlier items on top to avoid label hiding
          const stackZ = 1000 - idx;

          const icon = it.icon ?? it.label ?? "•";
          const title = it.title ?? it.text ?? "";

          return (
            <Animated.View
              key={it.key}
              style={[
                itemWrapStyle,
                {
                  width: buttonSize,
                  height: buttonSize,
                  opacity: itemOpacity,
                  zIndex: stackZ,
                  elevation: stackZ,
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
                style={[
                  styles.itemBtn,
                  {
                    width: buttonSize,
                    height: buttonSize,
                    borderRadius: buttonSize / 2,
                  },
                ]}
              >
                <Text style={styles.itemIcon} numberOfLines={1}>
                  {icon}
                </Text>

                {open && !!title && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.titlePill,
                      {
                        // Diagonal anchor: slightly above + to the "center side"
                        left: "50%",
                        top: "50%",
                        opacity: labelOpacity,
                        zIndex: 9999,
                        elevation: 9999,
                        transform: [
                          { translateX: diagX }, // base diagonal placement
                          { translateY: diagY },
                          { translateX: labelSlide }, // small slide-in polish
                        ],
                      },
                    ]}
                  >
                    <Text
                      style={styles.titleText}
                      numberOfLines={1}
                      ellipsizeMode="clip"
                    >
                      {title}
                    </Text>
                  </Animated.View>
                )}
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

  // Bottom-right
  wrapBR: {
    position: "absolute",
    right: 20,
    bottom: 40,
    zIndex: 20,
    width: 420,
    height: 420,
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
    backgroundColor: "#0a1628",
    borderWidth: 2.5,
    borderColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 10,
  },

  itemIcon: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 26,
    lineHeight: 28,
    textAlign: "center",
  },

  // Diagonal tooltip pill (top-left relative to icon)
  titlePill: {
    position: "absolute",
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(2, 8, 25, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(22,163,74,0.6)",
    justifyContent: "center",
    alignSelf: "flex-start",
    minWidth: 96,
    maxWidth: 220,
    shadowColor: "#000",
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 25,
  },

  titleText: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
});
