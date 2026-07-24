# ReqWiseAI — Database (Phase 3A)

Schema, constraints, RLS, and workspace bootstrap for the 12-table model in
[`../docs/architecture/DATA-MODEL.md`](../docs/architecture/DATA-MODEL.md).

## Migrations (apply in order)

| File | Contents |
|---|---|
| `20260724000001_enums.sql` | Enumerated types, each mirroring a `const` in `lib/contracts` |
| `20260724000002_tables.sql` | 12 tables, composite FKs, indexes; RLS enabled (no policies yet) |
| `20260724000003_immutability.sql` | Triggers that reject UPDATE/DELETE on the immutable / append-only tables |
| `20260724000004_workspace_bootstrap.sql` | `handle_new_user` — personal org + membership on sign-up |
| `20260724000005_review_and_versioning.sql` | Insert-draft rule, status-transition guard, auto-versioning, `review_item()`, DB-backed display-id allocator |
| `20260724000006_rls.sql` | Membership helpers + per-table policies |

`seed.sql` seeds the two domain profiles — identity **and** content. It is **generated**
from `lib/domain/profiles/*.ts` by `npm run seed:profiles`; never hand-edit it.
`tests/domain/seed-sync.test.ts` fails if it drifts. The app reads profile content from
this table at runtime (`lib/domain/load-profile.ts`), so the TypeScript is the authoring
source and the database is the runtime source.

## How to apply and verify at runtime (NOT done in Phase 3A)

This phase authored the SQL but ran **no** database — no Docker, Supabase CLI, or psql
was available. Runtime verification is therefore **Not Executed**. To run it later:

```bash
# needs Docker Desktop running + the Supabase CLI
supabase start          # boots local Postgres + auth
supabase db reset       # applies every migration in order, then seed.sql
```

Then prove the invariants (these are the acceptance checks, not yet run):

1. **Bootstrap** — sign up a user; assert exactly one `organizations(is_personal=true)`
   and one `organization_members(role='owner')` exist for them.
2. **RLS isolation** — as a second user, `select` the first user's `projects`,
   `analysis_items`, etc. → zero rows.
3. **Immutability** — `update source_documents ...` and `update analysis_runs ...` →
   both rejected by trigger; likewise `delete` on `item_versions` / `review_activities`.
4. **AI cannot decide** — `insert into analysis_items(... status='approved')` → rejected;
   a direct `update analysis_items set status='approved'` → rejected (must go through
   `review_item()`).
5. **Versioning** — update an item's title → a new `item_versions` row holds the OLD
   state and `version_no` bumps.
6. **Review audit** — `select review_item(id,'approve','reviewed'...)` after moving to
   `reviewed`; assert a `review_activities` row was written with `actor_id = auth.uid()`.
7. **Display ids** — `next_display_id()` is a **monotonic high-water mark, not a
   sequence**. It returns one past the highest number already stored for that project
   and type, so the pattern is allocate → insert → allocate: calling it twice without
   inserting returns the same id both times. Numbers are never reused, and a rejected
   or deleted item leaves a permanent gap — a gap is correct behaviour, not a defect,
   because a stakeholder may already have written that number down.
