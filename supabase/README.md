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
| `20260724000007_project_lifecycle.sql` | Project intake fields, archive/restore lifecycle, column guard; removes the project DELETE policy |
| `20260724000008_source_revisions.sql` | Source revision identity (`document_key`, `revision_number`, `supersedes_…`), metadata, archived-project and lock guards, source UPDATE policy |
| `20260724000009_source_kind_operational.sql` | Adds `operational_notes` to the `source_kind` enum |
| `20260724000010_analysis_persistence.sql` | `analysis_runs.request_key` (idempotency) + `persist_analysis_result()`, the atomic RPC that writes a run and its items, references and relations in one transaction |
| `20260724000011_analysis_persistence_guards.sql` | Defense-in-depth: `persist_analysis_result()` also refuses an `assumed` item carrying a source reference, mirroring `lib/validation/evidence.ts` at the write boundary |
| `20260725000012_display_id_ranges.sql` | `allocate_display_number_range()` — reserves a block of display numbers per `(project, prefix)` under a transaction-scoped advisory lock; `persist_analysis_result()` switches to it and binds an idempotency key to the context it was first used with |

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
3. **Immutability** — `update analysis_runs ...` is rejected by trigger, likewise `delete`
   on `item_versions` / `review_activities`. `source_documents` is **narrower since Slice
   3**: an unreferenced revision may be edited, a revision cited by any `analysis_runs`
   row is frozen outright, and no revision may ever be deleted. See check 8.
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
8. **Source revisions** — a source is editable until an `analysis_runs` row cites it, then
   frozen; editing a frozen revision inserts revision N+1 sharing its `document_key`, and
   the original row and the run that cites it are unchanged. A forged `revision_number`, a
   number that skips, a duplicate, a predecessor in another project, and any write under an
   archived project are all rejected by trigger.
9. **Atomic analysis persistence** — `persist_analysis_result()` writes a run and, when
   valid, all of its items/references/relations in one transaction; an invalid or
   provider-error outcome writes the run alone with zero items. A malformed item payload
   (e.g. an unknown `item_type`) rolls back the run insert too — nothing partial survives.
   Display ids are unique and continue across runs; the same idempotency key returns the
   existing run instead of writing a second one. `analysis_items` has no INSERT policy at
   all, so even a correctly-shaped direct client insert is refused — the RPC is the only
   door.
10. **Display id ranges and idempotency context** — `allocate_display_number_range()`
    refuses a count below 1, a malformed prefix and a non-member, and reserves a whole
    block under a per-`(project, prefix)` transaction lock. Two *genuinely concurrent*
    persists into one project produce non-overlapping blocks per prefix, and the
    high-water mark afterwards equals the last committed number. A transaction that
    rolls back leaves the mark untouched and no orphan item behind. A request key
    replayed with the same context returns the original run and writes nothing new; the
    same key with a different source, or a different output language, is refused.

### Running the checks

Checks 1–7 are `npm run verify:db`, the project lifecycle is `npm run verify:projects`,
check 8 is `npm run verify:sources`, and checks 9–10 are `npm run verify:analysis` — 8,
10, 18 and 25 assertions respectively, all against the linked project. Verification rows cannot
be removed through the API (the immutability triggers refuse DELETE even for the service
role, which is the schema working); clear them with
`npx supabase db query --linked -f scripts/verify-db-cleanup.sql`. Disabling triggers is a
maintenance operation and never part of an application workflow.
