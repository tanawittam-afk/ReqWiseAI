"use client";

/**
 * Light/dark switch. `data-theme` on <html> is the single source of truth — set before
 * paint by the inline script in app/layout.tsx, changed here at runtime. Persists to
 * localStorage so the choice survives a reload; falls back to the OS preference only on
 * a first visit (see the inline script), never overriding an explicit choice.
 *
 * Deliberately holds no React state: which option looks "active" is driven purely by
 * the `[data-theme] [data-theme-option]` CSS rule in globals.css, keyed off the same
 * `data-theme` attribute this component writes. Reading that attribute back into a
 * `useState`/`useEffect` pair either mismatches the server render or trips
 * react-hooks/set-state-in-effect — neither is worth it for a value CSS can just read.
 */

import { Icon } from "../../_components/icon";
import { pick, useLocale } from "@/lib/i18n";

const STORAGE_KEY = "reqwise-theme";

const OPTION_LABEL: Record<"light" | "dark", { en: string; th: string }> = {
  light: { en: "Light", th: "สว่าง" },
  dark: { en: "Dark", th: "มืด" },
};

function apply(next: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable (private browsing, quota); the toggle still works for
    // this page load, it just won't persist across a reload.
  }
}

/**
 * `compact` drops the text label and shrinks each option to a square icon button — for
 * the sidebar's collapsed (icon-only) state, where the full pill does not fit.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  return (
    <div
      aria-label={pick(locale, "Color theme", "ธีมสี")}
      className={
        "inline-flex items-center gap-0.5 rounded-[var(--radius-card)] bg-chrome-hover p-0.5" +
        (compact ? " flex-col" : "")
      }
    >
      {(["light", "dark"] as const).map((option) => {
        const label = pick(locale, OPTION_LABEL[option].en, OPTION_LABEL[option].th);
        const switchLabel = pick(
          locale,
          `Switch to ${OPTION_LABEL[option].en.toLowerCase()} theme`,
          `เปลี่ยนเป็นธีม${OPTION_LABEL[option].th}`,
        );
        return (
          <button
            key={option}
            type="button"
            data-theme-option={option}
            onClick={() => apply(option)}
            aria-label={switchLabel}
            title={compact ? switchLabel : undefined}
            className={
              "theme-toggle-option flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-card)_-_1px)] text-xs font-medium text-text-faint transition-colors hover:text-text-muted " +
              (compact ? "size-8" : "min-h-11 px-3 py-1.5 lg:min-h-0")
            }
          >
            <Icon name={option === "light" ? "theme-light" : "theme-dark"} size={14} />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
