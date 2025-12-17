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
  radius = 120,

  // ✅ bottom-right: fan up-left (x negative, y negative)
  startAngle = -95,
  endAngle = -175,

  buttonSize = 58,
  mainSize = 62,
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
    outputRange: [0, 0.55],
  });
  const menuScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
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
                activeOpacity={0.9}
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

  // ✅ Bottom-left (fallback)
  wrapBL: {
    position: "absolute",
    left: 18,
    bottom: 18,
    zIndex: 20,
    width: 280,
    height: 280,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  itemWrapBL: {
    position: "absolute",
    left: 7,
    bottom: 7,
  },

  // ✅ Bottom-right (requested)
  wrapBR: {
    position: "absolute",
    right: 18,
    bottom: 18,
    zIndex: 20,
    width: 280,
    height: 280,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  itemWrapBR: {
    position: "absolute",
    right: 7,
    bottom: 7,
  },

  mainFab: {
    //backgroundColor: BRAND_MAIN,
    backgroundColor: "#16a34a",

    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  mainIcon: {
    fontSize: 26,
    fontWeight: "800",
    color: "#06110a",
  },
  itemBtn: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    paddingHorizontal: 8,
  },
  itemText: {
    color: TEXT_SOFT,
    fontWeight: "800",
    fontSize: 10,
    textAlign: "center",
  },
});
