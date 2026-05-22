// mobile/src/theme/ThemeContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { palette, radii, spacing } from "./colors";

const STORAGE_KEY = "themePreference";

// 'auto' | 'light' | 'dark'
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState("auto");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "auto") {
          setPreferenceState(stored);
        }
      } catch {
        // ignore — fall back to auto
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setPreference = async (next) => {
    setPreferenceState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence errors
    }
  };

  const mode = preference === "auto" ? (systemScheme || "dark") : preference;
  const colors = palette[mode] || palette.dark;

  const value = useMemo(
    () => ({
      mode,
      preference,
      setPreference,
      colors,
      radii,
      spacing,
      hydrated,
      isDark: mode === "dark",
    }),
    [mode, preference, colors, hydrated],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback so existing screens that don't yet consume the context
    // still get a sensible default during the rollout.
    return {
      mode: "dark",
      preference: "auto",
      setPreference: () => {},
      colors: palette.dark,
      radii,
      spacing,
      hydrated: true,
      isDark: true,
    };
  }
  return ctx;
}

// Convenience for non-React modules
export function getCurrentSystemMode() {
  return Appearance.getColorScheme() || "dark";
}
