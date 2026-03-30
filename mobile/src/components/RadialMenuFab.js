// mobile/src/components/RadialMenuFab.js
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
} from "react-native";

const BACKDROP = "rgba(2, 6, 23, 0.32)";
const FAB_BG = "#16a34a";

function normalizeItems(items = []) {
  return items.map((it, index) => ({
    key: it?.key || `item-${index}`,
    title: it?.title || it?.label || it?.text || "Action",
    icon: it?.icon || it?.emoji || "•",
    onPress: typeof it?.onPress === "function" ? it.onPress : () => {},
    destructive: Boolean(it?.destructive),
  }));
}

export default function RadialMenuFab({
  items = [],
  placement = "bottom-right",
  mainSize = 70,
  itemHeight = 56,
  itemGap = 12,
  bottomOffset,
}) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const safeItems = useMemo(() => normalizeItems(items), [items]);

  const resolvedBottom = typeof bottomOffset === "number" ? bottomOffset : 34;

  function toggle() {
    const next = !open;
    setOpen(next);

    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: next ? 240 : 180,
      easing: next ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      if (!next) setOpen(false);
    });
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

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const fabRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const wrapStyle =
    placement === "bottom-left"
      ? { left: 20, right: undefined, bottom: resolvedBottom }
      : { right: 20, left: undefined, bottom: resolvedBottom };

  return (
    <>
      {open ? (
        <Animated.View
          pointerEvents="auto"
          style={[styles.overlay, { opacity: backdropOpacity }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={toggle} />
        </Animated.View>
      ) : null}

      <View pointerEvents="box-none" style={[styles.wrap, wrapStyle]}>
        <View pointerEvents="box-none" style={styles.stack}>
          {safeItems.map((item, idx) => {
            const orderFromBottom = safeItems.length - idx;
            const verticalOffset = orderFromBottom * (itemHeight + itemGap);

            const translateY = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, -verticalOffset],
            });

            const opacity = anim.interpolate({
              inputRange: [0, 0.15, 1],
              outputRange: [0, 0, 1],
            });

            const scale = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.92, 1],
            });

            const slideX = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [placement === "bottom-right" ? 10 : -10, 0],
            });

            return (
              <Animated.View
                key={item.key}
                pointerEvents={open ? "auto" : "none"}
                style={[
                  styles.itemWrap,
                  {
                    opacity,
                    transform: [
                      { translateY },
                      { translateX: slideX },
                      { scale },
                    ],
                    zIndex: 100 - idx,
                    elevation: 100 - idx,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => closeAndRun(item.onPress)}
                  style={[
                    styles.itemBtn,
                    item.destructive && styles.itemBtnDestructive,
                  ]}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      item.destructive && styles.iconWrapDestructive,
                    ]}
                  >
                    <Text style={styles.itemIcon}>{item.icon}</Text>
                  </View>

                  <Text
                    numberOfLines={1}
                    style={[
                      styles.itemTitle,
                      item.destructive && styles.itemTitleDestructive,
                    ]}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={toggle}
          style={[styles.mainFab, { width: mainSize, height: mainSize }]}
        >
          <Animated.Text
            style={[styles.mainIcon, { transform: [{ rotate: fabRotate }] }]}
          >
            +
          </Animated.Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP,
    zIndex: 10,
  },

  wrap: {
    position: "absolute",
    zIndex: 20,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },

  stack: {
    position: "absolute",
    right: 0,
    bottom: 0,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },

  itemWrap: {
    position: "absolute",
    right: 0,
    bottom: 0,
  },

  itemBtn: {
    minWidth: 220,
    maxWidth: 260,
    minHeight: 56,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: "rgba(8, 17, 31, 0.96)",
    borderWidth: 1.5,
    borderColor: "rgba(22,163,74,0.48)",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },

  itemBtnDestructive: {
    borderColor: "rgba(248,113,113,0.42)",
    backgroundColor: "rgba(60, 16, 16, 0.96)",
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(22,163,74,0.16)",
    borderWidth: 1,
    borderColor: "rgba(22,163,74,0.28)",
    marginRight: 10,
  },

  iconWrapDestructive: {
    backgroundColor: "rgba(248,113,113,0.16)",
    borderColor: "rgba(248,113,113,0.28)",
  },

  itemIcon: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  itemTitle: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  itemTitleDestructive: {
    color: "#fecaca",
  },

  mainFab: {
    borderRadius: 999,
    backgroundColor: FAB_BG,
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
    fontSize: 34,
    fontWeight: "900",
    color: "#ffffff",
    lineHeight: 34,
    marginTop: -1,
  },
});
