import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isTheme,
  resolveTheme,
  THEMES,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

const ROOT = path.resolve(__dirname, "..");
const CSS = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
const CONFIG = readFileSync(path.join(ROOT, "tailwind.config.ts"), "utf8");

describe("resolveTheme", () => {
  it("honours an explicit choice regardless of the system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the system when set to system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("always resolves to something paintable", () => {
    for (const t of THEMES) {
      for (const prefersDark of [true, false]) {
        expect(["light", "dark"]).toContain(resolveTheme(t, prefersDark));
      }
    }
  });
});

describe("isTheme", () => {
  it("accepts the real options and rejects anything else", () => {
    for (const t of THEMES) expect(isTheme(t)).toBe(true);
    for (const junk of ["", "DARK", "blue", null, undefined, 1, {}]) {
      expect(isTheme(junk)).toBe(false);
    }
  });
});

describe("the pre-paint script", () => {
  it("reads the same storage key the app writes", () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  it("sets the attribute the stylesheet actually keys on", () => {
    expect(THEME_INIT_SCRIPT).toContain("data-theme");
    expect(CSS).toContain('[data-theme="light"]');
    expect(CSS).toContain('[data-theme="dark"]');
  });

  it("cannot throw the page away if storage is unavailable", () => {
    // Private browsing denies localStorage; an unguarded read there would abort
    // the script and, because it is inline and blocking, leave the document
    // unstyled rather than merely unthemed.
    expect(THEME_INIT_SCRIPT).toMatch(/try\s*\{/);
    expect(THEME_INIT_SCRIPT).toMatch(/catch/);
  });

  it("resolves to a concrete theme, never the literal 'system'", () => {
    // The stylesheet has no rule for [data-theme="system"], so writing it would
    // silently fall through to the dark default.
    expect(CSS).not.toContain('data-theme="system"');
    expect(THEME_INIT_SCRIPT).toMatch(/'dark'\s*:\s*'light'/);
  });
});

/**
 * The palette is declared once and re-pointed per theme. This guards the
 * failure that actually happened while building it: --header was added to the
 * dark and light blocks but missed in the no-JS media query, so a
 * system-light visitor without JavaScript would have got a black header on a
 * white page.
 */
describe("palette completeness", () => {
  const tokensIn = (block: string) =>
    new Set([...block.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]));

  /** The three blocks that assign live tokens, in source order. */
  function assignmentBlocks(): string[] {
    const blocks: string[] = [];
    const re = /\{([^{}]*--surface-0:[^{}]*)\}/g;
    for (const m of CSS.matchAll(re)) blocks.push(m[1]);
    return blocks;
  }

  it("declares a dark and a light value for every palette entry", () => {
    const declared = tokensIn(CSS);
    const darkNames = [...declared].filter((t) => t.startsWith("--dark-"));
    expect(darkNames.length).toBeGreaterThan(10);

    for (const dark of darkNames) {
      const light = dark.replace("--dark-", "--light-");
      expect(declared.has(light), `${dark} has no ${light}`).toBe(true);
    }
  });

  it("sets the same token list in every theme block", () => {
    const blocks = assignmentBlocks();
    // dark default, explicit light, and the no-JS system-light fallback
    expect(blocks.length).toBe(3);

    const [first, ...rest] = blocks.map(tokensIn);
    for (const [i, other] of rest.entries()) {
      const missing = [...first].filter((t) => !other.has(t));
      const extra = [...other].filter((t) => !first.has(t));
      expect(missing, `block ${i + 2} is missing ${missing.join(", ")}`).toEqual([]);
      expect(extra, `block ${i + 2} has unexpected ${extra.join(", ")}`).toEqual([]);
    }
  });

  it("wires every live token to a Tailwind colour", () => {
    // A token nothing references is dead weight; a Tailwind colour pointing at
    // a variable that does not exist renders transparent.
    for (const m of CONFIG.matchAll(/rgb\(var\((--[a-z0-9-]+)\)/g)) {
      expect(CSS, `tailwind references ${m[1]}, which globals.css never sets`).toContain(
        `${m[1]}:`
      );
    }
  });
});

describe("themeable colours", () => {
  it("routes surfaces and text through variables, not fixed hexes", () => {
    for (const token of ["--surface-0", "--fg", "--muted-500", "--accent"]) {
      expect(CONFIG).toContain(`rgb(var(${token}) / <alpha-value>)`);
    }
  });

  it("keeps black literal", () => {
    // text-black is the label on the green accent button and the colour of
    // modal scrims. Both stay dark in either theme, so remapping it would
    // invert 46 call sites that are already correct.
    expect(CONFIG).not.toMatch(/^\s*black:/m);
  });

  it("preserves opacity modifiers", () => {
    // bg-black/60, bg-white/10 and border-white/20 are all in use. Without the
    // <alpha-value> slot Tailwind drops the modifier and the overlay turns solid.
    const colours = [...CONFIG.matchAll(/rgb\(var\(--[a-z0-9-]+\)([^)]*)\)/g)];
    expect(colours.length).toBeGreaterThan(5);
    for (const c of colours) expect(c[1]).toContain("<alpha-value>");
  });
});
