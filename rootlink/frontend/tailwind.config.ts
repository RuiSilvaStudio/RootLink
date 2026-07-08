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
        display: ["var(--font-display)"],
        serif: ["var(--font-serif)"],
      },
      colors: {
        primary: {
          50: "rgb(var(--color-primary-50) / <alpha-value>)",
          100: "rgb(var(--color-primary-100) / <alpha-value>)",
          200: "rgb(var(--color-primary-200) / <alpha-value>)",
          300: "rgb(var(--color-primary-300) / <alpha-value>)",
          400: "rgb(var(--color-primary-400) / <alpha-value>)",
          500: "rgb(var(--color-primary-500) / <alpha-value>)",
          600: "rgb(var(--color-primary-600) / <alpha-value>)",
          700: "rgb(var(--color-primary-700) / <alpha-value>)",
          800: "rgb(var(--color-primary-800) / <alpha-value>)",
          900: "rgb(var(--color-primary-900) / <alpha-value>)",
        },
        earth: {
          50: "rgb(var(--color-earth-50) / <alpha-value>)",
          100: "rgb(var(--color-earth-100) / <alpha-value>)",
          200: "rgb(var(--color-earth-200) / <alpha-value>)",
          300: "rgb(var(--color-earth-300) / <alpha-value>)",
          400: "rgb(var(--color-earth-400) / <alpha-value>)",
          500: "rgb(var(--color-earth-500) / <alpha-value>)",
          600: "rgb(var(--color-earth-600) / <alpha-value>)",
          700: "rgb(var(--color-earth-700) / <alpha-value>)",
          800: "rgb(var(--color-earth-800) / <alpha-value>)",
          900: "rgb(var(--color-earth-900) / <alpha-value>)",
        },
        cream: "rgb(var(--color-cream) / <alpha-value>)",
        rust: {
          50: "rgb(var(--color-rust-50) / <alpha-value>)",
          100: "rgb(var(--color-rust-100) / <alpha-value>)",
          200: "rgb(var(--color-rust-200) / <alpha-value>)",
          300: "rgb(var(--color-rust-300) / <alpha-value>)",
          400: "rgb(var(--color-rust-400) / <alpha-value>)",
          500: "rgb(var(--color-rust-500) / <alpha-value>)",
          600: "rgb(var(--color-rust-600) / <alpha-value>)",
          700: "rgb(var(--color-rust-700) / <alpha-value>)",
          800: "rgb(var(--color-rust-800) / <alpha-value>)",
          900: "rgb(var(--color-rust-900) / <alpha-value>)",
        },
      },
      borderRadius: {
        xl2: "var(--radius-xl2)",
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
