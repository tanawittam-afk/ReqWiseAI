/**
 * Analysis result — the review surface.
 *
 * `getAnalysisRun` filters on the route's project id as well as the run id, so a run
 * id from another tenant's project is a miss, exactly like the source detail page.
 *
 * The whole run's version history and review timeline are loaded here, in two extra
 * queries, rather than fetched per item from the client: it keeps the History tab
 * server-rendered, and it keeps authorization in one place — RLS decides what these
 * queries return exactly as it decides what the items query returns.
 *
 * `canReview` is a UI convenience and nothing more. An archived project is refused by
 * `edit_analysis_item` and `review_item` regardless of what the page renders.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { getSource } from "@/lib/sources/queries";
import { getAnalysisRun } from "@/lib/analysis/queries";
import { toAnalysisWorkspaceRun } from "@/lib/analysis/workspace-view";
import { getRunHistory } from "@/lib/review/history";
import { providerLabel } from "@/lib/providers/labels";
import type { ProviderKey } from "@/lib/providers/types";
import { formatDate } from "../../../../_components/badges";
import { AnalysisWorkspace } from "./workspace";

export const metadata = { title: "Analysis — ReqWise AI" };

export default async function AnalysisResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; runId: string }>;
  /** `?item=` — where a link from the Traceability matrix lands. */
  searchParams: Promise<{ item?: string }>;
}) {
  const { projectId, runId } = await params;
  const { item } = await searchParams;

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
        <Header
          projectId={projectId}
          runId={runId}
          source={source}
          createdAt={run.createdAt}
          provider={run.provider}
        />
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

  /*
   * The workspace claims the whole viewport below the toolbar: each panel scrolls on
   * its own, and the page itself never does. That is why there is no centred wrapper
   * and no page padding here — a productivity application, not a document
   * (docs/design/INTERFACE.md §1).
   */
  const [history, { data: userData }] = await Promise.all([
    getRunHistory(supabase, projectId, run.items),
    supabase.auth.getUser(),
  ]);

  // An `?item=` naming an item of another run — or of another tenant's project —
  // simply matches nothing in `run.items`, so it is ignored and the workspace opens on
  // its own default. Nothing in the response distinguishes the two cases.
  const initialItemId = run.items.some((candidate) => candidate.id === item) ? (item ?? null) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-border-soft bg-chrome px-4 py-2 sm:px-5">
        <Header
          projectId={projectId}
          runId={runId}
          source={source}
          createdAt={run.createdAt}
          provider={run.provider}
        />
      </div>
      <AnalysisWorkspace
        source={source}
        run={toAnalysisWorkspaceRun(run)}
        history={history}
        canReview={project.status === "active"}
        currentUserId={userData.user?.id ?? null}
        initialItemId={initialItemId}
      />
    </div>
  );
}

function Header({
  projectId,
  runId,
  source,
  createdAt,
  provider,
}: {
  projectId: string;
  runId: string;
  source: { id: string; title: string };
  createdAt: string;
  provider: ProviderKey;
}) {
  return (
    // `items-center` rather than `items-baseline`: the two links carry a 44px tap area
    // below `md` (they are the only way out of this screen on a phone, and neither is
    // repeated anywhere else on it), and a baseline row would hang that padding off the
    // text instead of centring it.
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 md:items-baseline">
      <h1 className="text-sm font-semibold tracking-[-0.005em] text-text">Analysis result</h1>
      <span className="text-xs font-medium text-text-muted">{providerLabel(provider)}</span>
      <span className="text-xs text-text-faint">{formatDate(createdAt)}</span>
      <Link
        href={`/workspace/projects/${projectId}/traceability?run=${runId}`}
        className="ml-auto inline-flex min-h-11 items-center text-xs text-text-muted transition-colors hover:text-text lg:min-h-0"
      >
        Traceability →
      </Link>
      <Link
        href={`/workspace/projects/${projectId}/sources/${source.id}`}
        className="inline-flex min-h-11 items-center text-xs text-text-muted transition-colors hover:text-text lg:min-h-0"
      >
        ← Back to source
      </Link>
    </header>
  );
}
