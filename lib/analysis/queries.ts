/**
 * Reading analysis runs and their items.
 *
 * Every query runs on a **user-scoped** client, so RLS decides visibility — a run
 * belonging to another tenant's project and a run that never existed are both `null`,
 * by construction, exactly like `lib/sources/queries.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemType } from "../contracts/item-types";
import { safeProviderMessage, type ProviderErrorCategory } from "../providers/errors";
import type { ProviderKey } from "../providers/types";
import { getChangeRequestsForItems, type ChangeRequestView } from "../review/change-requests.ts";

export type AnalysisRunSummary = {
  id: string;
  sourceDocumentId: string;
  provider: ProviderKey;
  model: string | null;
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
  /**
   * The version the reader is looking at. Carried into the edit form and sent back as
   * `expectedVersion`: an edit is only safe to apply to the state it was composed
   * against (docs/architecture/DATA-MODEL.md §C.5).
   */
  versionNo: number;
  updatedAt: string;
  /**
   * The question / quality workflow. `null` for the twelve reviewable requirement
   * types, which have no workflow of this kind — a CHECK constraint enforces that,
   * so `null` here means "not applicable", never "not loaded".
   */
  workflowState: string | null;
  resolutionText: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  followUpOn: string | null;
  sourceReferences: AnalysisSourceReferenceView[];
  relatedDisplayIds: string[];
  /**
   * Every change request (any status) proposed against this item. Empty for the vast
   * majority of items — only ever populated for a reviewable type once it has left
   * `draft`, since `open_change_request()` refuses anything not already terminal.
   */
  changeRequests: ChangeRequestView[];
  /**
   * For an `open_question` only: the requirement(s) it `raises_question` against,
   * reversed. Zero means no recorded link (a change request against this answer needs
   * a manual target); more than one means the UI must not guess which one. Empty for
   * every other item type.
   */
  changeRequestCandidateItemIds: string[];
};

