"use client";

/**
 * EN/TH switch for UI chrome. Mirrors app/workspace/_components/theme-toggle.tsx
 * exactly: `data-locale` on <html> is the single source of truth, set before paint by
 * the inline script in app/layout.tsx, changed here at runtime, persisted to
 * localStorage. Deliberately holds no React state — which option looks "active" is
 * driven purely by the `[data-locale] .lang-toggle-option` CSS rule in globals.css, so
 * it can never drift from the attribute that actually controls every <T> swap on the
 * page. Fires a "localechange" event so useLocale() subscribers (lib/i18n.ts) update.
 */

const STORAGE_KEY = "reqwise-locale";

function apply(next: "en" | "th") {
  const root = document.documentElement;
  if (next === "th") {
    root.setAttribute("data-locale", "th");
  } else {
    root.removeAttribute("data-locale");
  }
  root.setAttribute("lang", next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable (private browsing, quota); the toggle still works for
    // this page load, it just won't persist across a reload.
  }
  window.dispatchEvent(new Event("localechange"));
}

/**
 * `compact` drops the text label and shrinks each option to a square icon button — for
 * the sidebar's collapsed (icon-only) state, matching ThemeToggle's `compact` prop.
 */
export function LangToggle({ compact = false }: { compact?: boolean }) {
  return (
    <div
      aria-label="Language"
      className={
        "inline-flex items-center gap-0.5 rounded-[var(--radius-card)] bg-chrome-hover p-0.5" +
        (compact ? " flex-col" : "")
      }
    >
      {(["en", "th"] as const).map((option) => (
        <button
          key={option}
          type="button"
          data-locale-option={option}
          onClick={() => apply(option)}
          aria-label={option === "th" ? "เปลี่ยนเป็นภาษาไทย" : "Switch to English"}
          title={compact ? (option === "th" ? "เปลี่ยนเป็นภาษาไทย" : "Switch to English") : undefined}
          className={
            "lang-toggle-option flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-card)_-_1px)] font-mono text-xs font-semibold text-text-faint transition-colors hover:text-text-muted " +
            (compact ? "size-8" : "px-3 py-1.5")
          }
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
