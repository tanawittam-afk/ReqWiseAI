/**
 * Version history and the review timeline for one requirement.
 *
 * Reads run on a **user-scoped** client, so RLS decides visibility: an item id from
 * another tenant's project and an id that never existed both come back empty, exactly
 * like `lib/analysis/queries.ts`.
 *
 * The "what changed" line is computed here, in the application, by comparing each
 * snapshot with the one that follows it. That is a deliberate limit for this slice:
 * three named fields, compared for equality, no diff library and no character-level
 * highlighting. A dependency that renders a word-level diff is a real feature with
 * real cost, and it is not what a reviewer needs to answer "did somebody change the
 * priority behind my back".
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemStatus } from "../contracts/review.ts";
import { WORKFLOW_ACTIVITY_LABEL } from "../contracts/workflow.ts";

/** The fields a person may edit, and therefore the only fields a diff can report. */
export const COMPARED_FIELDS = ["title", "description", "priority"] as const;
export type ComparedField = (typeof COMPARED_FIELDS)[number];

export type ItemVersionView = {
  versionNo: number;
  title: string;
  description: string;
  priority: string;
  /** The item's review status at the moment the snapshot was taken. */
  status: string;
  changedBy: string | null;
  changeReason: string | null;
  createdAt: string;
  /** Which fields this version's content differs in from the version that replaced it. */
  changedFields: ComparedField[];
};

export type ReviewActivityView = {
  id: string;
  activityType: string;
  fromStatus: string | null;
  toStatus: string | null;
  /**
   * The question / quality workflow transition. A row carries either a review
   * transition (`fromStatus`/`toStatus`) or a workflow one — never both, because the
   * two workflows never touch the same item.
   */
  fromWorkflowState: string | null;
  toWorkflowState: string | null;
  actorId: string;
  comment: string | null;
  createdAt: string;
};

export type ItemHistory = {
  versions: ItemVersionView[];
  activities: ReviewActivityView[];
};

