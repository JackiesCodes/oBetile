"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import clsx from "clsx";
import { useTheme } from "@/context/ThemeContext";
import type { Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/**
 * Theme picker for the header.
 *
 * Three explicit choices rather than a two-way switch, because "follow my
 * system" is a real preference and a plain toggle silently discards it the
 * first time it is touched.
 */
export default function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The trigger shows what is on screen now, so "system" reads as whichever
  // theme it currently resolves to.
  const Current = resolved === "dark" ? Moon : Sun;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg"
        aria-label="Change theme"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Current size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-36 bg-brand-dark-3 border border-brand-dark-5 rounded-lg shadow-lg overflow-hidden z-50"
        >
          {OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              role="menuitemradio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value);
                setOpen(false);
              }}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
                theme === value
                  ? "text-brand-accent bg-brand-dark-4"
                  : "text-gray-300 hover:bg-brand-dark-4 hover:text-white"
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
