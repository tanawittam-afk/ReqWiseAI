/**
 * The row shapes the workspace-wide views read.
 *
 * Deliberately lighter than `AnalysisItemView` (`lib/analysis/queries.ts`): a
 * cross-project list shows *which* item and *where it lives*, and everything that
 * makes the analysis workspace expensive per item — every excerpt, every relation,
 * every change request — belongs one click away, in the run itself. Loading that for
 * every item in every project to render a list would be paying the workspace's price
 * for a table of contents.
 *
 * `hasSourceEvidence` is a boolean here for the same reason it is one in
 * `lib/traceability/types.ts`: the list answers "is this cited", the workspace answers
 * "cited where".
 */

import type { ItemType } from "../contracts/item-types";

export type WorkspaceProjectRef = {
  id: string;
  name: string;
  /** Archived projects are read-only, so their items are never outstanding work. */
  status: "active" | "archived";
};

export type WorkspaceItemRow = {
  id: string;
  displayId: string;
  type: ItemType;
  title: string;
  priority: string;
  status: string;
  evidenceClass: string;
  confidence: number;
  updatedAt: string;
  /** `null` for the twelve reviewable types — a CHECK constraint guarantees it. */
  workflowState: string | null;
  analysisRunId: string;
  project: WorkspaceProjectRef;
  hasSourceEvidence: boolean;
};

/**
 * A pending change request, flattened for the queue.
 *
 * `requestedBy` is deliberately absent: `profiles` is RLS-scoped so that one member
 * cannot read another's row, and a queue that named a person would either be wrong or
 * would need a policy widened to feed a list. The queue answers "what is waiting",
 * which needs no name.
 */
export type WorkspaceChangeRequestRow = {
  id: string;
  proposedTitle: string;
  reason: string;
  requestedAt: string;
  targetItemId: string;
  targetDisplayId: string;
  targetTitle: string;
  analysisRunId: string;
  project: WorkspaceProjectRef;
};

/** One entry in the recent-activity feed. Never carries an actor name — see above. */
export type WorkspaceActivityRow = {
  id: string;
  activityType: string;
  fromStatus: string | null;
  toStatus: string | null;
  comment: string | null;
  createdAt: string;
  itemId: string;
  itemDisplayId: string;
  itemTitle: string;
  analysisRunId: string;
  project: WorkspaceProjectRef;
};

/** Head-counts only — no rows are transferred to produce these. */
export type WorkspaceTotals = {
  activeProjects: number;
  archivedProjects: number;
  sources: number;
  analysisRuns: number;
  items: number;
};
