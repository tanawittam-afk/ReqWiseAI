/**
 * Project list — the workspace's home.
 *
 * Projects read as documents, not as rows in an admin table or cards in a shop: a
 * title, the two facts that decide what to do next (domain and state), and when it
 * last moved. RLS scopes the query, so this page never filters by owner itself.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_FILTERS, type ProjectFilter } from "@/lib/contracts/project";
import { countProjects, listProjects } from "@/lib/projects/queries";
import { DomainBadge, LangBadge, StatusBadge, formatDate } from "../_components/badges";

export const metadata = { title: "Projects — ReqWise AI" };

function parseFilter(value: string | undefined): ProjectFilter {
  return (PROJECT_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as ProjectFilter)
    : "active";
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const filter = parseFilter((await searchParams).filter);
  const supabase = await createClient();

  const [projects, counts] = await Promise.all([
    listProjects(supabase, filter),
    countProjects(supabase),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">Projects</h1>
          <p className="text-sm text-text-muted">
            {counts.active} active
            <span aria-hidden="true" className="px-1.5 text-text-faint">
              ·
            </span>
            {counts.archived} archived
          </p>
        </div>

        <Link
          href="/workspace/projects/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover sm:min-h-10"
        >
          New project
        </Link>
      </header>

      {/* Segmented control rather than tabs — a filter is a view of one list. */}
      <div
        role="group"
        aria-label="Filter projects"
        className="inline-flex w-fit gap-0.5 rounded-lg border border-border-soft bg-chrome p-0.5"
      >
        {PROJECT_FILTERS.map((value) => {
          const active = value === filter;
          return (
            <Link
              key={value}
              href={`/workspace/projects?filter=${value}`}
              aria-current={active ? "true" : undefined}
              className={`min-h-9 rounded-md px-3.5 py-1.5 text-sm capitalize transition-colors ${
                active
                  ? "bg-surface font-medium text-text shadow-[0_1px_2px_rgba(27,26,24,0.07)]"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {value}
            </Link>
          );
        })}
      </div>

      {projects.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/workspace/projects/${project.id}`}
                className="group flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-border-soft bg-surface p-4
                           transition-[border-color,box-shadow,transform] duration-150
                           hover:border-border-strong hover:shadow-[0_2px_10px_rgba(27,26,24,0.07)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[15px] font-semibold leading-snug text-text group-hover:text-accent">
                    {project.name}
                  </h2>
                  <LangBadge lang={project.outputLang} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {project.domain ? <DomainBadge name={project.domain.name} /> : null}
                  <StatusBadge status={project.status} />
                </div>

                <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border-soft pt-3 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-text-faint">Sources</dt>
                    <dd className="font-medium text-text-muted">{project.sourceDocumentCount}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-text-faint">Requirements</dt>
                    <dd className="font-medium text-text-muted">{project.analysisItemCount}</dd>
                  </div>
                  <div className="col-span-2 pt-1 text-text-faint">
                    {project.status === "archived" && project.archivedAt
                      ? `Archived ${formatDate(project.archivedAt)}`
                      : `Updated ${formatDate(project.updatedAt)}`}
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState({ filter }: { filter: ProjectFilter }) {
  if (filter === "archived") {
    return (
      <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface px-6 py-12 text-center">
        <h2 className="text-sm font-semibold text-text">Nothing archived</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-muted">
          Archived projects stay here in full — sources, runs and review history included.
          Nothing is ever deleted.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface px-6 py-12 text-center">
      <p aria-hidden="true" className="font-mono text-[13px] text-accent">
        notes → requirements → review
      </p>
      <h2 className="mt-3 text-base font-semibold text-text">Start with the messy version</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-text-muted">
        A project holds one piece of business reality — meeting notes, an interview, a client
        message — and turns it into requirements you can trace back to the sentence they came
        from.
      </p>
      <Link
        href="/workspace/projects/new"
        className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
      >
        Create your first project
      </Link>
    </section>
  );
}
