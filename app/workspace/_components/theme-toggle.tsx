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

const STORAGE_KEY = "reqwise-theme";

function apply(next: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable (private browsing, quota); the toggle still works for
    // this page load, it just won't persist across a reload.
  }
}

export function ThemeToggle() {
  return (
    <div
      aria-label="Color theme"
      className="inline-flex items-center gap-0.5 rounded-lg bg-chrome-hover p-0.5"
    >
      {(["light", "dark"] as const).map((option) => (
        <button
          key={option}
          type="button"
          data-theme-option={option}
          onClick={() => apply(option)}
          aria-label={`Switch to ${option} theme`}
          className="theme-toggle-option flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-text-faint transition-colors hover:text-text-muted"
        >
          <span aria-hidden="true">{option === "light" ? "☀" : "☾"}</span>
          <span className="capitalize">{option}</span>
        </button>
      ))}
    </div>
  );
}
