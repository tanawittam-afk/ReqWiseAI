/**
 * Extracted from `analyses/[runId]/_components/inspector.tsx`'s local `Chip`. `signal`
 * is reserved for citation/liveness facts (docs/design/INTERFACE.md §9) — never use it
 * as a third decorative color option.
 */
export function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "accent" | "signal";
}) {
  const style =
    tone === "accent"
      ? "border-accent-border bg-accent-soft text-accent"
      : tone === "signal"
        ? "border-signal-border bg-signal-soft text-signal"
        : "border-border-soft bg-surface-muted text-text-muted";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${style}`}>
      {children}
    </span>
  );
}
