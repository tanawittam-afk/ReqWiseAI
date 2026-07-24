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

  const { data, error } = await client
    .from("projects")
    .insert({
      organization_id: organizationId,
      domain_profile_id: input.domainProfileId,
      name: input.name,
      description: input.description,
      business_objective: input.businessObjective,
      known_stakeholders: input.knownStakeholders,
      output_lang: input.outputLang,
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
