/**
 * Small presentational pieces shared by the project views.
 *
 * Every status carries a word and a mark, never colour alone (CLAUDE.md →
 * Accessibility). The dot is decoration and hidden from assistive technology; the
 * label is the state.
 */

import type { ProjectStatus } from "@/lib/contracts/project";

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
      <span aria-hidden="true">◇</span>
      {name}
    </span>
  );
}

export function LangBadge({ lang }: { lang: string }) {
  return (
    <span className="rounded-md border border-border-soft bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-text-faint">
      {lang === "th" ? "TH" : "EN"}
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
