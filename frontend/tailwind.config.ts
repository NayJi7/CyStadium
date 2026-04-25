import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  "#E6EDF6",
          100: "#C2D0E4",
          200: "#8AA3C7",
          300: "#5577AA",
          400: "#2F538D",
          500: "#143876",
          600: "#0F2A5A",
          700: "#0B1F3A",
          800: "#081732",
          900: "#050F22",
          950: "#030918",
        },
        cyan: {
          300: "#67E8F9",
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
        },
        gold: {
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        sans:    ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(34, 211, 238, 0.45)",
        "glow-lg": "0 0 80px -10px rgba(34, 211, 238, 0.55)",
        "glow-gold": "0 0 60px -8px rgba(251, 191, 36, 0.55)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 50% 0%, rgba(34,211,238,0.15), transparent 60%)",
        "mesh-hero":
          "radial-gradient(at 20% 10%, rgba(34,211,238,0.25) 0, transparent 50%)," +
          "radial-gradient(at 80% 20%, rgba(99,102,241,0.20) 0, transparent 50%)," +
          "radial-gradient(at 50% 80%, rgba(251,191,36,0.18) 0, transparent 55%)",
      },
      keyframes: {
        marquee: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-14px)" },
        },
        "pulse-ring": {
          "0%":   { transform: "scale(0.9)", opacity: "0.6" },
          "80%":  { transform: "scale(1.4)", opacity: "0" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        shimmer: "shimmer 6s linear infinite",
        floaty: "floaty 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
