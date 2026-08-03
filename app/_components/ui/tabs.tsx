"use client";

/**
 * A single underline tab, extracted from the pattern already used twice —
 * `analyses/[runId]/_components/requirements-panel.tsx` (Requirements · Open questions
 * · Quality findings) and `inspector.tsx` (Details · Evidence · Relations · …). Both
 * kept their own local copy before this extraction; new tab strips should use this one
 * instead of a third local definition (the plan's trap #11 — existing call sites are
 * migrated opportunistically, not in this pass).
 */
export function Tab({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  /** Omit for a tab with no count badge (not every tab strip counts items). */
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors duration-150 ${
        active
          ? "border-b-accent font-semibold text-text"
          : "border-b-transparent text-text-muted hover:text-text"
      }`}
    >
      {children}
      {count === undefined ? null : (
        <span className="rounded-full bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
          {count}
        </span>
      )}
    </button>
  );
}