type SnapshotShape = {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  status?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * What changed between an older state and a newer one.
 *
 * Exported and pure so the ordering rules can be tested without a database — the
 * subtle part is not the comparison, it is that version N's snapshot must be compared
 * with version N+1's snapshot (or, for the newest snapshot, with the live item).
 */
export function diffFields(
  older: { title: string; description: string; priority: string },
  newer: { title: string; description: string; priority: string },
): ComparedField[] {
  return COMPARED_FIELDS.filter((field) => older[field] !== newer[field]);
}

export type ItemCurrentState = {
  id: string;
  title: string;
  description: string;
  priority: string;
};

type VersionRow = {
  item_id: string;
  version_no: number;
  snapshot: SnapshotShape;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
};

/**
 * Builds one item's history from its own rows, newest first.
 *
 * Pure, so the ordering and the field comparison can be tested without a database.
 * `current` is the live item: the newest snapshot describes the state *before* the
 * most recent edit, so without the live values there is nothing to compare the top of
 * the list against and the most interesting change would be the one left unlabelled.
 */
export function buildItemHistory(
  versionRows: VersionRow[],
  activityRows: Array<{
    id: string;
    activity_type: string;
    from_status: ItemStatus | null;
    to_status: ItemStatus | null;
    from_workflow_state?: string | null;
    to_workflow_state?: string | null;
    actor_id: string;
    comment: string | null;
    created_at: string;
  }>,
  current: { title: string; description: string; priority: string },
): ItemHistory {
  const rows = [...versionRows].sort((a, b) => b.version_no - a.version_no);

  const versions: ItemVersionView[] = rows.map((row, index) => {
    const snapshot = row.snapshot ?? {};
    const state = {
      title: text(snapshot.title),
      description: text(snapshot.description),
      priority: text(snapshot.priority),
    };
    // rows are newest-first, so the state that REPLACED this one is the previous
    // element — or the live item, for the newest snapshot.
    const successor = index === 0 ? current : {
      title: text(rows[index - 1].snapshot?.title),
      description: text(rows[index - 1].snapshot?.description),
      priority: text(rows[index - 1].snapshot?.priority),
    };
    return {
      versionNo: row.version_no,
      ...state,
      status: text(snapshot.status),
      changedBy: row.changed_by,
      changeReason: row.change_reason,
      createdAt: row.created_at,
      changedFields: diffFields(state, successor),
    };
  });

  const activities: ReviewActivityView[] = [...activityRows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((row) => ({
      id: row.id,
      activityType: row.activity_type,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      fromWorkflowState: row.from_workflow_state ?? null,
      toWorkflowState: row.to_workflow_state ?? null,
      actorId: row.actor_id,
      comment: row.comment,
      createdAt: row.created_at,
    }));

  return { versions, activities };
}

/**
 * Every item's history for one run, in two queries rather than two per item.
 *
 * The whole run's history is a few dozen rows; fetching it with the page keeps the
 * History tab instant and, more usefully, keeps it *server-rendered* — no client
 * fetch, no loading state to get wrong, no second authorization path to audit. RLS
 * decides visibility exactly as it does for the items themselves.
 */
export async function getRunHistory(
  client: SupabaseClient,
  projectId: string,
  items: ItemCurrentState[],
): Promise<Record<string, ItemHistory>> {
  const byItem: Record<string, ItemHistory> = {};
  for (const item of items) byItem[item.id] = { versions: [], activities: [] };
  if (items.length === 0) return byItem;

  const itemIds = items.map((item) => item.id);

  const [versionRows, activityRows] = await Promise.all([
    client
      .from("item_versions")
      .select("item_id, version_no, snapshot, changed_by, change_reason, created_at")
      .eq("project_id", projectId)
      .in("item_id", itemIds),
    client
      .from("review_activities")
      .select(
        "id, item_id, activity_type, from_status, to_status, " +
          "from_workflow_state, to_workflow_state, actor_id, comment, created_at",
      )
      .eq("project_id", projectId)
      .in("item_id", itemIds),
  ]);

  if (versionRows.error) throw new Error(`item version query failed: ${versionRows.error.message}`);
  if (activityRows.error) throw new Error(`review activity query failed: ${activityRows.error.message}`);

  const versionsByItem = new Map<string, VersionRow[]>();
  for (const row of ((versionRows.data ?? []) as unknown) as VersionRow[]) {
    const list = versionsByItem.get(row.item_id) ?? [];
    list.push(row);
    versionsByItem.set(row.item_id, list);
  }

  type ActivityRow = Parameters<typeof buildItemHistory>[1][number] & { item_id: string };
  const activitiesByItem = new Map<string, ActivityRow[]>();
  for (const row of ((activityRows.data ?? []) as unknown) as ActivityRow[]) {
    const list = activitiesByItem.get(row.item_id) ?? [];
    list.push(row);
    activitiesByItem.set(row.item_id, list);
  }

  for (const item of items) {
    byItem[item.id] = buildItemHistory(
      versionsByItem.get(item.id) ?? [],
      activitiesByItem.get(item.id) ?? [],
      item,
    );
  }
  return byItem;
}

/**
 * The sentence a person reads instead of an enum.
 *
 * Derived from the transition where there is one, because `status_change` describes
 * the mechanism and not the decision: the same enum value covers "marked reviewed"
 * and "sent back", and only `to_status` says which.
 */
export function activityLabel(activity: {
  activityType: string;
  fromStatus: string | null;
  toStatus: string | null;
  fromWorkflowState?: string | null;
  toWorkflowState?: string | null;
}): string {
  const { activityType, fromStatus, toStatus } = activity;

  // The eight workflow actions name themselves precisely, so unlike `status_change`
  // there is nothing to derive from the transition.
  const workflow = WORKFLOW_ACTIVITY_LABEL[activityType];
  if (workflow) return workflow;

  if (activityType === "approve" || toStatus === "approved") return "Approved";
  if (activityType === "reject" || toStatus === "rejected") return "Rejected";
  if (activityType === "request_clarification" || toStatus === "needs_clarification") {
    return "Requested clarification";
  }
  if (activityType === "edit" && toStatus === "draft") return "Returned to draft after edit";
  if (toStatus === "reviewed") return "Marked as reviewed";
  if (activityType === "comment") return "Comment";
  if (toStatus === null || toStatus === fromStatus) return "Recorded a note";
  return "Status changed";
}
