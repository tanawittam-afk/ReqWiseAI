/**
 * The shapes the traceability view works in.
 *
 * Deliberately narrower than `AnalysisItemView`: the matrix and the map need an item's
 * identity, place in the spine, review state and evidence, and nothing else. Passing
 * the full workspace view here would make every pure function in this folder depend on
 * fields it never reads, and would quietly invite one of them to start reading them.
 */

import type { ItemType } from "../contracts/item-types";
import type { RelationType } from "../contracts/relations";

export type TraceItem = {
  id: string;
  displayId: string;
  type: ItemType;
  title: string;
  status: string;
  priority: string;
  /** `null` for the twelve reviewable types — a CHECK constraint guarantees it. */
  workflowState: string | null;
  /** Which run produced it. Drives the optional run filter. */
  analysisRunId: string;
  /** True when the database holds at least one citation for this item. */
  hasSourceEvidence: boolean;
};

export type TraceRelation = {
  fromItemId: string;
  toItemId: string;
  type: RelationType;
  /**
   * True for a row written before slice 6B. Surfaced in the UI as a "Legacy relation"
   * badge rather than silently re-typed — the label records that the provider stated
   * no relationship, and replacing it with a guess would destroy that fact.
   */
  legacy: boolean;
};

export type TraceGraph = {
  projectId: string;
  items: TraceItem[];
  relations: TraceRelation[];
};

/** Statuses that mean a human has signed something off. */
export const APPROVED_STATUS = "approved";
export const REJECTED_STATUS = "rejected";
export const REVIEWED_STATUS = "reviewed";

/** Workflow states that mean an observation is still outstanding. */
export const UNRESOLVED_QUESTION_STATES: readonly string[] = ["open", "deferred"];
export const UNRESOLVED_FINDING_STATES: readonly string[] = ["open", "acknowledged"];
