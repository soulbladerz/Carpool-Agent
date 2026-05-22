import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0f766e",
          dark: "#0b5b54",
          50: "#eff9f7",
          100: "#d6f0ea",
          200: "#aee0d6",
          300: "#7ac8ba",
          400: "#46a99a",
          500: "#2a9081",
          600: "#0f766e",
          700: "#115e59",
          800: "#134e4a",
          900: "#13443f"
        },
        ink: "#16201d",
        paper: "#f6f7f5",
        accent: { DEFAULT: "#ea7b29", dark: "#c4621a" }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem"
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 2px 6px rgba(16,24,40,.05)",
        lift: "0 14px 40px -16px rgba(15,118,110,.35)"
      }
    }
  },
  plugins: []
};

export default config;