export type AnalysisRunDetail = {
  id: string;
  projectId: string;
  sourceDocumentId: string;
  provider: ProviderKey;
  model: string | null;
  promptVersion: string | null;
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

function parseStoredProvider(value: unknown): ProviderKey {
  switch (value) {
    case "mock":
    case "gemini":
      return value;
    default:
      throw new Error("analysis run data has an unsupported provider");
  }
}

function parseStoredProviderErrorCategory(value: unknown): ProviderErrorCategory {
  switch (value) {
    case "unavailable":
    case "authentication_failed":
    case "rate_limited":
    case "timeout":
    case "safety_refusal":
    case "unknown":
      return value;
    default:
      return "unknown";
  }
}

/** Newest first — the run just created is the one worth seeing. */
export async function listAnalysisRuns(
  client: SupabaseClient,
  projectId: string,
  sourceId: string,
): Promise<AnalysisRunSummary[]> {
  const { data, error } = await client
    .from("analysis_runs")
    .select("id, source_document_id, provider, model, validation_status, created_at, analysis_items(count)")
    .eq("project_id", projectId)
    .eq("source_document_id", sourceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`analysis run list query failed: ${error.message}`);

  return ((data ?? []) as unknown as Array<{
    id: string;
    source_document_id: string;
    provider: unknown;
    model: string | null;
    validation_status: AnalysisRunSummary["validationStatus"];
    created_at: string;
    analysis_items: Array<{ count: number }> | { count: number } | null;
  }>).map((row) => {
    const countRow = Array.isArray(row.analysis_items) ? row.analysis_items[0] : row.analysis_items;
    return {
      id: row.id,
      sourceDocumentId: row.source_document_id,
      provider: parseStoredProvider(row.provider),
      model: row.model ?? null,
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
    const category = parseStoredProviderErrorCategory(record.category);
    return {
      category,
      message: safeProviderMessage(category),
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
    .select(
      "id, project_id, source_document_id, provider, model, prompt_version, " +
        "validation_status, output_lang, schema_version, created_at, error",
    )
    .eq("project_id", projectId)
    .eq("id", runId)
    .maybeSingle();

  if (runError) throw new Error(`analysis run query failed: ${runError.message}`);
  if (!run) return null;

  const storedRun = run as unknown as {
    id: string;
    project_id: string;
    source_document_id: string;
    provider: unknown;
    model: string | null;
    prompt_version: string | null;
    validation_status: AnalysisRunDetail["validationStatus"];
    output_lang: string;
    schema_version: string;
    created_at: string;
    error: unknown;
  };

  const { data: itemRows, error: itemError } = await client
    .from("analysis_items")
    .select(
      "id, display_id, provider_key, item_type, title, description, priority, status, " +
        "evidence_class, origin, confidence, rationale, attributes, version_no, updated_at, " +
        "workflow_state, resolution_text, resolved_at, resolved_by, follow_up_on",
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
    version_no: number;
    updated_at: string;
    workflow_state: string | null;
    resolution_text: string | null;
    resolved_at: string | null;
    resolved_by: string | null;
    follow_up_on: string | null;
  };
  const items_ = ((itemRows ?? []) as unknown) as ItemRow[];

  const itemIds = items_.map((row) => row.id);
  const displayIdById = new Map(items_.map((row) => [row.id, row.display_id]));

  const [refRows, relRows, changeRequestsByItem] = await Promise.all([
    itemIds.length
      ? client
          .from("item_source_references")
          .select("item_id, excerpt, start_offset, end_offset, evidence_strength, offset_verified")
          .in("item_id", itemIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? client.from("item_relations").select("from_item_id, to_item_id").in("from_item_id", itemIds)
      : Promise.resolve({ data: [], error: null }),
    getChangeRequestsForItems(client, storedRun.project_id, itemIds),
  ]);

  if (refRows.error) throw new Error(`source reference query failed: ${refRows.error.message}`);
  if (relRows.error) throw new Error(`item relation query failed: ${relRows.error.message}`);

  const { data: raisesQuestionRows, error: raisesQuestionError } = itemIds.length
    ? await client
        .from("item_relations")
        .select("from_item_id, to_item_id")
        .eq("relation_type", "raises_question")
        .in("to_item_id", itemIds)
    : { data: [], error: null };
  if (raisesQuestionError) {
    throw new Error(`raises_question relation query failed: ${raisesQuestionError.message}`);
  }
  const candidatesByQuestion = new Map<string, string[]>();
  for (const row of (raisesQuestionRows ?? []) as Array<{ from_item_id: string; to_item_id: string }>) {
    const list = candidatesByQuestion.get(row.to_item_id) ?? [];
    list.push(row.from_item_id);
    candidatesByQuestion.set(row.to_item_id, list);
  }

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
    versionNo: row.version_no,
    updatedAt: row.updated_at,
    workflowState: row.workflow_state ?? null,
    resolutionText: row.resolution_text ?? null,
    resolvedAt: row.resolved_at ?? null,
    resolvedBy: row.resolved_by ?? null,
    followUpOn: row.follow_up_on ?? null,
    sourceReferences: refsByItem.get(row.id) ?? [],
    relatedDisplayIds: relatedByItem.get(row.id) ?? [],
    changeRequests: changeRequestsByItem[row.id] ?? [],
    changeRequestCandidateItemIds: candidatesByQuestion.get(row.id) ?? [],
  }));

  const byType: Partial<Record<ItemType, number>> = {};
  for (const item of items) byType[item.type] = (byType[item.type] ?? 0) + 1;

  return {
    id: storedRun.id,
    projectId: storedRun.project_id,
    sourceDocumentId: storedRun.source_document_id,
    provider: parseStoredProvider(storedRun.provider),
    model: storedRun.model ?? null,
    promptVersion: storedRun.prompt_version ?? null,
    validationStatus: storedRun.validation_status,
    outputLang: storedRun.output_lang,
    schemaVersion: storedRun.schema_version,
    createdAt: storedRun.created_at,
    errorSummary: safeErrorSummary(storedRun.validation_status, storedRun.error),
    items,
    summary: { itemCount: items.length, byType },
  };
}
