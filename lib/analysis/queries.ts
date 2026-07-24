/**
 * Reading analysis runs and their items.
 *
 * Every query runs on a **user-scoped** client, so RLS decides visibility — a run
 * belonging to another tenant's project and a run that never existed are both `null`,
 * by construction, exactly like `lib/sources/queries.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemType } from "../contracts/item-types";

export type AnalysisRunSummary = {
  id: string;
  sourceDocumentId: string;
  validationStatus: "valid" | "invalid" | "provider_error";
  createdAt: string;
  itemCount: number;
};

export type AnalysisSourceReferenceView = {
  excerpt: string;
  startOffset: number | null;
  endOffset: number | null;
  evidenceStrength: number | null;
  offsetVerified: boolean;
};

export type AnalysisItemView = {
  id: string;
  displayId: string;
  providerKey: string;
  type: ItemType;
  title: string;
  description: string;
  priority: string;
  status: string;
  evidenceClass: string;
  origin: string;
  confidence: number;
  rationale: string | null;
  attributes: Record<string, unknown> | null;
  sourceReferences: AnalysisSourceReferenceView[];
  relatedDisplayIds: string[];
};

export type AnalysisRunDetail = {
  id: string;
  projectId: string;
  sourceDocumentId: string;
  validationStatus: "valid" | "invalid" | "provider_error";
  outputLang: string;
  schemaVersion: string;
  createdAt: string;
  /** A user-safe category and message; never the raw provider output or issue paths. */
  errorSummary: { category: string; message: string } | null;
  items: AnalysisItemView[];
  summary: {
    itemCount: number;
    byType: Partial<Record<ItemType, number>>;
  };
};

/** Newest first — the run just created is the one worth seeing. */
export async function listAnalysisRuns(
  client: SupabaseClient,
  projectId: string,
  sourceId: string,
): Promise<AnalysisRunSummary[]> {
  const { data, error } = await client
    .from("analysis_runs")
    .select("id, source_document_id, validation_status, created_at, analysis_items(count)")
    .eq("project_id", projectId)
    .eq("source_document_id", sourceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`analysis run list query failed: ${error.message}`);

  return ((data ?? []) as unknown as Array<{
    id: string;
    source_document_id: string;
    validation_status: AnalysisRunSummary["validationStatus"];
    created_at: string;
    analysis_items: Array<{ count: number }> | { count: number } | null;
  }>).map((row) => {
    const countRow = Array.isArray(row.analysis_items) ? row.analysis_items[0] : row.analysis_items;
    return {
      id: row.id,
      sourceDocumentId: row.source_document_id,
      validationStatus: row.validation_status,
      createdAt: row.created_at,
      itemCount: countRow?.count ?? 0,
    };
  });
}

export function safeErrorSummary(
  status: AnalysisRunDetail["validationStatus"],
  error: unknown,
): AnalysisRunDetail["errorSummary"] {
  if (status === "valid") return null;
  const record = (error ?? {}) as Record<string, unknown>;
  if (status === "provider_error") {
    return {
      category: "provider_error",
      message: "The analysis provider could not produce a result. Try again.",
    };
  }
  const issueCount = Array.isArray(record.issues) ? record.issues.length : 0;
  return {
    category: "validation_failed",
    message:
      issueCount > 0
        ? `The analysis output was invalid (${issueCount} issue${issueCount === 1 ? "" : "s"} found).`
        : "The analysis output was invalid.",
  };
}

/**
 * Null means "not visible to you" — a wrong id, another tenant's id, or a run from a
 * different project than the route says. Filtering on `project_id` as well as `id`
 * is what makes the last of those a miss.
 */
export async function getAnalysisRun(
  client: SupabaseClient,
  projectId: string,
  runId: string,
): Promise<AnalysisRunDetail | null> {
  const { data: run, error: runError } = await client
    .from("analysis_runs")
    .select("id, project_id, source_document_id, validation_status, output_lang, schema_version, created_at, error")
    .eq("project_id", projectId)
    .eq("id", runId)
    .maybeSingle();

  if (runError) throw new Error(`analysis run query failed: ${runError.message}`);
  if (!run) return null;

  const { data: itemRows, error: itemError } = await client
    .from("analysis_items")
    .select(
      "id, display_id, provider_key, item_type, title, description, priority, status, " +
        "evidence_class, origin, confidence, rationale, attributes",
    )
    .eq("analysis_run_id", runId)
    .is("deleted_at", null)
    .order("display_id", { ascending: true });

  if (itemError) throw new Error(`analysis item query failed: ${itemError.message}`);

  type ItemRow = {
    id: string;
    display_id: string;
    provider_key: string;
    item_type: ItemType;
    title: string;
    description: string;
    priority: string;
    status: string;
    evidence_class: string;
    origin: string;
    confidence: number;
    rationale: string | null;
    attributes: Record<string, unknown> | null;
  };
  const items_ = ((itemRows ?? []) as unknown) as ItemRow[];

  const itemIds = items_.map((row) => row.id);
  const displayIdById = new Map(items_.map((row) => [row.id, row.display_id]));

  const [refRows, relRows] = await Promise.all([
    itemIds.length
      ? client
          .from("item_source_references")
          .select("item_id, excerpt, start_offset, end_offset, evidence_strength, offset_verified")
          .in("item_id", itemIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? client.from("item_relations").select("from_item_id, to_item_id").in("from_item_id", itemIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (refRows.error) throw new Error(`source reference query failed: ${refRows.error.message}`);
  if (relRows.error) throw new Error(`item relation query failed: ${relRows.error.message}`);

  const refsByItem = new Map<string, AnalysisSourceReferenceView[]>();
  for (const row of (refRows.data ?? []) as Array<Record<string, unknown>>) {
    const itemId = row.item_id as string;
    const list = refsByItem.get(itemId) ?? [];
    list.push({
      excerpt: row.excerpt as string,
      startOffset: (row.start_offset as number | null) ?? null,
      endOffset: (row.end_offset as number | null) ?? null,
      evidenceStrength: (row.evidence_strength as number | null) ?? null,
      offsetVerified: row.offset_verified as boolean,
    });
    refsByItem.set(itemId, list);
  }

  const relatedByItem = new Map<string, string[]>();
  for (const row of (relRows.data ?? []) as Array<{ from_item_id: string; to_item_id: string }>) {
    const list = relatedByItem.get(row.from_item_id) ?? [];
    const displayId = displayIdById.get(row.to_item_id);
    if (displayId) list.push(displayId);
    relatedByItem.set(row.from_item_id, list);
  }

  const items: AnalysisItemView[] = items_.map((row) => ({
    id: row.id,
    displayId: row.display_id,
    providerKey: row.provider_key,
    type: row.item_type,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    evidenceClass: row.evidence_class,
    origin: row.origin,
    confidence: row.confidence,
    rationale: row.rationale ?? null,
    attributes: row.attributes ?? null,
    sourceReferences: refsByItem.get(row.id) ?? [],
    relatedDisplayIds: relatedByItem.get(row.id) ?? [],
  }));

  const byType: Partial<Record<ItemType, number>> = {};
  for (const item of items) byType[item.type] = (byType[item.type] ?? 0) + 1;

  return {
    id: run.id,
    projectId: run.project_id,
    sourceDocumentId: run.source_document_id,
    validationStatus: run.validation_status,
    outputLang: run.output_lang,
    schemaVersion: run.schema_version,
    createdAt: run.created_at,
    errorSummary: safeErrorSummary(run.validation_status, run.error),
    items,
    summary: { itemCount: items.length, byType },
  };
}
