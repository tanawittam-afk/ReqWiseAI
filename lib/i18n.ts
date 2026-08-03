"use client";

import { useSyncExternalStore } from "react";

/**
 * UI chrome language — distinct from `AnalysisInput.outputLang` / `analysis_runs
 * .output_lang`, which control the language the AI writes requirements in. CLAUDE.md
 * keeps these two controls separate on purpose; nothing here may drive the other.
 */
export type Locale = "en" | "th";

// Reads the current locale from <html data-locale>, kept in sync by <LangToggle>.
// For client components that need a *string* (aria-label, placeholder, <option>),
// where the CSS-based <T> component can't be used. SSR renders "en".
function subscribe(cb: () => void) {
  window.addEventListener("localechange", cb);
  return () => window.removeEventListener("localechange", cb);
}
function getSnapshot(): Locale {
  return document.documentElement.getAttribute("data-locale") === "th" ? "th" : "en";
}
function getServerSnapshot(): Locale {
  return "en";
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Pick the right value for the current locale. */
export function pick<T>(locale: Locale, en: T, th: T): T {
  return locale === "th" ? th : en;
}
