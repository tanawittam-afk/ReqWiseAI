/**
 * Dashboard — the workspace's front door and the post-sign-in destination.
 *
 * It answers one question before any other: **what still needs a person?** Everything
 * else on the page is context for that. It is not a metrics wall — there is no quality
 * score, no coverage percentage and no trend line, because the database holds none of
 * those (CLAUDE.md → "Never invent a metric to fill a mockup"; ARCHITECTURE §A.4).
 * Every figure here is a real `count` or the length of a real list.
 *
 * RLS scopes every query, so this page never filters by owner itself — the same
 * contract as the projects list, applied to a workspace-wide query shape.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listProjects } from "@/lib/projects/queries";
import { activityLabel } from "@/lib/review/history";
import {
  BUCKET_ANCHOR,
  itemHref,
  outstandingCounts,
  partitionOutstanding,
  totalOutstanding,
  type OutstandingBucket,
} from "@/lib/workspace/outstanding";
import {
  getWorkspaceTotals,
  listPendingChangeRequests,
  listRecentActivity,
  listWorkspaceItems,
} from "@/lib/workspace/queries";
import type { WorkspaceActivityRow } from "@/lib/workspace/types";
import { DomainBadge, LangBadge, formatDate } from "../_components/badges";
import { TryExampleButton } from "../projects/example-button";

export const metadata = { title: "Dashboard — ReqWise AI" };

const BUCKET_LABEL: Record<OutstandingBucket, string> = {
  awaiting_review: "Requirements awaiting review",
  unanswered_questions: "Unanswered questions",
  open_findings: "Open quality findings",
  pending_change_requests: "Change requests pending",
};

const BUCKET_HINT: Record<OutstandingBucket, string> = {
  awaiting_review: "Draft or sent back for clarification",
  unanswered_questions: "Nobody has answered, deferred or dismissed these yet",
  open_findings: "Raised or acknowledged, not yet resolved",
  pending_change_requests: "Proposed against an already-decided requirement",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ items }, changeRequests, totals, recentProjects, activity] = await Promise.all([
    listWorkspaceItems(supabase),
    listPendingChangeRequests(supabase),
    getWorkspaceTotals(supabase),
    listProjects(supabase, "active"),
    listRecentActivity(supabase, 10),
  ]);

  const work = partitionOutstanding(items, changeRequests);
  const counts = outstandingCounts(work);
  const outstanding = totalOutstanding(counts);
  const hasProjects = totals.activeProjects + totals.archivedProjects > 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">Dashboard</h1>
        <p className="text-sm text-text-muted">
          {hasProjects
            ? outstanding === 0
              ? "Nothing is waiting on you. Every requirement, question and finding has been decided."
              : `${outstanding} ${outstanding === 1 ? "thing needs" : "things need"} a decision from you.`
            : "Turn unstructured business information into requirements you can trace back to the sentence they came from."}
        </p>
      </header>

      {hasProjects ? null : <StartHere />}

      {hasProjects ? (
        <>
          <section aria-labelledby="outstanding-heading" className="flex flex-col gap-3">
            <h2 id="outstanding-heading" className="text-sm font-semibold text-text">
              Outstanding work
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(BUCKET_LABEL) as OutstandingBucket[]).map((bucket) => (
                <li key={bucket}>
                  <Link
                    href={`/workspace/reviews#${BUCKET_ANCHOR[bucket]}`}
                    className="group flex h-full flex-col gap-1 rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 transition-colors hover:border-border-strong"
                  >
                    <span
                      className={`font-mono text-[26px] leading-none font-semibold ${
                        counts[bucket] > 0 ? "text-accent" : "text-text-faint"
                      }`}
                    >
                      {counts[bucket]}
                    </span>
                    <span className="text-[13px] font-medium text-text group-hover:text-accent">
                      {BUCKET_LABEL[bucket]}
                    </span>
                    <span className="text-[11px] leading-relaxed text-text-faint">
                      {BUCKET_HINT[bucket]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-text-faint">
              Archived projects are read-only, so nothing in one is counted as work.
            </p>
          </section>

          <section aria-labelledby="totals-heading" className="flex flex-col gap-3">
            <h2 id="totals-heading" className="text-sm font-semibold text-text">
              In this workspace
            </h2>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-border-soft sm:grid-cols-5">
              <Total label="Active projects" value={totals.activeProjects} />
              <Total label="Archived" value={totals.archivedProjects} />
              <Total label="Sources" value={totals.sources} />
              <Total label="Analysis runs" value={totals.analysisRuns} />
              <Total label="Requirements" value={totals.items} />
            </dl>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <RecentProjects projects={recentProjects.slice(0, 5)} />
            <RecentActivity activity={activity} />
          </div>
        </>
      ) : null}
    </main>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 bg-surface p-4">
      <dt className="text-[11px] text-text-faint">{label}</dt>
      <dd className="font-mono text-lg font-semibold text-text">{value}</dd>
    </div>
  );
}

/** The first-run card. Offers the Phase 4 zero-typing path alongside the real one. */
function StartHere() {
  return (
    <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface px-6 py-10 text-center">
      <p aria-hidden="true" className="font-mono text-[13px] text-accent">
        notes → requirements → review
      </p>
      <h2 className="mt-3 text-base font-semibold text-text">เริ่มต้นที่นี่</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-text-muted">
        Paste a set of meeting notes, an interview transcript or a client message. You get
        structured requirements, each traceable to the sentence it came from — and nothing is
        ever approved without you.
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
        <Link
          href="/workspace/projects/new"
          className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          Create your first project
        </Link>
        {/* Runs on the deterministic mock provider, always — never a metered model. */}
        <TryExampleButton />
      </div>
    </section>
  );
}

