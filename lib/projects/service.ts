/**
 * Writing projects — the application service from ARCHITECTURE §B.1.
 *
 * Four facts are decided here and are never accepted from a request:
 *   organization_id  — resolved from the caller's membership
 *   created_by       — the session user
 *   status           — always 'active' at birth (a database default, not a literal)
 *   archived_by      — taken from auth.uid() inside archive_project()
 *
 * Everything runs on a **user-scoped** client. The service-role client does not
 * appear in this file and must not: RLS is the security boundary for the whole
 * request path, and a service-role insert here would silently disable it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createProjectInputSchema,
  type ArchiveProjectInput,
  type CreateProjectInput,
  type SetOutputLanguageInput,
} from "../contracts/project";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Postgres errors are for the log, not the screen — they carry table names, policy
 * names and constraint text. The user gets a sentence they can act on.
 */
function failure(context: string, detail: string, message: string): ServiceResult<never> {
  console.error(`[projects] ${context}: ${detail}`);
  return { ok: false, error: message };
}

export async function createProject(
  client: SupabaseClient,
  rawInput: CreateProjectInput,
): Promise<ServiceResult<{ projectId: string }>> {
  // Parsed again on the server even though the action parsed it: this function is a
  // boundary in its own right, and a future caller may not be the form.
  const parsed = createProjectInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Some fields need attention." };
  }
  const input = parsed.data;

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };

  const organizationId = await resolvePersonalOrganization(client);
  if (!organizationId) {
    return failure(
      "workspace",
      `no personal organization for user ${user.id}`,
      "Your personal workspace could not be found.",
    );
  }

  // The profile must be one this user can actually read. Checking it here turns an
  // opaque foreign-key error into an honest "that domain is not available".
  const { data: profile, error: profileError } = await client
    .from("domain_profiles")
    .select("id")
    .eq("id", input.domainProfileId)
    .eq("is_active", true)
    .maybeSingle();

  if (profileError) {
    return failure("domain profile", profileError.message, "Could not verify the business domain.");
  }
  if (!profile) {
    return {
      ok: false,
      error: "That business domain is not available.",
      fieldErrors: { domainProfileId: "Choose an available business domain" },
    };
  }

  // `output_lang` (the column) stays binary; `"match_source"` is a *preference*
  // (Phase 2, Slice 6/7) split into `output_lang_mode` here. The `output_lang` value
  // written for a match_source project is a placeholder — `output_lang` is only ever
  // the *last resolved* language once `output_lang_mode` is `'match_source'`, and no
  // run has resolved anything yet at creation time.
  const outputLang = input.outputLang === "match_source" ? "th" : input.outputLang;
  const outputLangMode = input.outputLang === "match_source" ? "match_source" : "fixed";

  const { data, error } = await client
    .from("projects")
    .insert({
      organization_id: organizationId,
      domain_profile_id: input.domainProfileId,
      name: input.name,
      description: input.description,
      business_objective: input.businessObjective,
      known_stakeholders: input.knownStakeholders,
      output_lang: outputLang,
      output_lang_mode: outputLangMode,
      created_by: user.id,
      // status is omitted on purpose — the column default is the only thing that
      // may set it, so no code path can create a project in any other state.
    })
    .select("id")
    .single();

  if (error) {
    return failure("create", error.message, "The project could not be created. Try again.");
  }
  return { ok: true, data: { projectId: data.id } };
}

export async function archiveProject(
  client: SupabaseClient,
  input: ArchiveProjectInput,
): Promise<ServiceResult<null>> {
  const { error } = await client.rpc("archive_project", {
    p_project: input.projectId,
    p_reason: input.reason,
  });

  if (error) {
    return failure("archive", error.message, "The project could not be archived.");
  }
  return { ok: true, data: null };
}

export async function restoreProject(
  client: SupabaseClient,
  projectId: string,
): Promise<ServiceResult<null>> {
  const { error } = await client.rpc("restore_project", { p_project: projectId });

  if (error) {
    return failure("restore", error.message, "The project could not be restored.");
  }
  return { ok: true, data: null };
}

/**
 * Change a project's output-language preference after creation (Phase 2, Slice 7) —
 * the first, and so far only, project field with a real post-creation edit path. One
 * RPC call, `set_project_output_language()`, `security invoker`: RLS's own
 * `is_org_member` update policy on `projects` is the whole access check, and an
 * archived project is refused for free by `guard_project_update()`'s existing
 * "read-only" rule — no privilege escape needed here, same reasoning as
 * `archive_project()`/`restore_project()` above.
 */
export async function setOutputLanguage(
  client: SupabaseClient,
  input: SetOutputLanguageInput,
): Promise<ServiceResult<null>> {
  const { error } = await client.rpc("set_project_output_language", {
    p_project: input.projectId,
    p_mode: input.outputLang,
  });

  if (error) {
    if (/archived/i.test(error.message)) {
      return { ok: false, error: "This project is archived and read-only. Restore it to make changes." };
    }
    if (/not found|not visible/i.test(error.message)) {
      return { ok: false, error: "This project is unavailable." };
    }
    return failure("set-output-language", error.message, "The output language could not be changed.");
  }
  return { ok: true, data: null };
}

/**
 * The workspace a new project belongs to.
 *
 * Read through the caller's own client, so it can only ever return an organization
 * this user is a member of — the query cannot be tricked into naming someone else's.
 * Organization switching is out of scope (ARCHITECTURE §A.5); the personal workspace
 * is the answer until it exists.
 */
export async function resolvePersonalOrganization(
  client: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await client
    .from("organization_members")
    .select("organization_id, organizations!inner (is_personal)")
    .eq("organizations.is_personal", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { organization_id: string }).organization_id;
}
