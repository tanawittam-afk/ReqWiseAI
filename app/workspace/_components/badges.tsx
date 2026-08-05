/**
 * Small presentational pieces shared by the project views.
 *
 * Every status carries a word and a mark, never colour alone (CLAUDE.md →
 * Accessibility). The dot is decoration and hidden from assistive technology; the
 * label is the state.
 */

import { Icon } from "@/app/_components/icon";
import type { ProjectStatus } from "@/lib/contracts/project";
import { SOURCE_KIND_LABELS, type SourceKind } from "@/lib/contracts/source";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const archived = status === "archived";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        archived
          ? "border-border-strong bg-surface-muted text-text-muted"
          : "border-ok-border bg-ok-soft text-ok"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${archived ? "bg-text-faint" : "bg-ok"}`}
      />
      {archived ? "Archived" : "Active"}
    </span>
  );
}

export function DomainBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-signal-border bg-signal-soft px-2.5 py-0.5 text-xs font-medium text-signal">
      <Icon name="analyze" size={12} />
      {name}
    </span>
  );
}

export function LangBadge({ lang }: { lang: string }) {
  return (
    <span className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-text-faint">
      {lang === "th" ? "TH" : "EN"}
    </span>
  );
}

export function SourceKindBadge({ kind }: { kind: SourceKind }) {
  return (
    <span className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">
      {SOURCE_KIND_LABELS[kind]}
    </span>
  );
}

/**
 * Locked is a state with consequences, so it says so in words. The unlocked case says
 * "Editable" rather than showing nothing: an absent badge reads as "unknown", and the
 * whole point of the lock is that a person can tell at a glance which one they have.
 */
export function LockBadge({ locked }: { locked: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        locked
          ? "border-signal-border bg-signal-soft text-signal"
          : "border-border-soft bg-surface-muted text-text-muted"
      }`}
    >
      <Icon name={locked ? "locked" : "unlocked"} size={12} />
      {locked ? "Analysed — locked" : "Editable"}
    </span>
  );
}

export function RevisionBadge({ revision }: { revision: number }) {
  return (
    <span className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-text-faint">
      rev {revision}
    </span>
  );
}

/** Dates render on the server; a fixed locale keeps SSR and the client in step. */
export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
