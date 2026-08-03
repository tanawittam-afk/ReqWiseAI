/**
 * Extracted from `analyses/[runId]/_components/review-actions.tsx`, which had a local
 * muted `Notice` plus two inline `role="alert"`/`role="status"` paragraphs for error and
 * success. Consolidated here as one component with a `tone`, so a future call site picks
 * a tone instead of re-deriving the border/background/text triad and the ARIA role.
 *
 * "Never communicate status by color alone" still applies to this component's caller —
 * `Notice` supplies the color and the correct role; the words are the caller's job.
 */
export function Notice({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "danger" | "success";
  children: React.ReactNode;
}) {
  if (tone === "danger") {
    return (
      <p
        role="alert"
        className="rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger"
      >
        {children}
      </p>
    );
  }
  if (tone === "success") {
    return (
      <p
        role="status"
        className="rounded-[var(--radius-card)] border border-ok-border bg-ok-soft px-3 py-2 text-[12.5px] leading-relaxed text-ok"
      >
        {children}
      </p>
    );
  }
  return (
    <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-text-muted">
      {children}
    </p>
  );
}
