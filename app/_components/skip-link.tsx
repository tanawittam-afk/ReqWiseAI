/**
 * "Skip to main content" — the first focusable element on every page that has
 * navigation chrome (sidebar, toolbar, or the public site header) ahead of the actual
 * content. Invisible until it receives keyboard focus, per the standard pattern; a
 * mouse or touch user never sees it, a keyboard user tabbing from the top of the page
 * gets a way past the nav on the very first tab stop.
 *
 * `href` must match the `id` on the page's `<main>` — see `docs/design/INTERFACE.md`,
 * Implementation notes, for the two shells this is wired into (`app/workspace/layout.tsx`
 * and `app/_components/site-header.tsx`, both targeting `#main-content`).
 */
export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3
                 focus-visible:z-50 focus-visible:flex focus-visible:min-h-11 focus-visible:items-center
                 focus-visible:rounded-[var(--radius-card)] focus-visible:border-2 focus-visible:border-accent
                 focus-visible:bg-surface focus-visible:px-4 focus-visible:text-sm focus-visible:font-medium
                 focus-visible:text-accent"
    >
      Skip to main content
    </a>
  );
}
