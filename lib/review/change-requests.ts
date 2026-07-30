/**
 * Reading change requests for a run's items.
 *
 * Same shape as `history.ts`'s `getRunHistory`: a bulk fetch scoped by `project_id`, run
 * on a **user-scoped** client so RLS decides visibility exactly as it does for the
 * items themselves. Every change request (any status) for every item in the run comes
 * back in one query, which is also what the requirements-list "pending" badge reads —
 * no separate project-wide query, since the run's own items are already the whole set.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChangeRequestStatus } from "../contracts/change-requests.ts";

export type ChangeRequestView = {
  id: string;
  targetItemId: string;
  sourceQuestionId: string | null;
  status: ChangeRequestStatus;
  proposedTitle: string;
  proposedDescription: string;
  proposedPriority: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  appliedVersionNo: number | null;
};

type ChangeRequestRow = {
  id: string;
  target_item_id: string;
  source_question_id: string | null;
  status: ChangeRequestStatus;
  proposed_title: string;
  proposed_description: string;
  proposed_priority: string;
  reason: string;
  requested_by: string;
  requested_at: string;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  applied_version_no: number | null;
};

function toView(row: ChangeRequestRow): ChangeRequestView {
  return {
    id: row.id,
    targetItemId: row.target_item_id,
    sourceQuestionId: row.source_question_id,
    status: row.status,
    proposedTitle: row.proposed_title,
    proposedDescription: row.proposed_description,
    proposedPriority: row.proposed_priority,
    reason: row.reason,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    resolutionNote: row.resolution_note,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    appliedVersionNo: row.applied_version_no,
  };
}

const CHANGE_REQUEST_COLUMNS =
  "id, target_item_id, source_question_id, status, proposed_title, proposed_description, " +
  "proposed_priority, reason, requested_by, requested_at, resolution_note, resolved_by, " +
  "resolved_at, applied_version_no";

/**
 * Every change request (any status) for a set of items, newest first within each item.
 */
export async function getChangeRequestsForItems(
  client: SupabaseClient,
  projectId: string,
  itemIds: string[],
): Promise<Record<string, ChangeRequestView[]>> {
  const byItem: Record<string, ChangeRequestView[]> = {};
  for (const id of itemIds) byItem[id] = [];
  if (itemIds.length === 0) return byItem;

  const { data, error } = await client
    .from("change_requests")
    .select(CHANGE_REQUEST_COLUMNS)
    .eq("project_id", projectId)
    .in("target_item_id", itemIds);

  if (error) throw new Error(`change request query failed: ${error.message}`);

  for (const row of ((data ?? []) as unknown) as ChangeRequestRow[]) {
    const list = byItem[row.target_item_id] ?? [];
    list.push(toView(row));
    byItem[row.target_item_id] = list;
  }
  for (const id of itemIds) {
    byItem[id].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }
  return byItem;
}

/**
 * Candidate target items for a change request raised from an answered question: the
 * requirement(s) it `raises_question` — reversed, since the relation is authored
 * requirement -> question. Zero or more than one candidate means the UI must fall back
 * to a manual picker rather than guessing.
 */
export async function getChangeRequestTargetCandidates(
  client: SupabaseClient,
  projectId: string,
  questionItemId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("item_relations")
    .select("from_item_id")
    .eq("project_id", projectId)
    .eq("to_item_id", questionItemId)
    .eq("relation_type", "raises_question");

  if (error) throw new Error(`change request candidate query failed: ${error.message}`);

  return ((data ?? []) as Array<{ from_item_id: string }>).map((row) => row.from_item_id);
}
