/**
 * Source detail — the document reading surface.
 *
 * The text is rendered as a text node inside a `pre-wrap` block. Not markdown, not
 * HTML, not a sanitised subset: React escapes it and CSS preserves it, so what is on
 * screen is character-for-character what is in the column. That is a requirement, not
 * a style choice — Phase 4 will highlight `rawText.substring(start, end)` on this very
 * element, and any transform applied here would silently move every offset.
 *
 * `getSource` filters on the route's project id as well as the source id, so a real
 * source id under the wrong project is a miss, exactly like a source id belonging to
 * another tenant. Both render the same not-found page.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { getSource } from "@/lib/sources/queries";
import { listAnalysisRuns } from "@/lib/analysis/queries";
import { providerLabel } from "@/lib/providers/labels";
import {
  LockBadge,
  RevisionBadge,
  SourceKindBadge,
  formatDate,
} from "../../../../_components/badges";

export const metadata = { title: "Source — ReqWise AI" };

const STATUS_LABEL: Record<string, string> = {
  valid: "Completed",
  invalid: "Invalid output",
  provider_error: "Provider error",
};

export default async function SourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; sourceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { projectId, sourceId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const [project, source] = await Promise.all([
    getProject(supabase, projectId),
    getSource(supabase, projectId, sourceId),
  ]);
  if (!project || !source) notFound();

  const runs = await listAnalysisRuns(supabase, projectId, sourceId);

  const archived = project.status === "archived";
  const base = `/workspace/projects/${projectId}/sources`;
  const canWrite = !archived;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-3">
        <Link
          href={base}
          className="inline-flex min-h-11 w-fit items-center gap-1 text-xs text-text-faint transition-colors hover:text-text-muted lg:min-h-0"
        >
          <Icon name="arrow-left" size={13} /> Sources
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
            {source.title}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <RevisionBadge revision={source.revisionNumber} />
            <LockBadge locked={source.locked} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceKindBadge kind={source.kind} />
          <span className="font-mono text-[11px] text-text-faint">
            {source.characterCount.toLocaleString()} characters
          </span>
        </div>
      </header>

      {/* The intake screen saved the project and this text, but the analysis did not
          complete. The text is safe; "Analyze requirements" below re-runs it. */}
      {error === "analysis" ? (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          The source was saved, but the analysis did not complete. Nothing was lost — run
          it again below.
        </p>
      ) : null}

      {archived ? (
        <p
          role="status"
          className="rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-4 py-3 text-sm text-warn"
        >
          This project is archived — this document is read-only. Restore the project to
          edit it.
        </p>
      ) : source.locked ? (
        <section
          role="status"
          className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-signal-border bg-signal-soft px-4 py-3"
        >
          <p className="text-sm font-semibold text-signal">
            Revision {source.revisionNumber} has been analysed and is now permanent
          </p>
          <p className="text-xs leading-relaxed text-text-muted">
            {source.analysisRunCount} analysis{" "}
            {source.analysisRunCount === 1 ? "run cites" : "runs cite"} this exact text, so
            it can no longer change — a requirement that points at it must keep pointing at
            what it actually said. Edits are saved as revision {source.revisionNumber + 1}.
          </p>
        </section>
      ) : null}

      {source.supersededById ? (
        <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-4 py-3 text-sm text-text-muted">
          A newer revision of this document exists.{" "}
          <Link
            href={`${base}/${source.supersededById}`}
            className="font-medium text-accent underline underline-offset-2"
          >
            Open revision {source.supersededByRevision}
          </Link>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {/* The document itself */}
        <article className="flex flex-col rounded-[var(--radius-panel)] border border-border-soft bg-surface">
          <h2 className="border-b border-border-soft px-5 py-3 text-sm font-semibold text-text">
            Source text
          </h2>
          {/*
            whitespace-pre-wrap keeps every space, tab and blank line; break-words stops a
            pasted URL from widening the page. The value is a child text node — nothing on
            this page ever sets innerHTML, so a source containing markup is displayed as
            markup, never executed as it.
          */}
          <pre className="overflow-x-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-[13.5px] leading-[1.75] text-text selection:bg-accent-soft">
            {source.rawText}
          </pre>
        </article>

        {/* Inspector — provenance and actions */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              Details
            </h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <Meta label="Revision" value={String(source.revisionNumber)} />
              <Meta label="State" value={source.locked ? "Locked" : "Editable"} />
              <Meta
                label="Source date"
                value={source.metadata.sourceDate ? formatDate(source.metadata.sourceDate) : "—"}
              />
              <Meta label="Stakeholder" value={source.metadata.stakeholder ?? "—"} />
              <Meta label="Added" value={formatDate(source.createdAt)} />
              {source.updatedAt !== source.createdAt ? (
                <Meta label="Edited" value={formatDate(source.updatedAt)} />
              ) : null}
              <Meta label="Analysis runs" value={String(source.analysisRunCount)} />
            </dl>

            {source.metadata.notes ? (
              <p className="mt-3 border-t border-border-soft pt-3 text-xs leading-relaxed text-text-muted">
                {source.metadata.notes}
              </p>
            ) : null}
          </section>

          {source.supersedesId ? (
            <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                Revision history
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                This revision replaces revision {source.revisionNumber - 1}, which stays
                exactly as it was analysed.
              </p>
              <Link
                href={`${base}/${source.supersedesId}`}
                className="mt-2 inline-flex text-xs font-medium text-accent underline underline-offset-2"
              >
                Open revision {source.revisionNumber - 1}
              </Link>
            </section>
          ) : null}

          {canWrite ? (
            <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-accent-border bg-accent-soft p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-accent">
                Analysis
              </h2>
              <p className="text-xs leading-relaxed text-text-muted">
                {source.locked
                  ? "You can run this again — each run is kept separately."
                  : "This will lock revision " + source.revisionNumber + " once the run is created."}
              </p>
              <Link
                href={`${base}/${source.id}/analyze`}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4 text-sm
                           font-semibold text-on-accent transition-colors hover:bg-accent-hover"
              >
                Analyze requirements
              </Link>
            </section>
          ) : null}

          {runs.length > 0 ? (
            <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                Analysis history
              </h2>
              <ul className="flex flex-col gap-2">
                {runs.map((run) => (
                  <li key={run.id}>
                    <Link
                      href={`/workspace/projects/${projectId}/analyses/${run.id}`}
                      className="flex flex-col gap-0.5 rounded-[var(--radius-card)] border border-border-soft px-3 py-2 text-xs
                                 transition-colors hover:border-accent-border hover:bg-accent-soft"
                    >
                      <span className="flex items-center justify-between gap-2 font-medium text-text">
                        {STATUS_LABEL[run.validationStatus] ?? run.validationStatus}
                        <span className="font-mono text-[11px] text-text-muted">
                          {run.itemCount} item{run.itemCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-2 text-text-muted">
                        <span>{providerLabel(run.provider)}</span>
                        <span>{formatDate(run.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {canWrite ? (
            <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                {source.locked ? "Create a revision" : "Edit source"}
              </h2>
              <p className="text-xs leading-relaxed text-text-muted">
                {source.locked
                  ? "The analysed text stays as it is. Your changes become the next revision."
                  : "Nothing has been analysed yet, so this document can still be corrected in place."}
              </p>
              <Link
                href={`${base}/${source.id}/edit`}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4 text-sm
                           font-semibold text-on-accent transition-colors hover:bg-accent-hover"
              >
                {source.locked
                  ? `Create revision ${source.revisionNumber + 1}`
                  : "Edit this source"}
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-text-faint">{label}</dt>
      <dd className="truncate text-right text-sm text-text">{value}</dd>
    </div>
  );
}
