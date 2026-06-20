import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        serif: ["Source Serif 4", "Georgia", "serif"],
      },
      colors: {
        primary: {
          50: "#f3f0eb",
          100: "#e3ddd0",
          200: "#cabda6",
          300: "#ad9a7a",
          400: "#917a56",
          500: "#7a6040",
          600: "#634d33",
          700: "#4f3d2a",
          800: "#3d2f21",
          900: "#291f16",
        },
        earth: {
          50: "#f5f0ea",
          100: "#e8ddd0",
          200: "#d4c0a8",
          300: "#bba080",
          400: "#a6845e",
          500: "#8c6b48",
          600: "#70553a",
          700: "#5a432e",
          800: "#453324",
          900: "#2e2218",
        },
        cream: "#f8f6f2",
        rust: {
          50: "#f9f0ec",
          100: "#f0dcd1",
          200: "#e0bea8",
          300: "#cf9b7a",
          400: "#c07d53",
          500: "#a8643d",
          600: "#8b5032",
          700: "#714029",
          800: "#5c3422",
          900: "#4a2a1c",
        },
      },
      borderRadius: {
        xl2: "16px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(32px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "count-up": {
          "0%": { opacity: "0.5" },
          "100%": { opacity: "1" },
        },
        "reveal-line": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s ease-out forwards",
        "fade-in-up": "fade-in-up 0.7s ease-out forwards",
        "slide-in-left": "slide-in-left 0.5s ease-out forwards",
        "scale-in": "scale-in 0.4s ease-out forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "count-up": "count-up 0.3s ease-out",
        "reveal-line": "reveal-line 1s ease-out 0.3s forwards",
        "shimmer": "shimmer 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
