/**
 * What still needs a person — derived, never stored.
 *
 * Pure and DB-free like `lib/analysis/workspace-view.ts`, so the definition of
 * "outstanding" is one testable function rather than a `WHERE` clause repeated in
 * three pages and a count. Nothing here invents a metric: every bucket is a filter
 * over rows the database already holds (CLAUDE.md → "Never invent a metric").
 *
 * **Archived projects are excluded from every bucket.** An archived project is
 * read-only — `edit_analysis_item`, `review_item` and the workflow RPCs all refuse it
 * — so listing its draft items as work would be listing work nobody is allowed to do.
 */

import { isReviewableItemType } from "../contracts/review.ts";
import type { WorkspaceChangeRequestRow, WorkspaceItemRow } from "./types.ts";

export const OUTSTANDING_BUCKETS = [
  "awaiting_review",
  "unanswered_questions",
  "open_findings",
  "pending_change_requests",
] as const;

export type OutstandingBucket = (typeof OUTSTANDING_BUCKETS)[number];

/**
 * The anchor each bucket owns on `/workspace/reviews`, so a dashboard count and the
 * section it refers to can never drift apart.
 */
export const BUCKET_ANCHOR: Record<OutstandingBucket, string> = {
  awaiting_review: "awaiting-review",
  unanswered_questions: "unanswered-questions",
  open_findings: "open-findings",
  pending_change_requests: "pending-change-requests",
};

/** True for a requirement a reviewer has not yet decided on. */
export function isAwaitingReview(item: WorkspaceItemRow): boolean {
  if (item.project.status === "archived") return false;
  if (!isReviewableItemType(item.type)) return false;
  return item.status === "draft" || item.status === "needs_clarification";
}

/** True for a question nobody has answered, deferred or marked not applicable. */
export function isUnansweredQuestion(item: WorkspaceItemRow): boolean {
  if (item.project.status === "archived") return false;
  return item.type === "open_question" && item.workflowState === "open";
}

/**
 * True for a quality finding still in play. `acknowledged` counts: somebody has seen
 * it, but seeing a finding is not resolving it — the two states are separate in
 * `runSummary()` for exactly this reason.
 */
export function isOpenFinding(item: WorkspaceItemRow): boolean {
  if (item.project.status === "archived") return false;
  if (item.type !== "quality_finding") return false;
  return item.workflowState === "open" || item.workflowState === "acknowledged";
}

export type OutstandingWork = {
  awaitingReview: WorkspaceItemRow[];
  unansweredQuestions: WorkspaceItemRow[];
  openFindings: WorkspaceItemRow[];
  pendingChangeRequests: WorkspaceChangeRequestRow[];
};

export function partitionOutstanding(
  items: readonly WorkspaceItemRow[],
  changeRequests: readonly WorkspaceChangeRequestRow[],
): OutstandingWork {
  return {
    awaitingReview: items.filter(isAwaitingReview),
    unansweredQuestions: items.filter(isUnansweredQuestion),
    openFindings: items.filter(isOpenFinding),
    // The query already filters to `pending`; archived projects are dropped here so
    // the rule lives in one place rather than half in SQL and half in TypeScript.
    pendingChangeRequests: changeRequests.filter((row) => row.project.status !== "archived"),
  };
}

export type OutstandingCounts = Record<OutstandingBucket, number>;

export function outstandingCounts(work: OutstandingWork): OutstandingCounts {
  return {
    awaiting_review: work.awaitingReview.length,
    unanswered_questions: work.unansweredQuestions.length,
    open_findings: work.openFindings.length,
    pending_change_requests: work.pendingChangeRequests.length,
  };
}

export function totalOutstanding(counts: OutstandingCounts): number {
  return OUTSTANDING_BUCKETS.reduce((sum, bucket) => sum + counts[bucket], 0);
}

/**
 * Where a row opens. The analysis workspace is the only surface that can act on an
 * item, so every link in every workspace-wide view lands on it with the item selected
 * — the same `?item=` contract the traceability matrix already uses
 * (`lib/traceability/queries.ts` → `workspaceHref`).
 */
export function itemHref(projectId: string, analysisRunId: string, itemId: string): string {
  return `/workspace/projects/${projectId}/analyses/${analysisRunId}?item=${itemId}`;
}
