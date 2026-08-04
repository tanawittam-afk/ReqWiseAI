/**
 * Reading across every project the signed-in person can see.
 *
 * New query *shape*, same authorization story as everywhere else: every call runs on a
 * **user-scoped** client, so RLS decides which rows exist at all. Nothing here filters
 * by owner, organization or membership, because nothing here could be trusted to — the
 * `is_project_member(project_id)` policies on `analysis_items`, `change_requests` and
 * `review_activities` are the filter, exactly as they are for the per-project queries
 * in `lib/analysis/queries.ts` and `lib/traceability/queries.ts`.
 *
 * `projects!inner(...)` is an inner join, so an item whose project RLS hides is not
 * merely missing a name — the row itself does not come back. That is deliberate
 * defense in depth: the item policies already exclude it, and the join would exclude
 * it again if they ever did not.
 *
 * **Only `analysis_items` has a direct foreign key to `projects`.** `change_requests`
 * and `review_activities` carry a `project_id` column but reference it only as half of
 * a composite key into `analysis_items` (20260724000002, 20260727000023), so PostgREST
 * cannot embed `projects` from them directly — both reach it *through* the item they
 * are about. Read from the migrations, not assumed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemType } from "../contracts/item-types";
import type {
  WorkspaceActivityRow,
  WorkspaceChangeRequestRow,
  WorkspaceItemRow,
  WorkspaceProjectRef,
  WorkspaceTotals,
} from "./types";

/**
 * How many items a workspace-wide list will load at once.
 *
 * A ceiling rather than pagination: the list filters client-side (the same way the
 * analysis workspace does), and a filter that silently searched only page one would be
 * worse than a list that says out loud it stopped counting. The page renders a notice
 * when the ceiling is hit; it never pretends the rest is not there.
 */
export const WORKSPACE_ITEM_LIMIT = 500;

type ProjectJoin =
  | { id: string; name: string; status: string }
  | Array<{ id: string; name: string; status: string }>
  | null;

/** PostgREST returns an embedded to-one as an object or a one-element array. */
function toProjectRef(value: ProjectJoin): WorkspaceProjectRef | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    status: row.status === "archived" ? "archived" : "active",
  };
}

export type WorkspaceItemsResult = {
  items: WorkspaceItemRow[];
  /** True when the ceiling was reached and the list is not the whole truth. */
  truncated: boolean;
};

/**
 * Every non-deleted item in every visible project, newest activity first.
 *
 * Ordered by `updated_at` rather than `display_id`: across projects a display id is
 * not unique and not meaningful as an ordering — `BR-001` exists once per project —
 * whereas "what moved most recently" is the same question the projects list answers.
 */
export async function listWorkspaceItems(
  client: SupabaseClient,
  limit: number = WORKSPACE_ITEM_LIMIT,
): Promise<WorkspaceItemsResult> {
  const { data, error } = await client
    .from("analysis_items")
    .select(
      "id, display_id, item_type, title, priority, status, evidence_class, confidence, " +
        "updated_at, workflow_state, analysis_run_id, " +
        "projects!inner (id, name, status), " +
        "item_source_references (count)",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit + 1);

  if (error) throw new Error(`workspace item query failed: ${error.message}`);

  type Row = {
    id: string;
    display_id: string;
    item_type: ItemType;
    title: string;
    priority: string;
    status: string;
    evidence_class: string;
    confidence: number;
    updated_at: string;
    workflow_state: string | null;
    analysis_run_id: string;
    projects: ProjectJoin;
    item_source_references: Array<{ count: number }> | { count: number } | null;
  };

  const rows = ((data ?? []) as unknown) as Row[];
  const truncated = rows.length > limit;

  const items = rows.slice(0, limit).flatMap((row) => {
    const project = toProjectRef(row.projects);
    // An item with no readable project cannot be linked anywhere, so it is dropped
    // rather than rendered as a row that goes nowhere. The inner join makes this
    // unreachable in practice; it is here so a schema change cannot make it silent.
    if (!project) return [];
    const countRow = Array.isArray(row.item_source_references)
      ? row.item_source_references[0]
      : row.item_source_references;
    return [
      {
        id: row.id,
        displayId: row.display_id,
        type: row.item_type,
        title: row.title,
        priority: row.priority,
        status: row.status,
        evidenceClass: row.evidence_class,
        confidence: row.confidence,
        updatedAt: row.updated_at,
        workflowState: row.workflow_state ?? null,
        analysisRunId: row.analysis_run_id,
        project,
        hasSourceEvidence: (countRow?.count ?? 0) > 0,
      } satisfies WorkspaceItemRow,
    ];
  });

  return { items, truncated };
}

/**
 * Every pending change request in every visible project, oldest first — a proposal
 * that has waited longest is the one most overdue a decision.
 */
