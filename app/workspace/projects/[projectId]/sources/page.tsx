/**
 * Source list.
 *
 * A shelf of documents rather than a table of rows: each card is the thing itself —
 * title, kind, revision, a couple of lines of what it actually says. The lock badge is
 * the one piece of state that changes what a user may do, so it travels with every
 * card instead of living in a legend.
 *
 * An archived project renders the same list with the writing actions withdrawn. The
 * evidence stays readable; only the ability to add to it goes away.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { EmptyState } from "@/app/_components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { listSources } from "@/lib/sources/queries";
import {
  LockBadge,
  RevisionBadge,
  SourceKindBadge,
  formatDate,
} from "../../../_components/badges";
import { ProjectNav } from "../_components/project-nav";

export const metadata = { title: "Sources — ReqWise AI" };

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();
  const project = await getProject(supabase, projectId);
  if (!project) notFound();

  const sources = await listSources(supabase, projectId);
  const archived = project.status === "archived";
  const locked = sources.filter((source) => source.locked).length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-[var(--space-shell-gap)] px-[var(--space-shell-x)] py-[var(--space-shell-y)] sm:px-[var(--space-shell-x-lg)] sm:py-[var(--space-shell-y-lg)]">
      <header className="flex flex-col gap-3">
        <Link
          href={`/workspace/projects/${projectId}`}
          className="inline-flex min-h-11 w-fit items-center gap-1 text-xs text-text-faint transition-colors hover:text-text-muted lg:min-h-0"
        >
          <Icon name="arrow-left" size={13} /> {project.name}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">Sources</h1>
            <p className="text-sm text-text-muted">
              {sources.length === 0
                ? "No source documents yet"
                : `${sources.length} document${sources.length === 1 ? "" : "s"}` +
                  (locked > 0 ? ` · ${locked} analysed and locked` : "")}
            </p>
          </div>
          {archived ? null : (
            <Link
              href={`/workspace/projects/${projectId}/sources/new`}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4 text-sm
                         font-semibold text-on-accent transition-colors hover:bg-accent-hover"
            >
              Add source
            </Link>
          )}
        </div>
        <ProjectNav projectId={projectId} hasItems={project.analysisItemCount > 0} />
      </header>

      {archived ? (
        <p
          role="status"
          className="rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-4 py-3 text-sm text-warn"
        >
          This project is archived — sources are read-only. Restore the project to add or
          edit them.
        </p>
      ) : null}

      {sources.length === 0 ? (
        <EmptyState
          icon="paste"
          title="Nothing to analyse yet"
          body="Requirements are only ever generated from text you supply. Paste the meeting
            notes, interview or client message this project is about, and it becomes the
            evidence every requirement is traced back to."
          action={
            archived ? undefined : (
              <Link
                href={`/workspace/projects/${projectId}/sources/new`}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4 text-sm
                           font-semibold text-on-accent transition-colors hover:bg-accent-hover"
              >
                Add the first source
              </Link>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <li key={source.id}>
              <Link
                href={`/workspace/projects/${projectId}/sources/${source.id}`}
                className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-border-soft
                           bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-hover"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold leading-snug text-text">{source.title}</h2>
                  <RevisionBadge revision={source.revisionNumber} />
                </div>

                <p className="line-clamp-3 text-xs leading-relaxed text-text-muted">
                  {source.preview}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  <SourceKindBadge kind={source.kind} />
                  <LockBadge locked={source.locked} />
                </div>

                <p className="text-xs text-text-faint">
                  {source.sourceDate ? `Dated ${formatDate(source.sourceDate)} · ` : ""}
                  Added {formatDate(source.createdAt)}
                  {source.updatedAt !== source.createdAt
                    ? ` · edited ${formatDate(source.updatedAt)}`
                    : ""}
                  {source.supersedesId ? " · supersedes an earlier revision" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
