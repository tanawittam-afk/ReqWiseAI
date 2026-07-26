/**
 * Loading a project's whole traceability graph.
 *
 * Every query runs on a **user-scoped** client, so RLS decides visibility — exactly
 * like `lib/analysis/queries.ts`. A project belonging to another tenant and a project
 * that never existed both return `null`, by construction, and no message anywhere
 * distinguishes them.
 *
 * Project-wide rather than run-scoped: traceability is the thing that spans runs, and
 * a matrix that could only see one run would answer a question nobody asked. The run
 * filter is applied afterwards, in `filters.ts`, over the loaded graph.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemType } from "../contracts/item-types";
import { isLegacyRelationType, type RelationType } from "../contracts/relations";
import type { TraceGraph, TraceItem, TraceRelation } from "./types";

export type TraceRun = {
  id: string;
  createdAt: string;
  sourceDocumentId: string;
  itemCount: number;
};

export type TraceabilityData = {
  graph: TraceGraph;
  /** Runs that contributed at least one item, newest first — the run filter's options. */
  runs: TraceRun[];
};

/**
 * `null` means "not visible to you". The caller renders the ordinary not-found page,
 * so a cross-tenant project id is indistinguishable from a typo.
 */
export async function getTraceability(
  client: SupabaseClient,
  projectId: string,
): Promise<TraceabilityData | null> {
  // Confirm the project is readable before loading anything under it. Without this an
  // invisible project would return an empty graph, which reads as "this project has no
  // requirements" rather than "there is no such project".
  const { data: project, error: projectError } = await client
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw new Error(`project query failed: ${projectError.message}`);
  if (!project) return null;

  const { data: itemRows, error: itemError } = await client
    .from("analysis_items")
    .select(
      "id, display_id, item_type, title, status, priority, workflow_state, analysis_run_id",
    )
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("display_id", { ascending: true });

  if (itemError) throw new Error(`traceability item query failed: ${itemError.message}`);

  type ItemRow = {
    id: string;
    display_id: string;
    item_type: ItemType;
    title: string;
    status: string;
    priority: string;
    workflow_state: string | null;
    analysis_run_id: string;
  };
  const rows = ((itemRows ?? []) as unknown) as ItemRow[];
  const itemIds = rows.map((row) => row.id);

  const [refResult, relResult, runResult] = await Promise.all([
    itemIds.length
      ? client.from("item_source_references").select("item_id").in("item_id", itemIds)
      : Promise.resolve({ data: [], error: null }),
    client
      .from("item_relations")
      .select("from_item_id, to_item_id, relation_type")
      .eq("project_id", projectId),
    client
      .from("analysis_runs")
      .select("id, created_at, source_document_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);

  if (refResult.error) throw new Error(`source reference query failed: ${refResult.error.message}`);
  if (relResult.error) throw new Error(`item relation query failed: ${relResult.error.message}`);
  if (runResult.error) throw new Error(`analysis run query failed: ${runResult.error.message}`);

  // Evidence is a boolean here, not a list: the matrix shows *whether* an item is
  // cited, and the excerpt itself belongs to the Analysis Workspace, one click away.
  const cited = new Set(
    ((refResult.data ?? []) as Array<{ item_id: string }>).map((row) => row.item_id),
  );

  const items: TraceItem[] = rows.map((row) => ({
    id: row.id,
    displayId: row.display_id,
    type: row.item_type,
    title: row.title,
    status: row.status,
    priority: row.priority,
    workflowState: row.workflow_state ?? null,
    analysisRunId: row.analysis_run_id,
    hasSourceEvidence: cited.has(row.id),
  }));

  const known = new Set(items.map((item) => item.id));
  const relations: TraceRelation[] = (
    (relResult.data ?? []) as Array<{
      from_item_id: string;
      to_item_id: string;
      relation_type: string;
    }>
  )
    // A relation whose endpoint was soft-deleted has nothing to draw. Dropping it here
    // rather than rendering a dangling edge keeps "a line means two visible items".
    .filter((row) => known.has(row.from_item_id) && known.has(row.to_item_id))
    .map((row) => ({
      fromItemId: row.from_item_id,
      toItemId: row.to_item_id,
      type: row.relation_type as RelationType,
      legacy: isLegacyRelationType(row.relation_type),
    }));

  const itemsByRun = new Map<string, number>();
  for (const item of items) {
    itemsByRun.set(item.analysisRunId, (itemsByRun.get(item.analysisRunId) ?? 0) + 1);
  }

  const runs: TraceRun[] = (
    (runResult.data ?? []) as Array<{ id: string; created_at: string; source_document_id: string }>
  )
    .filter((row) => itemsByRun.has(row.id))
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      sourceDocumentId: row.source_document_id,
      itemCount: itemsByRun.get(row.id) ?? 0,
    }));

  return { graph: { projectId, items, relations }, runs };
}

/**
 * Which run an item belongs to, so "open in the Analysis Workspace" can build the URL.
 * The workspace route is `/workspace/projects/:projectId/analyses/:runId`, and the run
 * is the only part of it the traceability screen does not already know.
 */
export function workspaceHref(projectId: string, item: TraceItem): string {
  return `/workspace/projects/${projectId}/analyses/${item.analysisRunId}?item=${item.id}`;
}
