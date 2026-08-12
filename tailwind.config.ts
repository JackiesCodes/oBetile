import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /*
       * Colours resolve through CSS variables defined in app/globals.css, so a
       * theme switch is a single attribute change on <html> rather than a
       * `dark:` variant on each of roughly a thousand existing class usages.
       *
       * `<alpha-value>` is what keeps opacity modifiers working: Tailwind
       * substitutes the modifier from `bg-brand-dark-2/60` into that slot.
       *
       * `white` and `gray` are overridden rather than extended, because in this
       * codebase `text-white` means "primary text" and `text-gray-500` means
       * "muted text" — both of which must invert with the theme. `black` is
       * left alone on purpose: it is the text on the green accent button and
       * the colour of modal scrims, and both stay dark in either theme.
       */
      colors: {
        brand: {
          green: "rgb(var(--accent) / <alpha-value>)",
          // Green used as text, an icon or a border rather than as a fill.
          accent: "rgb(var(--accent-on-surface) / <alpha-value>)",
          "green-hover": "rgb(var(--accent-hover) / <alpha-value>)",
          "green-light": "rgb(var(--accent-light) / <alpha-value>)",
          dark: "rgb(var(--surface-0) / <alpha-value>)",
          "dark-2": "rgb(var(--surface-1) / <alpha-value>)",
          "dark-3": "rgb(var(--surface-2) / <alpha-value>)",
          "dark-4": "rgb(var(--surface-3) / <alpha-value>)",
          "dark-5": "rgb(var(--surface-4) / <alpha-value>)",
          header: "rgb(var(--header) / <alpha-value>)",
          // Status colours read the same on either background, so they stay put.
          yellow: "#f5c518",
          red: "#e63946",
        },
        white: "rgb(var(--fg) / <alpha-value>)",
        gray: {
          200: "rgb(var(--muted-200) / <alpha-value>)",
          300: "rgb(var(--muted-300) / <alpha-value>)",
          400: "rgb(var(--muted-400) / <alpha-value>)",
          500: "rgb(var(--muted-500) / <alpha-value>)",
          600: "rgb(var(--muted-600) / <alpha-value>)",
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
