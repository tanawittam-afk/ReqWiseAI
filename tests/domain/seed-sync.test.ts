/**
 * The single-source-of-truth guard.
 *
 * Profile content is authored in TypeScript and served from the database. That is only
 * one source of truth if the generated seed can never silently fall behind the
 * TypeScript — so this test fails the build when it does. Fix by running
 * `npm run seed:profiles`, never by editing `supabase/seed.sql` by hand.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { ALL_PROFILES } from "../../lib/domain/profiles";
import { domainProfileSchema } from "../../lib/domain/profile-schema";
import { profileContent, renderProfileSeedSql } from "../../lib/domain/seed-sql";

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "..", "supabase", "seed.sql");

describe("domain profile seed", () => {
  it("supabase/seed.sql matches the authored TypeScript profiles", () => {
    const actual = readFileSync(seedPath, "utf8").replace(/\r\n/g, "\n");
    expect(actual).toBe(renderProfileSeedSql(ALL_PROFILES));
  });

  it("every authored profile satisfies the schema the loader parses with", () => {
    for (const profile of ALL_PROFILES) {
      expect(() => domainProfileSchema.parse(profile)).not.toThrow();
    }
  });

  it("round-trips through the jsonb split without losing a field", () => {
    for (const profile of ALL_PROFILES) {
      const { key, name, description } = profile;
      const rehydrated = {
        key,
        name,
        description,
        ...JSON.parse(JSON.stringify(profileContent(profile))),
      };
      expect(domainProfileSchema.parse(rehydrated)).toEqual(profile);
    }
  });

  it("keeps profile keys unique", () => {
    const keys = ALL_PROFILES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
