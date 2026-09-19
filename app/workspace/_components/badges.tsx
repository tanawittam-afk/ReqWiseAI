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
import { T } from "@/app/_components/t";

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
      {archived ? <T en="Archived" th="เก็บถาวรแล้ว" /> : <T en="Active" th="ใช้งานอยู่" />}
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

/**
 * `lang` is `project.output_lang` — a frozen placeholder once `mode` is
 * `"match_source"` (Phase 2, Slice 6/7): no code path writes a run's actually-resolved
 * language back into it, so showing it as if it were current would be a live-verified
 * lie. Render the mode itself instead; the concrete per-run value only ever lives in
 * `analysis_runs.output_lang`, which `lib/export/load.ts` reads separately.
 */
export function LangBadge({
  lang,
  mode = "fixed",
}: {
  lang: string;
  mode?: "fixed" | "match_source";
}) {
  return (
    <span className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-text-faint">
      {mode === "match_source" ? <T en="Match source" th="ตามต้นฉบับ" /> : lang === "th" ? "TH" : "EN"}
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
      {locked ? (
        <T en="Analysed — locked" th="วิเคราะห์แล้ว — ล็อก" />
      ) : (
        <T en="Editable" th="แก้ไขได้" />
      )}
    </span>
  );
}

/**
 * The latest run's quality score (Phase 2, Slice 3) — `null` (no run yet) renders
 * nothing at all, same convention as `DomainBadge`'s caller omitting it when
 * `project.domain` is null, rather than showing a confusing "—" badge.
 */
export function QualityScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "border-ok-border bg-ok-soft text-ok"
      : score >= 50
        ? "border-warn-border bg-warn-soft text-warn"
        : "border-danger-border bg-danger-soft text-danger";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}
    >
      <T en={`Quality ${score}`} th={`คุณภาพ ${score}`} />
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
