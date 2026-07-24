/**
 * The gate every mutating project action passes through.
 *
 * Slice 2 shipped archiving with the "you cannot write to an archived project" rule
 * enforced by hiding buttons. That is a UI courtesy, not a guarantee: a form POST
 * still reached the insert. This module is the server-side half, and the database
 * triggers in 20260724000008 are the third — a rule worth having is worth stating in
 * all three places, because each one fails differently.
 *
 * It is deliberately generic: `assertProjectIsActive` knows nothing about sources.
 * Analysis runs, requirement edits and review actions call the same function.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectGate =
  | { ok: true; projectId: string }
  /** The project does not exist, or belongs to another tenant — the same answer. */
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "archived" };

/**
 * Reads the project through the **caller's own client**, so RLS decides visibility
 * before status is even considered. A project in another organization is `not_found`
 * here for the same reason it is `not_found` in the loaders: confirming it exists
 * would leak the fact that it exists.
 */
export async function assertProjectIsActive(
  client: SupabaseClient,
  projectId: string,
): Promise<ProjectGate> {
  const { data, error } = await client
    .from("projects")
    .select("id, status")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(`project gate query failed: ${error.message}`);
  if (!data) return { ok: false, reason: "not_found" };
  if (data.status !== "active") return { ok: false, reason: "archived" };

  return { ok: true, projectId: data.id };
}

/** One sentence per refusal, safe to render. Nothing here names a table or a policy. */
export const GATE_MESSAGES: Record<"not_found" | "archived", string> = {
  not_found: "This project is not available.",
  archived: "This project is archived and read-only. Restore it to make changes.",
};
