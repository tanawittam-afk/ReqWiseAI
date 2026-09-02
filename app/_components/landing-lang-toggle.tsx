"use client";

/**
 * EN/TH switch for the landing page only.
 *
 * Not `LangToggle` (`./lang-toggle.tsx`) restyled — that component reads `--chrome-hover`/
 * `--text-faint`, tokens that follow the app's light/dark toggle. The landing page has
 * one fixed dark look regardless of `data-theme` (CLAUDE.md's landing-page exception,
 * `globals.css`'s `.landing-evidence` block), so a shared component would need the app's
 * theme system threaded through it for a page that doesn't use that system at all. Same
 * underlying mechanism as `LangToggle` (same `data-locale` attribute, same storage key,
 * same `localechange` event `useLocale()` listens for) — only the paint differs.
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

export function LandingLangToggle() {
  return (
    <div
      aria-label="Language"
      className="inline-flex items-center gap-0.5 rounded-[4px] border border-[var(--le-border)] bg-white/5 p-0.5"
    >
      {(["en", "th"] as const).map((option) => (
        <button
          key={option}
          type="button"
          data-locale-option={option}
          onClick={() => apply(option)}
          aria-label={option === "th" ? "เปลี่ยนเป็นภาษาไทย" : "Switch to English"}
          className="landing-lang-option flex min-h-9 items-center justify-center px-2.5 font-mono text-xs font-semibold text-[var(--le-text-faint)] transition-colors hover:text-[var(--le-text)]"
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