export async function listPendingChangeRequests(
  client: SupabaseClient,
): Promise<WorkspaceChangeRequestRow[]> {
  const { data, error } = await client
    .from("change_requests")
    .select("id, proposed_title, reason, requested_at, target_item_id")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  if (error) throw new Error(`change request queue query failed: ${error.message}`);

  type Row = {
    id: string;
    proposed_title: string;
    reason: string;
    requested_at: string;
    target_item_id: string;
  };
  const rows = ((data ?? []) as unknown) as Row[];
  if (rows.length === 0) return [];

  // A second query rather than an embed: `change_requests` has **two** foreign keys
  // into `analysis_items` (`target_item_id` and `source_question_id`), so a PostgREST
  // embed would need a constraint-name hint — a string that silently returns the wrong
  // column set if the constraint is ever renamed. Two explicit queries cannot rot that
  // way, and the second one is RLS-scoped exactly like the first.
  const targets = await getItemRefs(client, [...new Set(rows.map((row) => row.target_item_id))]);

  return rows.flatMap((row) => {
    const target = targets.get(row.target_item_id);
    if (!target) return [];
    return [
      {
        id: row.id,
        proposedTitle: row.proposed_title,
        reason: row.reason,
        requestedAt: row.requested_at,
        targetItemId: row.target_item_id,
        targetDisplayId: target.displayId,
        targetTitle: target.title,
        analysisRunId: target.analysisRunId,
        project: target.project,
      } satisfies WorkspaceChangeRequestRow,
    ];
  });
}

type ItemRef = {
  displayId: string;
  title: string;
  analysisRunId: string;
  project: WorkspaceProjectRef;
};

/** Display id, title, run and project for a set of item ids. RLS-scoped like the rest. */
async function getItemRefs(
  client: SupabaseClient,
  itemIds: readonly string[],
): Promise<Map<string, ItemRef>> {
  if (itemIds.length === 0) return new Map();

  const { data, error } = await client
    .from("analysis_items")
    .select("id, display_id, title, analysis_run_id, projects!inner (id, name, status)")
    .in("id", itemIds);

  if (error) throw new Error(`item reference query failed: ${error.message}`);

  type Row = {
    id: string;
    display_id: string;
    title: string;
    analysis_run_id: string;
    projects: ProjectJoin;
  };

  const refs = new Map<string, ItemRef>();
  for (const row of ((data ?? []) as unknown) as Row[]) {
    const project = toProjectRef(row.projects);
    if (!project) continue;
    refs.set(row.id, {
      displayId: row.display_id,
      title: row.title,
      analysisRunId: row.analysis_run_id,
      project,
    });
  }
  return refs;
}

/**
 * The most recent review activity across the workspace.
 *
 * No actor name, by design: `profiles` is RLS-scoped so one member cannot read
 * another's row, and widening that policy to decorate a feed would be trading a real
 * privacy boundary for a caption (recorded as a trap in the UX/UI plan). The feed says
 * what happened, to which requirement, and when.
 */
export async function listRecentActivity(
  client: SupabaseClient,
  limit = 12,
): Promise<WorkspaceActivityRow[]> {
  const { data, error } = await client
    .from("review_activities")
    .select("id, activity_type, from_status, to_status, comment, created_at, item_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`activity query failed: ${error.message}`);

  type Row = {
    id: string;
    activity_type: string;
    from_status: string | null;
    to_status: string | null;
    comment: string | null;
    created_at: string;
    item_id: string;
  };
  const rows = ((data ?? []) as unknown) as Row[];
  if (rows.length === 0) return [];

  const items = await getItemRefs(client, [...new Set(rows.map((row) => row.item_id))]);

  return rows.flatMap((row) => {
    const item = items.get(row.item_id);
    // A soft-deleted item still has activity rows. There is nowhere useful to send a
    // reader for one, so it is dropped rather than linked into a 404.
    if (!item) return [];
    return [
      {
        id: row.id,
        activityType: row.activity_type,
        fromStatus: row.from_status ?? null,
        toStatus: row.to_status ?? null,
        comment: row.comment ?? null,
        createdAt: row.created_at,
        itemId: row.item_id,
        itemDisplayId: item.displayId,
        itemTitle: item.title,
        analysisRunId: item.analysisRunId,
        project: item.project,
      } satisfies WorkspaceActivityRow,
    ];
  });
}

/** Five head-counts, no rows transferred. Every figure is a real `count`. */
export async function getWorkspaceTotals(client: SupabaseClient): Promise<WorkspaceTotals> {
  const head = (table: string) => client.from(table).select("id", { count: "exact", head: true });
  const unwrap = (
    table: string,
    result: { count: number | null; error: { message: string } | null },
  ): number => {
    if (result.error) throw new Error(`${table} count failed: ${result.error.message}`);
    return result.count ?? 0;
  };

  const [active, archived, sourceRows, runRows, itemRows] = await Promise.all([
    head("projects").eq("status", "active"),
    head("projects").eq("status", "archived"),
    head("source_documents"),
    head("analysis_runs"),
    head("analysis_items").is("deleted_at", null),
  ]);

  const activeProjects = unwrap("projects", active);
  const archivedProjects = unwrap("projects", archived);
  const sources = unwrap("source_documents", sourceRows);
  const analysisRuns = unwrap("analysis_runs", runRows);
  const items = unwrap("analysis_items", itemRows);

  return { activeProjects, archivedProjects, sources, analysisRuns, items };
}
