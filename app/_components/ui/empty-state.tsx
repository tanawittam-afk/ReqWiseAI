import type { IconName } from "../icon";
import { Icon } from "../icon";

/**
 * Extracted from the dashed-panel empty state repeated across ~12 files (e.g.
 * `workspace/projects/[projectId]/sources/page.tsx`'s "Nothing to analyse yet" and
 * `workspace/projects/page.tsx`'s "Start with the messy version"). Existing call sites
 * are migrated opportunistically as later phases touch those files (the plan's trap
 * #11) — this file lands the shape so a new empty state does not add a 13th ad-hoc copy.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  secondary,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-start gap-3 rounded-[var(--radius-panel)] border border-dashed border-border-strong bg-surface-muted px-6 py-10">
      {icon ? (
        <span className="grid size-9 place-items-center rounded-[var(--radius-card)] bg-surface text-text-faint">
          <Icon name={icon} />
        </span>
      ) : null}
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-text-muted">{body}</p>
      {action || secondary ? (
        <div className="flex flex-wrap items-center gap-3">
          {action}
          {secondary}
        </div>
      ) : null}
    </section>
  );
}
