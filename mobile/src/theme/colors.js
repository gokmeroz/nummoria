// mobile/src/theme/colors.js
// Soft Aurora palette — pastel accents, warm bases, modern fintech feel.

export const palette = {
  dark: {
    // Surfaces
    bg: "#0E1424",
    bgElevated: "#141B2E",
    card: "#181F33",
    cardSoft: "#1F2740",
    overlay: "rgba(14,20,36,0.72)",

    // Borders & dividers
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.14)",
    divider: "rgba(255,255,255,0.06)",

    // Pastel accents
    mint: "#86EFAC",
    mintSoft: "rgba(134,239,172,0.14)",
    mintBorder: "rgba(134,239,172,0.30)",

    sky: "#7DD3FC",
    skySoft: "rgba(125,211,252,0.14)",
    skyBorder: "rgba(125,211,252,0.30)",

    lilac: "#C4B5FD",
    lilacSoft: "rgba(196,181,253,0.14)",
    lilacBorder: "rgba(196,181,253,0.30)",

    peach: "#FDBA74",
    peachSoft: "rgba(253,186,116,0.14)",
    peachBorder: "rgba(253,186,116,0.30)",

    rose: "#FDA4AF",
    roseSoft: "rgba(253,164,175,0.14)",
    roseBorder: "rgba(253,164,175,0.30)",

    // Text
    textHi: "#F1F5F9",
    textMid: "#CBD5E1",
    textLow: "#94A3B8",
    textInverse: "#0F172A",

    // Semantic
    income: "#86EFAC",
    expense: "#FDA4AF",
    invest: "#C4B5FD",
    info: "#7DD3FC",
    warning: "#FDBA74",
  },

  light: {
    // Surfaces
    bg: "#FAFAF9",
    bgElevated: "#FFFFFF",
    card: "#FFFFFF",
    cardSoft: "#F4F4F5",
    overlay: "rgba(15,23,42,0.45)",

    // Borders & dividers
    border: "rgba(15,23,42,0.08)",
    borderStrong: "rgba(15,23,42,0.16)",
    divider: "rgba(15,23,42,0.06)",

    // Slightly more saturated accents for visibility on light bg
    mint: "#10B981",
    mintSoft: "rgba(16,185,129,0.10)",
    mintBorder: "rgba(16,185,129,0.30)",

    sky: "#0EA5E9",
    skySoft: "rgba(14,165,233,0.10)",
    skyBorder: "rgba(14,165,233,0.30)",

    lilac: "#8B5CF6",
    lilacSoft: "rgba(139,92,246,0.10)",
    lilacBorder: "rgba(139,92,246,0.30)",

    peach: "#F97316",
    peachSoft: "rgba(249,115,22,0.10)",
    peachBorder: "rgba(249,115,22,0.30)",

    rose: "#E11D48",
    roseSoft: "rgba(225,29,72,0.08)",
    roseBorder: "rgba(225,29,72,0.30)",

    // Text
    textHi: "#0F172A",
    textMid: "#475569",
    textLow: "#94A3B8",
    textInverse: "#FAFAF9",

    // Semantic
    income: "#10B981",
    expense: "#E11D48",
    invest: "#8B5CF6",
    info: "#0EA5E9",
    warning: "#F97316",
  },
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
