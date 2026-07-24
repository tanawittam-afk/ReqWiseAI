/**
 * Analysis result — read-only for this slice (CLAUDE.md §19: no edit, review, approve
 * or reject UI yet).
 *
 * `getAnalysisRun` filters on the route's project id as well as the run id, so a run
 * id from another tenant's project is a miss, exactly like the source detail page.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { getSource } from "@/lib/sources/queries";
import { getAnalysisRun } from "@/lib/analysis/queries";
import { formatDate } from "../../../../_components/badges";
import { AnalysisWorkspace } from "./workspace";

export const metadata = { title: "Analysis — ReqWise AI" };

export default async function AnalysisResultPage({
  params,
}: {
  params: Promise<{ projectId: string; runId: string }>;
}) {
  const { projectId, runId } = await params;

  const supabase = await createClient();
  const [project, run] = await Promise.all([
    getProject(supabase, projectId),
    getAnalysisRun(supabase, projectId, runId),
  ]);
  if (!project || !run) notFound();

  const source = await getSource(supabase, projectId, run.sourceDocumentId);
  if (!source) notFound();

  if (run.validationStatus !== "valid") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8 sm:px-8">
        <Header projectId={projectId} source={source} createdAt={run.createdAt} />
        <section
          role="alert"
          className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-danger-border bg-danger-soft p-5"
        >
          <h2 className="text-sm font-semibold text-danger">
            {run.validationStatus === "provider_error" ? "Analysis could not be completed" : "Analysis output was invalid"}
          </h2>
          <p className="text-sm leading-relaxed text-text-muted">
            {run.errorSummary?.message ?? "The analysis did not produce a usable result."}
          </p>
          <p className="text-xs text-text-faint">
            No requirements were created from this run. The source revision remains
            locked, because this run still references it.
          </p>
        </section>
        <Link
          href={`/workspace/projects/${projectId}/sources/${source.id}`}
          className="w-fit text-sm font-medium text-accent underline underline-offset-2"
        >
          ← Back to source
        </Link>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-6 sm:px-8">
        <Header projectId={projectId} source={source} createdAt={run.createdAt} />
      </div>
      <AnalysisWorkspace source={source} run={run} />
    </div>
  );
}

function Header({
  projectId,
  source,
  createdAt,
}: {
  projectId: string;
  source: { id: string; title: string };
  createdAt: string;
}) {
  return (
    <header className="flex flex-col gap-1 pb-4">
      <Link
        href={`/workspace/projects/${projectId}/sources/${source.id}`}
        className="w-fit text-xs text-text-faint transition-colors hover:text-text-muted"
      >
        ← {source.title}
      </Link>
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
          Analysis result
        </h1>
        <span className="text-xs text-text-faint">{formatDate(createdAt)}</span>
      </div>
    </header>
  );
}
