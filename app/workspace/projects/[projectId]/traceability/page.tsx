/**
 * Project traceability.
 *
 * Authorization is RLS, not a check in this file: `getTraceability` returns `null`
 * both for a project that does not exist and for one belonging to another tenant, and
 * both render the same not-found page. Nothing here confirms another tenant's project
 * exists — the same rule the project overview and the analysis workspace follow.
 *
 * An archived project is fully readable. Traceability is a *reading* of history, and
 * slice 6B writes nothing at all, so there is no action for an archive to refuse — the
 * inspector says so rather than leaving the reader to guess why nothing is editable.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { getTraceability } from "@/lib/traceability/queries";
import { ProjectNav } from "../_components/project-nav";
import { TraceabilityView } from "./traceability-view";

export const metadata = { title: "Traceability — ReqWise AI" };

export default async function TraceabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { projectId } = await params;
  const { run } = await searchParams;

  const supabase = await createClient();
  const [project, data] = await Promise.all([
    getProject(supabase, projectId),
    getTraceability(supabase, projectId),
  ]);
  if (!project || !data) notFound();

  // A run id that is not this project's is ignored rather than rejected: it is a
  // stale link, not an attack, and the whole-project view is the honest fallback.
  const initialRunId = data.runs.some((candidate) => candidate.id === run) ? (run ?? null) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border-soft bg-chrome px-4 py-2 sm:px-5">
        <Link
          href={`/workspace/projects/${projectId}`}
          className="inline-flex min-h-11 items-center gap-1 text-xs text-text-muted transition-colors hover:text-text lg:min-h-0"
        >
          <Icon name="arrow-left" size={13} /> {project.name}
        </Link>
        {project.status === "archived" ? (
          <span className="rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-1.5 py-px text-[10px] font-medium text-warn">
            Archived — read-only
          </span>
        ) : null}
        <div className="ml-auto">
          <ProjectNav projectId={projectId} hasItems={project.analysisItemCount > 0} />
        </div>
      </div>

      {data.graph.items.length === 0 ? (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-[var(--space-shell-x)] py-[var(--space-shell-y-tight)] sm:px-[var(--space-shell-x-lg)]">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">Traceability</h1>
          <p className="text-sm leading-relaxed text-text-muted">
            This project has no analysed requirements yet, so there is nothing to trace.
            Add a source document and run an analysis first.
          </p>
          <Link
            href={`/workspace/projects/${projectId}/sources`}
            className="w-fit text-sm font-medium text-accent underline underline-offset-2"
          >
            Go to source documents
          </Link>
        </main>
      ) : (
        <TraceabilityView
          projectId={projectId}
          projectName={project.name}
          graph={data.graph}
          runs={data.runs}
          archived={project.status === "archived"}
          initialRunId={initialRunId}
        />
      )}
    </div>
  );
}
