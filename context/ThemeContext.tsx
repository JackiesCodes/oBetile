"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  isTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";

interface ThemeValue {
  /** What the visitor chose, which may be "system". */
  theme: Theme;
  /** What is actually painted right now. */
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const prefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/**
 * Applies a resolved theme to the document.
 *
 * The transition class is added only for the duration of a switch. Leaving it
 * on would make every themed surface cross-fade during route changes, and would
 * animate the very first paint.
 */
function paint(resolved: ResolvedTheme, animate: boolean) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 200);
  }
  root.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The blocking script in the head has already set the attribute, so the
  // first render must agree with it or React will report a mismatch. Reading
  // the stored value rather than assuming a default keeps them in step.
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Private browsing can deny storage; following the system is a fine
      // outcome, it just will not persist.
    }
    const initial: Theme = isTheme(stored) ? stored : "system";
    setThemeState(initial);
    setResolved(resolveTheme(initial, prefersDark()));
  }, []);

  // Someone on "system" who changes it at the OS level should see the site
  // follow, without a reload.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = resolveTheme("system", mq.matches);
      setResolved(next);
      paint(next, true);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not persisting is survivable; not applying it would not be.
    }
    const nextResolved = resolveTheme(next, prefersDark());
    setResolved(nextResolved);
    paint(nextResolved, true);
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
