/**
 * Theme selection, kept free of React so the same rules can run inside the
 * blocking script in the document head.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** What actually gets painted, once "system" has been resolved. */
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "obetile-theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * The preference to start from, given what was stored and what the device asks
 * for. Anything unrecognised falls back to following the system rather than
 * forcing a theme on someone.
 */
export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === "light" || theme === "dark") return theme;
  return prefersDark ? "dark" : "light";
}

/**
 * The script that runs before the page paints.
 *
 * It has to be inline and synchronous: anything deferred means the browser
 * paints the default theme first and then repaints, which is the white flash
 * every themed site is judged on. Kept small and total — any failure (private
 * mode denying localStorage, a corrupted value) leaves the attribute unset, and
 * the stylesheet's own defaults take over.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
    var dark = theme === 'dark' || (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {}
})();
`.trim();
