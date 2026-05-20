import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#16a34a",
          "green-hover": "#22c55e",
          "green-light": "#dcfce7",
          dark: "#111111",
          "dark-2": "#1a1a1a",
          "dark-3": "#222222",
          "dark-4": "#2a2a2a",
          "dark-5": "#333333",
          yellow: "#f5c518",
          red: "#e63946",
        },
      },
      fontFamily: {
        sans: ["Rajdhani", "Inter", "sans-serif"],
        rajdhani: ["Rajdhani", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
