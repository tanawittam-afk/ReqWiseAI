/**
 * Reading projects.
 *
 * Every query here runs through a **user-scoped** client, so RLS is the filter that
 * decides which rows exist at all. Nothing in this file checks ownership, because
 * nothing in this file could be trusted to: a missing project and another user's
 * project are indistinguishable by construction, which is exactly what stops the UI
 * from confirming that someone else's project exists.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectFilter } from "../contracts/project";
import type { ProjectCounts, ProjectDetail, ProjectSummary } from "./types";

// The embedded `(count)` aggregates give each card its source and requirement totals
// in the same round trip — the alternative is one count query per project.
const SUMMARY_COLUMNS =
  "id, name, status, output_lang, created_at, updated_at, archived_at, " +
  "domain_profiles (key, name), source_documents (count), analysis_items (count)";

const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, description, business_objective, known_stakeholders, archive_reason`;

type DomainRow = { key: string; name: string } | { key: string; name: string }[] | null;

type CountRow = Array<{ count: number }> | { count: number } | null;

type SummaryRow = {
  id: string;
  name: string;
  status: ProjectSummary["status"];
  output_lang: ProjectSummary["outputLang"];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  domain_profiles: DomainRow;
  source_documents?: CountRow;
  analysis_items?: CountRow;
};

type DetailRow = SummaryRow & {
  description: string | null;
  business_objective: string | null;
  known_stakeholders: string[] | null;
  archive_reason: string | null;
};

/** PostgREST returns an embedded to-one as an object or a one-element array. */
function toDomain(value: DomainRow): ProjectSummary["domain"] {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  return row ? { key: row.key, name: row.name } : null;
}

/** An embedded aggregate arrives as `[{count}]`, or is absent on a detail select. */
function toCount(value: CountRow | undefined): number {
  if (!value) return 0;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.count ?? 0;
}

function toSummary(row: SummaryRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    outputLang: row.output_lang,
    domain: toDomain(row.domain_profiles),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    sourceDocumentCount: toCount(row.source_documents),
    analysisItemCount: toCount(row.analysis_items),
  };
}

export async function listProjects(
  client: SupabaseClient,
  filter: ProjectFilter,
): Promise<ProjectSummary[]> {
  let query = client.from("projects").select(SUMMARY_COLUMNS);
  if (filter !== "all") query = query.eq("status", filter);

  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw new Error(`project list query failed: ${error.message}`);

  return ((data ?? []) as unknown as SummaryRow[]).map(toSummary);
}

/** Null means "not visible to you" — which covers both wrong id and wrong tenant. */
export async function getProject(
  client: SupabaseClient,
  projectId: string,
): Promise<ProjectDetail | null> {
  const { data, error } = await client
    .from("projects")
    .select(DETAIL_COLUMNS)
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(`project query failed: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as DetailRow;
  // Source and item totals ride along with the row; runs are the one number the
  // summary select does not carry.
  const analysisRunCount = await countFor(client, "analysis_runs", projectId);

  return {
    ...toSummary(row),
    description: row.description,
    businessObjective: row.business_objective,
    knownStakeholders: row.known_stakeholders ?? [],
    archiveReason: row.archive_reason,
    analysisRunCount,
  };
}

async function countFor(
  client: SupabaseClient,
  table: string,
  projectId: string,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

/** Header summary. Two head-counts, no rows transferred. */
export async function countProjects(client: SupabaseClient): Promise<ProjectCounts> {
  const [active, archived] = await Promise.all([
    countByStatus(client, "active"),
    countByStatus(client, "archived"),
  ]);
  return { active, archived };
}

async function countByStatus(client: SupabaseClient, status: string): Promise<number> {
  const { count, error } = await client
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("status", status);

  if (error) throw new Error(`project count failed: ${error.message}`);
  return count ?? 0;
}
