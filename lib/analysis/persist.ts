/**
 * Persistence: hands a `RunAnalysisResult` to `persist_analysis_result()`.
 *
 * Everything here runs on a **user-scoped** client — there is no service-role client
 * in this file. The RPC is SECURITY DEFINER and does its own membership, archive and
 * source-ownership checks from `auth.uid()`; this module's job is only to shape the
 * payload and translate the result, never to decide who may write.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisInput } from "../contracts/analysis-input";
import { PROVIDER_SCHEMA_VERSION } from "../contracts/provider-output";
import type { NormalizedItem, NormalizedRelation } from "../contracts/normalized";
import type { RunAnalysisResult } from "./run-analysis";

export type PersistOutcome =
  | { ok: true; runId: string; validationStatus: "valid" | "invalid" | "provider_error"; duplicate: boolean }
  | { ok: false; error: string };

type PersistSuccessRow = {
  run_id: string;
  validation_status: "valid" | "invalid" | "provider_error";
  duplicate: boolean;
};

const GENERIC_PERSISTENCE_FAILURE = "The analysis could not be saved. Try again.";

function parsePersistSuccessRow(data: unknown): PersistSuccessRow | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;

  const row = data as Record<string, unknown>;
  if (typeof row.run_id !== "string" || row.run_id.trim() === "") return null;
  if (
    row.validation_status !== "valid" &&
    row.validation_status !== "invalid" &&
    row.validation_status !== "provider_error"
  ) {
    return null;
  }
  if (typeof row.duplicate !== "boolean") return null;

  return {
    run_id: row.run_id,
    validation_status: row.validation_status,
    duplicate: row.duplicate,
  };
}

/** One element of the RPC's `p_items` array. Field names match the SQL side exactly. */
function toItemPayload(item: NormalizedItem) {
  return {
    local_key: item.id,
    provider_key: item.providerKey,
    item_type: item.type,
    title: item.title,
    description: item.description,
    priority: item.priority,
    evidence_class: item.evidenceClass,
    origin: item.origin,
    confidence: item.confidence,
    rationale: item.rationale ?? null,
    attributes: item.attributes ?? null,
    source_references: item.sourceReferences.map((ref) => ({
      excerpt: ref.excerpt,
      start_offset: ref.startOffset ?? null,
      end_offset: ref.endOffset ?? null,
      evidence_strength: ref.evidenceStrength ?? null,
      offset_verified: ref.offsetVerified,
    })),
  };
}

/** One element of the RPC's `p_relations` array. Field names match the SQL side exactly. */
function toRelationPayload(relation: NormalizedRelation) {
  return {
    from_local_key: relation.fromItemId,
    to_local_key: relation.toItemId,
    relation_type: relation.type,
  };
}

/** Postgres errors are for the log; the caller gets a sentence that names no policy. */
function translate(detail: string): string {
  if (/archived/i.test(detail)) return "This project is archived and read-only.";
  if (/not found or not visible|source not found/i.test(detail)) {
    return "This project or source is not available.";
  }
  if (/authentication required/i.test(detail)) return "Your session has expired. Sign in again.";
  // The key was already spent on a different analysis. Reloading mints a new one,
  // which is the honest fix — retrying this exact request never will be.
  if (/already been used for a different analysis/i.test(detail)) {
    return "This request was already used for a different analysis. Reload the page and try again.";
  }
  // A relation the database refused. The run rolled back whole — no partial write —
  // so the honest thing to report is that the analysis was rejected, not that some of
  // it was kept. See docs/architecture/DATA-MODEL.md §C.13.
  if (/relation/i.test(detail)) {
    return "The analysis produced an invalid traceability link and was not saved. Try again.";
  }
  return GENERIC_PERSISTENCE_FAILURE;
}

export async function persistAnalysisResult(
  client: SupabaseClient,
  projectId: string,
  sourceId: string,
  requestKey: string,
  input: AnalysisInput,
  result: RunAnalysisResult,
): Promise<PersistOutcome> {
  const common = {
    p_project: projectId,
    p_source: sourceId,
    p_request_key: requestKey,
    p_provider: result.metadata.provider,
    p_model: result.metadata.model,
    p_prompt_version: result.metadata.promptVersion,
    p_schema_version: PROVIDER_SCHEMA_VERSION,
    p_output_lang: input.outputLang,
  };

  let rpcArgs: Record<string, unknown>;

  if (result.status === "valid") {
    rpcArgs = {
      ...common,
      p_validation_status: "valid",
      p_raw_output: result.raw,
      p_validated_output: result.analysis,
      p_error: null,
      p_items: result.analysis.items.map(toItemPayload),
      p_relations: result.analysis.relations.map(toRelationPayload),
    };
  } else if (result.status === "invalid") {
    rpcArgs = {
      ...common,
      p_validation_status: "invalid",
      p_raw_output: result.raw,
      p_validated_output: null,
      p_error: { category: "validation_failed", issues: result.issues },
      p_items: [],
      p_relations: [],
    };
  } else {
    rpcArgs = {
      ...common,
      p_validation_status: "provider_error",
      p_raw_output: null,
      p_validated_output: null,
      p_error: {
        category: result.error.category,
        message: result.error.message,
      },
      p_items: [],
      p_relations: [],
    };
  }

  const { data, error } = await client.rpc("persist_analysis_result", rpcArgs);
  if (error) {
    console.error(`[analysis] persist failed: ${error.message}`);
    return { ok: false, error: translate(error.message) };
  }

  const row = parsePersistSuccessRow(data);
  if (!row) return { ok: false, error: GENERIC_PERSISTENCE_FAILURE };

  return { ok: true, runId: row.run_id, validationStatus: row.validation_status, duplicate: row.duplicate };
}
