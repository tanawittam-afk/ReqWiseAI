/**
 * Reading source documents.
 *
 * Every query runs on a **user-scoped** client, so RLS is the filter that decides
 * which rows exist. Nothing here checks ownership, because nothing here could be
 * trusted to: a source in another tenant's project and a source that never existed
 * are the same `null`, by construction.
 *
 * Lock state is computed, never stored. `lockedSourceIds` asks the analysis_runs
 * table which revisions are cited and the answer is authoritative for exactly as long
 * as it takes to render — which is why the write path re-checks it in the database
 * rather than trusting what the page believed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fromMetadata } from "../contracts/source";
import type { SourceDetail, SourceSummary } from "./types";

const SUMMARY_COLUMNS =
  "id, title, kind, revision_number, supersedes_source_document_id, " +
  "created_at, updated_at, metadata, raw_text";

type SummaryRow = {
  id: string;
  title: string;
  kind: SourceSummary["kind"];
  revision_number: number;
  supersedes_source_document_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: unknown;
  raw_text: string;
};

type DetailRow = SummaryRow & {
  project_id: string;
  created_by: string;
};

/**
 * A display-only condensation: the first couple of non-empty lines, whitespace
 * collapsed, so a card stays one height. The stored text is never touched — this
 * string is thrown away after render and is not evidence.
 */
const PREVIEW_MAX = 160;

export function buildPreview(rawText: string): string {
  const joined = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .slice(0, 2)
    .join(" · ")
    .replace(/\s+/g, " ");

  return joined.length > PREVIEW_MAX ? `${joined.slice(0, PREVIEW_MAX - 1)}…` : joined;
}

/** The set of revisions an analysis run cites — i.e. the frozen ones. */
export async function lockedSourceIds(
  client: SupabaseClient,
  projectId: string,
): Promise<Set<string>> {
  const { data, error } = await client
    .from("analysis_runs")
    .select("source_document_id")
    .eq("project_id", projectId);

  if (error) throw new Error(`lock lookup failed: ${error.message}`);
  return new Set((data ?? []).map((row) => (row as { source_document_id: string }).source_document_id));
}

/** Everything both views show. The list adds a preview; the detail adds the text. */
function toCommon(row: SummaryRow, locked: boolean): Omit<SourceSummary, "preview"> {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    revisionNumber: row.revision_number,
    locked,
    supersedesId: row.supersedes_source_document_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceDate: fromMetadata(row.metadata).sourceDate,
    characterCount: row.raw_text.length,
  };
}

function toSummary(row: SummaryRow, locked: boolean): SourceSummary {
  return { ...toCommon(row, locked), preview: buildPreview(row.raw_text) };
}

/** Newest first: the thing just pasted is the thing being worked on. */
export async function listSources(
  client: SupabaseClient,
  projectId: string,
  options: { limit?: number } = {},
): Promise<SourceSummary[]> {
  let query = client
    .from("source_documents")
    .select(SUMMARY_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(`source list query failed: ${error.message}`);

  const locked = await lockedSourceIds(client, projectId);
  return ((data ?? []) as unknown as SummaryRow[]).map((row) => toSummary(row, locked.has(row.id)));
}

/**
 * Null means "not visible to you", which covers a wrong id, another tenant's id, and
 * an id from a different project than the route says. The `project_id` filter is what
 * makes the last of those true: a real source id under the wrong project is a miss.
 */
export async function getSource(
  client: SupabaseClient,
  projectId: string,
  sourceId: string,
): Promise<SourceDetail | null> {
  const { data, error } = await client
    .from("source_documents")
    .select(`${SUMMARY_COLUMNS}, project_id, created_by`)
    .eq("project_id", projectId)
    .eq("id", sourceId)
    .maybeSingle();

  if (error) throw new Error(`source query failed: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as DetailRow;

  const [analysisRunCount, successor] = await Promise.all([
    countRuns(client, sourceId),
    findSuccessor(client, projectId, sourceId),
  ]);

  // No preview on a detail view — it shows the whole document.
  return {
    ...toCommon(row, analysisRunCount > 0),
    projectId: row.project_id,
    rawText: row.raw_text,
    metadata: fromMetadata(row.metadata),
    createdBy: row.created_by,
    supersededById: successor?.id ?? null,
    supersededByRevision: successor?.revision_number ?? null,
    analysisRunCount,
  };
}

async function countRuns(client: SupabaseClient, sourceId: string): Promise<number> {
  const { count, error } = await client
    .from("analysis_runs")
    .select("id", { count: "exact", head: true })
    .eq("source_document_id", sourceId);

  if (error) throw new Error(`analysis run count failed: ${error.message}`);
  return count ?? 0;
}

async function findSuccessor(
  client: SupabaseClient,
  projectId: string,
  sourceId: string,
): Promise<{ id: string; revision_number: number } | null> {
  const { data, error } = await client
    .from("source_documents")
    .select("id, revision_number")
    .eq("project_id", projectId)
    .eq("supersedes_source_document_id", sourceId)
    .maybeSingle();

  if (error) throw new Error(`revision lookup failed: ${error.message}`);
  return (data as { id: string; revision_number: number } | null) ?? null;
}

/** Header/overview number. One head-count, no rows transferred. */
export async function countSources(
  client: SupabaseClient,
  projectId: string,
): Promise<number> {
  const { count, error } = await client
    .from("source_documents")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (error) throw new Error(`source count failed: ${error.message}`);
  return count ?? 0;
}
