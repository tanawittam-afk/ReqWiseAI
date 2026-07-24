/**
 * Reads a domain profile from the database and validates it.
 *
 * The running app never imports `lib/domain/profiles/*.ts` — those are the *authoring*
 * source, compiled into `supabase/seed.sql`. At runtime a project points at a
 * `domain_profiles` row (`projects.domain_profile_id`), and this is how that row
 * becomes a `DomainProfile` an analysis can be run over.
 *
 * `content` is `jsonb`: the database will hand back whatever was seeded, including
 * an empty object if a profile was never regenerated. Parsing is not optional.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DomainProfile } from "./types";
// Explicit .ts extension so scripts/verify-db.mts can exercise this loader under
// Node's native type stripping. See lib/domain/profiles/index.ts.
import { domainProfileSchema } from "./profile-schema.ts";

type DomainProfileRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  content: unknown;
};

const COLUMNS = "id, key, name, description, content";

function toProfile(row: DomainProfileRow): DomainProfile {
  const content = (row.content ?? {}) as Record<string, unknown>;
  const parsed = domainProfileSchema.safeParse({
    key: row.key,
    name: row.name,
    description: row.description,
    ...content,
  });

  if (!parsed.success) {
    throw new Error(
      `domain profile '${row.key}' is invalid in the database — reseed it with ` +
        `\`npm run seed:profiles\` then apply supabase/seed.sql. ` +
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }

  return parsed.data;
}

/** By stable key, e.g. `booking_smart_space`. */
export async function loadDomainProfileByKey(
  client: SupabaseClient,
  key: string,
): Promise<DomainProfile> {
  const { data, error } = await client
    .from("domain_profiles")
    .select(COLUMNS)
    .eq("key", key)
    .single<DomainProfileRow>();

  if (error) throw new Error(`could not load domain profile '${key}': ${error.message}`);
  return toProfile(data);
}

/** By primary key — what `projects.domain_profile_id` holds. */
export async function loadDomainProfileById(
  client: SupabaseClient,
  id: string,
): Promise<DomainProfile> {
  const { data, error } = await client
    .from("domain_profiles")
    .select(COLUMNS)
    .eq("id", id)
    .single<DomainProfileRow>();

  if (error) throw new Error(`could not load domain profile ${id}: ${error.message}`);
  return toProfile(data);
}
