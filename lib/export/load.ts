/**
 * Loading everything one export needs, in the reader's own security context.
 *
 * The only module under `lib/export/` that touches a database — `build`, `readiness`,
 * `markdown`, `json`, `csv` and `print` are pure, exactly as ARCHITECTURE.md §B.8
 * requires. The same seam `lib/traceability/` uses: `queries.ts` reads, everything
 * beside it computes.
 *
 * Every query runs on a **user-scoped** client, so RLS decides what exists. A project
 * belonging to another tenant and a project that never existed are the same `null`, and
 * no message anywhere distinguishes them. There is no service-role path here, and there
 * must never be one: an export is the single place where a whole project leaves the
 * system in one piece, which makes it the last place to weaken the boundary.
 *
 * Export **reads**. Nothing in this file writes, upserts, or records that an export
 * happened; that is why the feature needs no migration.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemType } from "../contracts/item-types.ts";
import { isLegacyRelationType, type RelationType } from "../contracts/relations.ts";
import type { SourceKind } from "../contracts/source.ts";
import { fromMetadata } from "../contracts/source.ts";
import { activityLabel } from "../review/history.ts";
import type {
  ExportActivityInput,
  ExportInput,
  ExportItemInput,
  ExportReferenceInput,
  ExportRelationInput,
  ExportSourceInput,
  ExportVersionInput,
} from "./types.ts";

const ITEM_COLUMNS =
  "id, display_id, item_type, title, description, priority, status, evidence_class, " +
  "origin, confidence, rationale, attributes, version_no, created_at, workflow_state, " +
  "resolution_text, resolved_at, follow_up_on, analysis_run_id";

/**
 * `null` means "not visible to you". The caller renders the ordinary not-found page.
 *
 * Review activities are **always** loaded: every requirement carries a review summary,
 * and a summary that read "0 activities" because the caller did not ask for history
 * would be a document stating something false. Version *snapshots* are the optional
 * read — each one holds a full copy of the item's text, and only the version-summary
 * section needs them, so the common export does not pay for the rare one.
 */
export async function loadExportInput(
  client: SupabaseClient,
  projectId: string,
  options: { includeVersionHistory?: boolean } = {},
): Promise<ExportInput | null> {
  const { data: projectRow, error: projectError } = await client
    .from("projects")
    .select(
      "id, name, description, business_objective, known_stakeholders, output_lang, " +
        "status, archive_reason, created_at, domain_profiles (key, name)",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw new Error(`project query failed: ${projectError.message}`);
  if (!projectRow) return null;

  type DomainRow = { key: string; name: string } | Array<{ key: string; name: string }> | null;
  const project = projectRow as unknown as {
    id: string;
    name: string;
    description: string | null;
    business_objective: string | null;
    known_stakeholders: string[] | null;
    output_lang: string;
    status: "active" | "archived";
    archive_reason: string | null;
    created_at: string;
    domain_profiles: DomainRow;
  };

  const domainRow = Array.isArray(project.domain_profiles)
    ? project.domain_profiles[0]
    : project.domain_profiles;

  const [sourceResult, itemResult, relationResult, runResult] = await Promise.all([
    client
      .from("source_documents")
      .select("id, title, kind, revision_number, metadata, created_at, raw_text")
      .eq("project_id", projectId)
      .order("revision_number", { ascending: true }),
    client
      .from("analysis_items")
      .select(ITEM_COLUMNS)
      .eq("project_id", projectId)
      .is("deleted_at", null),
    client
      .from("item_relations")
      .select("from_item_id, to_item_id, relation_type")
      .eq("project_id", projectId),
    client
      .from("analysis_runs")
      .select("id, source_document_id, output_lang, created_at")
      .eq("project_id", projectId),
  ]);

  if (sourceResult.error) throw new Error(`source query failed: ${sourceResult.error.message}`);
  if (itemResult.error) throw new Error(`analysis item query failed: ${itemResult.error.message}`);
  if (relationResult.error) throw new Error(`item relation query failed: ${relationResult.error.message}`);
  if (runResult.error) throw new Error(`analysis run query failed: ${runResult.error.message}`);

  const runRows = (runResult.data ?? []) as Array<{
    id: string;
    source_document_id: string;
    output_lang: string;
    created_at: string;
  }>;
  // Lock state is derived, exactly as `lib/sources/queries.ts` derives it: a revision is
  // frozen because an analysis cites it, and no column records that.
  const citedRevisions = new Set(runRows.map((row) => row.source_document_id));

  // The export's "Output language" line (Phase 2, Slice 7 — a latent bug fixed here,
  // not just a new feature): `projects.output_lang` is now editable and, once a project
  // is `match_source`, only ever the *last resolved* value — it can silently drift from
  // what an OLDER run actually contains. The export must describe what was actually
  // written, so it uses the **latest run's own** `analysis_runs.output_lang` (a frozen,
  // historical fact) — falling back to the project's current setting only when no run
  // exists yet to have an opinion.
  const latestRun = runRows.reduce<(typeof runRows)[number] | null>(
    (latest, row) => (!latest || row.created_at > latest.created_at ? row : latest),
    null,
  );

  const sources: ExportSourceInput[] = (
    (sourceResult.data ?? []) as unknown as Array<{
      id: string;
      title: string;
      kind: SourceKind;
      revision_number: number;
      metadata: unknown;
      created_at: string;
      raw_text: string;
    }>
  ).map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    revisionNumber: row.revision_number,
    locked: citedRevisions.has(row.id),
    sourceDate: fromMetadata(row.metadata).sourceDate,
    createdAt: row.created_at,
    rawText: row.raw_text,
  }));

  const items: ExportItemInput[] = (
    (itemResult.data ?? []) as unknown as Array<{
      id: string;
      display_id: string;
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
      created_at: string;
      workflow_state: string | null;
      resolution_text: string | null;
      resolved_at: string | null;
      follow_up_on: string | null;
      analysis_run_id: string;
    }>
  ).map((row) => ({
    id: row.id,
    displayId: row.display_id,
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
    createdAt: row.created_at,
    workflowState: row.workflow_state ?? null,
    resolutionText: row.resolution_text ?? null,
    resolvedAt: row.resolved_at ?? null,
    followUpOn: row.follow_up_on ?? null,
    analysisRunId: row.analysis_run_id,
  }));

  const itemIds = items.map((item) => item.id);
  const known = new Set(itemIds);

  const relations: ExportRelationInput[] = (
    (relationResult.data ?? []) as Array<{
      from_item_id: string;
      to_item_id: string;
      relation_type: string;
    }>
  )
    // An edge whose endpoint is soft-deleted has nothing to say in a document, and a
    // relation row from outside this project cannot appear here at all: the query is
    // filtered on `project_id` and the database refuses cross-project edges outright
    // (DATA-MODEL §C.13). Dropping unresolvable ends keeps "a listed relation names two
    // items the reader can find".
    .filter((row) => known.has(row.from_item_id) && known.has(row.to_item_id))
    .map((row) => ({
      fromItemId: row.from_item_id,
      toItemId: row.to_item_id,
      type: row.relation_type as RelationType,
      legacy: isLegacyRelationType(row.relation_type),
    }));

  const references: ExportReferenceInput[] = itemIds.length
    ? await loadReferences(client, itemIds)
    : [];

  let activities: ExportActivityInput[] = [];
  let versions: ExportVersionInput[] = [];
  if (itemIds.length > 0) {
    [activities, versions] = await Promise.all([
      loadActivities(client, projectId, itemIds),
      options.includeVersionHistory
        ? loadVersions(client, projectId, itemIds)
        : Promise.resolve([]),
    ]);
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      businessObjective: project.business_objective,
      knownStakeholders: project.known_stakeholders ?? [],
      domain: domainRow ? { key: domainRow.key, name: domainRow.name } : null,
      outputLang: latestRun?.output_lang ?? project.output_lang,
      status: project.status,
      archiveReason: project.archive_reason,
      createdAt: project.created_at,
      sourceCount: sources.length,
      analysisRunCount: runRows.length,
    },
    sources,
    items,
    references,
    relations,
    activities,
    versions,
  };
}

