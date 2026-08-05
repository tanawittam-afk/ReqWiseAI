/**
 * Project overview.
 *
 * Two columns on desktop, mirroring the create screen: the project's own content on
 * the left, its metadata and lifecycle in a right-hand inspector — the same seam the
 * analysis workspace will use for requirement metadata, so the shape is established
 * once rather than invented twice.
 *
 * `getProject` returns null both for a project that does not exist and for one that
 * belongs to somebody else — RLS makes those indistinguishable — and both render the
 * same not-found page. Nothing here confirms another tenant's project exists.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { listSources } from "@/lib/sources/queries";
import type { SourceSummary } from "@/lib/sources/types";
import {
  DomainBadge,
  LangBadge,
  LockBadge,
  RevisionBadge,
  StatusBadge,
  formatDate,
} from "../../_components/badges";
import { ArchiveControls } from "./archive-controls";
import { ProjectNav } from "./_components/project-nav";

export const metadata = { title: "Project — ReqWise AI" };

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { projectId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const project = await getProject(supabase, projectId);
  if (!project) notFound();

  // The five most recent documents, so the overview shows the work rather than
  // describing it. The full set lives one click away.
  const recentSources = await listSources(supabase, projectId, { limit: 5 });
  const archived = project.status === "archived";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-2">
        <Link
          href="/workspace/projects"
          className="inline-flex min-h-11 w-fit items-center text-xs text-text-faint transition-colors hover:text-text-muted lg:min-h-0"
        >
          ← Projects
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
            {project.name}
          </h1>
          <StatusBadge status={project.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {project.domain ? <DomainBadge name={project.domain.name} /> : null}
          <LangBadge lang={project.outputLang} />
        </div>
      </header>

      <ProjectNav projectId={projectId} hasItems={project.analysisItemCount > 0} />

      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {error === "archive"
            ? "The project could not be archived."
            : error === "source"
              ? // The intake screen created this project but could not attach the text.
                // Nothing was lost and nothing was duplicated — the project is here, and
                // the source can be added below.
                "The project was created, but the source text could not be saved. Add it below and analyse from there."
              : "The project could not be restored. Only a workspace owner can restore."}
        </p>
      ) : null}

      {archived ? (
        <section
          role="status"
          className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-4 py-3"
        >
          <p className="text-sm font-semibold text-warn">
            This project is archived — read-only
          </p>
          <p className="text-xs leading-relaxed text-text-muted">
            Nothing was deleted: sources, analysis runs and review history are all intact.
            Restore the project to work on it again.
            {project.archiveReason ? ` Reason given: “${project.archiveReason}”.` : ""}
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex flex-col gap-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label="Source documents" value={project.sourceDocumentCount} />
            <Stat label="Analysis runs" value={project.analysisRunCount} />
            <Stat label="Requirements" value={project.analysisItemCount} />
          </section>

          {/*
           * Traceability spans runs, so it belongs to the project rather than to any
           * one analysis. Offered only once there is something to trace — a link to an
           * empty matrix teaches a reader that the feature is empty, not that their
           * project is.
           */}
          {project.analysisItemCount > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ProjectLink
                href={`/workspace/projects/${projectId}/traceability`}
                title="Traceability"
                detail="Objectives → requirements → stories → acceptance criteria, and what is missing"
              />
              {/*
               * Export is offered on the same terms and for the same reason: it reads what
               * the analysis and the review produced, so it is worth offering exactly when
               * there is something to read. An archived project keeps it — an export writes
               * nothing, so there is no action for the archive to refuse.
               */}
              <ProjectLink
                href={`/workspace/projects/${projectId}/exports`}
                title="Export"
                detail="Markdown, JSON, CSV or a printable document for handoff"
              />
            </div>
          ) : null}

          <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface">
            <h2 className="border-b border-border-soft px-5 py-3 text-sm font-semibold text-text">
              Project brief
            </h2>
            <div className="flex flex-col divide-y divide-[var(--border)]">
              <Row label="Description" value={project.description} />
              <Row label="Business objective" value={project.businessObjective} />
              <Row
                label="Known stakeholders"
                value={
                  project.knownStakeholders.length > 0
                    ? project.knownStakeholders.join(" · ")
                    : null
                }
              />
            </div>
          </section>

          {recentSources.length === 0 ? (
            archived ? (
              <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface-muted px-5 py-4">
                <h2 className="text-sm font-semibold text-text">No source documents</h2>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">
                  This project was archived before any source information was added.
                </p>
              </section>
            ) : (
              <section className="rounded-[var(--radius-panel)] border border-accent-border bg-accent-soft px-5 py-4">
                <h2 className="text-sm font-semibold text-text">
                  Next step — add source information
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">
                  Paste the meeting notes, interview or client message this project is
                  about. Requirements are only ever generated from text you supply.
                </p>
                <Link
                  href={`/workspace/projects/${projectId}/sources/new`}
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4
                             text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
                >
                  Add source information
                </Link>
              </section>
            )
          ) : (
            <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-5 py-3">
                <h2 className="text-sm font-semibold text-text">Recent sources</h2>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/workspace/projects/${projectId}/sources`}
                    className="text-xs font-medium text-accent underline underline-offset-2"
                  >
                    View all {project.sourceDocumentCount}
                  </Link>
                  {archived ? null : (
                    <Link
                      href={`/workspace/projects/${projectId}/sources/new`}
                      className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] border border-border-soft px-2.5 text-xs font-medium
                                 text-text-muted transition-colors hover:bg-surface-hover hover:text-text lg:min-h-9"
                    >
                      Add source
                    </Link>
                  )}
                </div>
              </div>
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {recentSources.map((source) => (
                  <SourceRow key={source.id} projectId={projectId} source={source} />
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Inspector — metadata and lifecycle, kept out of the reading column. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              Details
            </h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <Meta label="Domain" value={project.domain?.name ?? "—"} />
              <Meta label="Output" value={project.outputLang === "th" ? "Thai" : "English"} />
              <Meta label="Status" value={archived ? "Archived" : "Active"} />
              <Meta label="Created" value={formatDate(project.createdAt)} />
              <Meta label="Updated" value={formatDate(project.updatedAt)} />
              {archived && project.archivedAt ? (
                <Meta label="Archived" value={formatDate(project.archivedAt)} />
              ) : null}
            </dl>
          </section>

          <ArchiveControls projectId={project.id} archived={archived} />
        </aside>
      </div>
    </main>
  );
}

/** One line per document: what it is, which revision, and whether it can still move. */
function SourceRow({
  projectId,
  source,
}: {
  projectId: string;
  source: SourceSummary;
}) {
  return (
    <li>
      <Link
        href={`/workspace/projects/${projectId}/sources/${source.id}`}
        className="flex min-h-11 flex-col gap-1.5 px-5 py-3 transition-colors hover:bg-surface-hover
                   sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-text">{source.title}</span>
          <span className="truncate text-xs text-text-faint">{source.preview}</span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
          <RevisionBadge revision={source.revisionNumber} />
          <LockBadge locked={source.locked} />
        </span>
      </Link>
    </li>
  );
}

/** One card-shaped destination beneath the project's numbers. */
function ProjectLink({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-card)]
                 border border-border-soft bg-surface px-4 py-3 transition-colors hover:bg-surface-hover"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text">{title}</span>
        <span className="text-xs text-text-faint">{detail}</span>
      </span>
      <span aria-hidden="true" className="text-text-faint">
        →
      </span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-3">
      <p className="text-xl font-semibold text-text">{value}</p>
      <p className="text-xs text-text-faint">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-6">
      <span className="w-44 shrink-0 text-xs font-medium uppercase tracking-wide text-text-faint">
        {label}
      </span>
      <span className={`text-sm leading-relaxed ${value ? "text-text" : "text-text-faint"}`}>
        {value ?? "Not provided"}
      </span>
    </div>
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