function RecentProjects({
  projects,
}: {
  projects: Awaited<ReturnType<typeof listProjects>>;
}) {
  return (
    <section aria-labelledby="recent-projects-heading" className="flex flex-col gap-3">
      {/* `items-center` below `lg` so the link's 44px tap area is centred on the row
          rather than hung off the text baseline; the dense desktop row keeps its
          baseline alignment. */}
      <div className="flex items-center justify-between gap-3 lg:items-baseline">
        <h2 id="recent-projects-heading" className="text-sm font-semibold text-text">
          Recent projects
        </h2>
        <Link
          href="/workspace/projects"
          className="inline-flex min-h-11 items-center text-xs font-medium text-accent underline underline-offset-2 lg:min-h-0"
        >
          All projects
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-[var(--radius-panel)] border border-border-soft bg-surface px-4 py-6 text-sm text-text-muted">
          No active projects. Archived ones are still readable from the projects list.
        </p>
      ) : (
        <ul className="flex flex-col gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-border-soft">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/workspace/projects/${project.id}`}
                className="group flex items-center gap-3 bg-surface px-4 py-3 transition-colors hover:bg-surface-hover"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-medium text-text group-hover:text-accent">
                    {project.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {project.domain ? <DomainBadge name={project.domain.name} /> : null}
                    <span className="text-[11px] text-text-faint">
                      {project.analysisItemCount} requirements · updated{" "}
                      {formatDate(project.updatedAt)}
                    </span>
                  </span>
                </span>
                <LangBadge lang={project.outputLang} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The activity feed says *what happened*, never *who did it*.
 *
 * `profiles` is RLS-scoped so one member cannot read another's row. Naming an actor
 * here would need that policy widened to decorate a caption — a real privacy boundary
 * traded for a nicety. The audit trail keeps `actor_id` regardless; this is a display
 * decision, not a gap in the record.
 */
function RecentActivity({ activity }: { activity: WorkspaceActivityRow[] }) {
  return (
    <section aria-labelledby="recent-activity-heading" className="flex flex-col gap-3">
      <h2 id="recent-activity-heading" className="text-sm font-semibold text-text">
        Recent review activity
      </h2>

      {activity.length === 0 ? (
        <p className="rounded-[var(--radius-panel)] border border-border-soft bg-surface px-4 py-6 text-sm text-text-muted">
          Nothing reviewed yet. Every approval, rejection, answer and edit is recorded here
          once review starts.
        </p>
      ) : (
        <ul className="flex flex-col gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-border-soft">
          {activity.map((entry) => (
            <li key={entry.id}>
              <Link
                href={itemHref(entry.project.id, entry.analysisRunId, entry.itemId)}
                className="group flex flex-col gap-1 bg-surface px-4 py-3 transition-colors hover:bg-surface-hover"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-medium tracking-wide text-text-faint">
                    {entry.itemDisplayId}
                  </span>
                  <span className="truncate text-sm font-medium text-text group-hover:text-accent">
                    {activityLabel({
                      activityType: entry.activityType,
                      fromStatus: entry.fromStatus,
                      toStatus: entry.toStatus,
                    })}
                  </span>
                </span>
                <span className="truncate text-xs text-text-muted">{entry.itemTitle}</span>
                <span className="text-[11px] text-text-faint">
                  {entry.project.name} · {formatDate(entry.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