async function loadReferences(
  client: SupabaseClient,
  itemIds: string[],
): Promise<ExportReferenceInput[]> {
  const { data, error } = await client
    .from("item_source_references")
    .select("item_id, source_document_id, excerpt, start_offset, end_offset, offset_verified")
    .in("item_id", itemIds);

  if (error) throw new Error(`source reference query failed: ${error.message}`);

  return ((data ?? []) as Array<{
    item_id: string;
    source_document_id: string;
    excerpt: string;
    start_offset: number | null;
    end_offset: number | null;
    offset_verified: boolean;
  }>).map((row) => ({
    itemId: row.item_id,
    sourceDocumentId: row.source_document_id,
    excerpt: row.excerpt,
    startOffset: row.start_offset,
    endOffset: row.end_offset,
    offsetVerified: row.offset_verified,
  }));
}

/**
 * The review timeline with the actor removed **here**, not later.
 *
 * `actor_id` is an auth user id. The earliest layer that can drop it is the right one:
 * a field that never enters the working set cannot be exported by a later mistake, and
 * "who approved this" is not a fact a handoff document needs — "it was approved, on this
 * date" is.
 */
async function loadActivities(
  client: SupabaseClient,
  projectId: string,
  itemIds: string[],
): Promise<ExportActivityInput[]> {
  const { data, error } = await client
    .from("review_activities")
    .select(
      "item_id, activity_type, from_status, to_status, from_workflow_state, " +
        "to_workflow_state, comment, created_at",
    )
    .eq("project_id", projectId)
    .in("item_id", itemIds);

  if (error) throw new Error(`review activity query failed: ${error.message}`);

  return ((data ?? []) as unknown as Array<{
    item_id: string;
    activity_type: string;
    from_status: string | null;
    to_status: string | null;
    from_workflow_state: string | null;
    to_workflow_state: string | null;
    comment: string | null;
    created_at: string;
  }>).map((row) => ({
    itemId: row.item_id,
    // The same sentence the review timeline shows in the app — one label function, so a
    // document and the screen never describe the same activity differently.
    label: activityLabel({
      activityType: row.activity_type,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      fromWorkflowState: row.from_workflow_state,
      toWorkflowState: row.to_workflow_state,
    }),
    comment: row.comment,
    createdAt: row.created_at,
  }));
}

async function loadVersions(
  client: SupabaseClient,
  projectId: string,
  itemIds: string[],
): Promise<ExportVersionInput[]> {
  const { data, error } = await client
    .from("item_versions")
    .select("item_id, version_no, change_reason, created_at")
    .eq("project_id", projectId)
    .in("item_id", itemIds);

  if (error) throw new Error(`item version query failed: ${error.message}`);

  return ((data ?? []) as Array<{
    item_id: string;
    version_no: number;
    change_reason: string | null;
    created_at: string;
  }>).map((row) => ({
    itemId: row.item_id,
    versionNo: row.version_no,
    changeReason: row.change_reason,
    createdAt: row.created_at,
  }));
}
