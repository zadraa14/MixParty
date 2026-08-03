export const mixPartyTheme = {
  colors: {
    background: "#070711",
    backgroundDeep: "#04040B",
    surface: "#11111D",
    surfaceStrong: "#181323",
    purple: "#8B5CF6",
    pink: "#EC4899",
    orange: "#F97316",
    cyan: "#22D3EE",
    success: "#10B981",
    danger: "#EF4444",
    text: "#FFFFFF",
    textSoft: "#B8B8C5",
  },
  radius: {
    sm: "14px",
    md: "20px",
    lg: "28px",
    xl: "34px",
    pill: "999px",
  },
  shadow: {
    glass: "0 24px 80px rgba(0,0,0,.34)",
    purple: "0 18px 55px rgba(139,92,246,.26)",
    pink: "0 18px 55px rgba(236,72,153,.24)",
    orange: "0 18px 55px rgba(249,115,22,.22)",
  },
  motion: {
    fast: "180ms",
    normal: "280ms",
    slow: "600ms",
  },
} as const;

export type MixPartyAccent =
  | "purple"
  | "pink"
  | "orange"
  | "cyan"
  | "success"
  | "danger";
