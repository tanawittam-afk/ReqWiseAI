/**
 * Renders `supabase/seed.sql` from the authored TypeScript profiles.
 *
 * Pure: string in, string out, no filesystem and no database. `scripts/generate-profile-seed.ts`
 * writes what this returns; `tests/domain/seed-sync.test.ts` fails if the checked-in
 * file differs from it. That pair is what makes "one source of truth" enforceable
 * rather than aspirational.
 */

import type { DomainProfile } from "./types";

/** The columns `domain_profiles` stores in `content`: everything but the identity. */
export type DomainProfileContent = Omit<DomainProfile, "key" | "name" | "description">;

/** Fixed key order — the generated JSON must be byte-stable across runs. */
export function profileContent(profile: DomainProfile): DomainProfileContent {
  return {
    terminology: profile.terminology,
    typicalStakeholders: profile.typicalStakeholders,
    commonWorkflows: profile.commonWorkflows,
    commonBusinessRules: profile.commonBusinessRules,
    requiredClarificationCategories: profile.requiredClarificationCategories,
    commonRisks: profile.commonRisks,
    suggestedNonFunctionalRequirements: profile.suggestedNonFunctionalRequirements,
    validationRules: profile.validationRules,
    stakeholderQuestionTemplates: profile.stakeholderQuestionTemplates,
  };
}

/** Postgres string literal. Only single quotes need escaping, by doubling. */
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function indent(value: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line, i) => (i === 0 ? line : pad + line))
    .join("\n");
}

const HEADER = `-- ReqWiseAI — domain profile seed
--
-- GENERATED FILE — do not hand-edit.
-- Source of truth: lib/domain/profiles/*.ts (listed in lib/domain/profiles/index.ts).
-- Regenerate with: npm run seed:profiles
-- tests/domain/seed-sync.test.ts fails if this file drifts from the TypeScript.
--
-- The running app reads profile content from this table, never from the TypeScript —
-- see lib/domain/load-profile.ts. Booking and Smart Space is the MVP demonstration
-- domain; General Software proves the profile layer accepts a second profile with no
-- code change.
`;

export function renderProfileSeedSql(profiles: DomainProfile[]): string {
  const rows = profiles.map((profile) => {
    const content = JSON.stringify(profileContent(profile), null, 2);
    return [
      "  (",
      `    ${sqlString(profile.key)},`,
      `    ${sqlString(profile.name)},`,
      `    ${sqlString(profile.description)},`,
      `    ${indent(sqlString(content), 4)}::jsonb,`,
      "    true",
      "  )",
    ].join("\n");
  });

  return [
    HEADER,
    "insert into domain_profiles (key, name, description, content, is_active) values",
    rows.join(",\n"),
    "on conflict (key) do update set",
    "  name        = excluded.name,",
    "  description = excluded.description,",
    "  content     = excluded.content,",
    "  is_active   = excluded.is_active;",
    "",
  ].join("\n");
}
