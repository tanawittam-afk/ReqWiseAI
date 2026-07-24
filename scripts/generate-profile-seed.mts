/**
 * Writes `supabase/seed.sql` from the authored TypeScript profiles.
 *
 *   npm run seed:profiles
 *
 * Runs on Node's native TypeScript stripping (Node ≥ 22.6), so every value import
 * below — and inside `lib/domain/profiles/index.ts` — carries an explicit `.ts`
 * extension. Type-only imports are erased before resolution and need none.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ALL_PROFILES } from "../lib/domain/profiles/index.ts";
import { renderProfileSeedSql } from "../lib/domain/seed-sql.ts";

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "supabase", "seed.sql");

writeFileSync(seedPath, renderProfileSeedSql(ALL_PROFILES), "utf8");

console.log(
  `wrote ${seedPath} — ${ALL_PROFILES.length} profiles: ${ALL_PROFILES.map((p) => p.key).join(", ")}`,
);
