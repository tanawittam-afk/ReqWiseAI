# ReqWise AI — Data Model (C)

Status: **proposed** · 2026-07-24 · part of the Architecture Gate.
No migration exists. Nothing has been applied to a database.

**12 tables.** The spec's 17 conceptual entities map onto them; §"Deliberate
simplifications" justifies every collapse.

---

## C.1 Entity responsibilities

| # | Table | Responsibility | Mutability |
|---|---|---|---|
| 1 | `profiles` | Per-user app data mirroring `auth.users` (display name, UI locale) | Mutable by owner |
| 2 | `organizations` | The tenancy boundary. `is_personal` flags the auto-created workspace | Mutable name only |
| 3 | `organization_members` | Who may reach an organization, and as what role | Mutable role |
| 4 | `projects` | A unit of analysis work; owns sources, runs, items. Names its domain profile | Mutable |
| 5 | `domain_profiles` | Business context as **data**: terminology, stakeholders, workflows, rules, clarification categories, risks, suggested NFRs, validation rules, question templates | Seeded; admin-mutable |
| 6 | `source_documents` | The raw business input, verbatim | **Immutable** |
| 7 | `analysis_runs` | One execution: provider, model, prompt version, raw output, validated output, validation status | **Immutable** |
| 8 | `analysis_items` | Every structured output, discriminated by `item_type` | **Mutable — the review surface** |
| 9 | `item_source_references` | Vertical traceability: item → exact excerpt in a source | Insert/delete with item edits |
| 10 | `item_relations` | Horizontal traceability: item → item (`derives_from`, `refines`, `satisfies`, `verifies`, `conflicts_with`, `duplicates`) | Mutable |
| 11 | `item_versions` | Snapshot of an item before each significant edit | **Append-only** |
| 12 | `review_activities` | Audit of every human review action | **Append-only** |

### Item types carried by `analysis_items.item_type`

`problem_statement` · `business_objective` · `stakeholder` · `business_requirement` ·
`functional_requirement` · `non_functional_requirement` · `user_story` ·
`acceptance_criterion` · `business_rule` · `assumption` · `risk` · `constraint` ·
`open_question` · `quality_finding`

Type-specific fields (user story's *as-a / I-want / so-that*, risk's *impact / likelihood /
mitigation*, stakeholder's *role / interest*) live in a JSONB `attributes` column,
validated by a **Zod discriminated union on `item_type`**. This is what keeps 14 output
types in one table without the table becoming a bag of nullable columns.

### Human-readable IDs

`analysis_items.human_key` — `BR-001`, `FR-001`, `NFR-001`, `US-001`, `AC-001`,
`RISK-001`, `Q-001`, plus proposed `PS-`, `OBJ-`, `STK-`, `RULE-`, `ASM-`, `CON-`, `QF-`.

Allocated **per project, per type** at insert, `UNIQUE (project_id, human_key)`.

Not a gap-free sequence — a **monotonic high-water identifier**. `next_display_id()`
returns one past the highest number stored for that project and type, so the caller must
allocate, insert, then allocate again; calling it twice without an insert in between
returns the same id. Numbers are never renumbered and never reused, and a rejected
`FR-004` leaves a permanent gap, because a stakeholder may have written that number down.
Gaps are correct output. *(Verified at runtime 2026-07-24: `BR-002 → BR-003`, and
`US-001` for a fresh type in the same project.)*

---

## C.2 Relationships

```
auth.users ─1:1─ profiles
auth.users ─1:N─ organization_members ─N:1─ organizations
organizations ─1:N─ projects
domain_profiles ─1:N─ projects            (profile is referenced, never copied)

projects ─1:N─ source_documents
projects ─1:N─ analysis_runs ─N:1─ source_documents   (MVP: one run, one source)
analysis_runs ─1:N─ analysis_items
analysis_items ─1:N─ item_source_references ─N:1─ source_documents
analysis_items ─1:N─ item_versions
analysis_items ─1:N─ review_activities
analysis_items ─N:N─ analysis_items  via item_relations (from_item_id, to_item_id)
```

Every table below `projects` carries a denormalized `project_id`. This is deliberate: it
makes every RLS policy a single indexed predicate instead of a three-table join on every
row read. Consistency is guaranteed by composite foreign keys — e.g.
`item_source_references (item_id, project_id) REFERENCES analysis_items (id, project_id)` —
so the denormalized column cannot drift. **Trade-off accepted: slightly wider rows in
exchange for RLS that stays cheap and readable.**

---

## C.3 Immutability rules

**`source_documents`** — insert and select only. No UPDATE, no DELETE policy exists.
Analysis items reference character offsets into `raw_text`; if the text could change, every
stored highlight would silently point at the wrong words. Correcting a source means adding
a new source document, not editing the old one.

**`analysis_runs`** — insert and select only. Stores both:
- `raw_provider_output` — exactly what the provider returned, unmodified
- `validated_output` — the Zod-parsed structure (null when validation failed)

A re-run **always** inserts a new run. There is no UPDATE path, so "the AI's original
answer" is permanently recoverable no matter how heavily a human later edits the items.

A run row is written **once, after the provider call settles** — success or failure, with
`validation_status ∈ {valid, invalid, provider_error}` and any error text. No
pending→complete transition exists, which is what lets the table be UPDATE-free. (Cost:
streaming and long-running runs are not supported. Accepted for MVP; revisit before the
real provider ships.)

**`item_versions`, `review_activities`** — insert and select only. No UPDATE, no DELETE,
at the policy level. Audit history cannot be destructively rewritten by the application,
because the application is never granted the privilege to try.

---

## C.4 Versioning rules

`analysis_items` holds the **current** state. `item_versions` holds the history.

- A **significant edit** — change to `title`, `description`, `priority`, `item_type`, or
  `attributes` — writes an `item_versions` row **capturing the state before the edit**,
  then updates the item and bumps `analysis_items.version_no`.
- Non-significant changes (`status`, `review_state`) do **not** create a version — they
  create a `review_activities` row instead. Status is review history, not content history.
- `item_versions` records `version_no`, full `snapshot` JSONB, `changed_by`,
  `change_reason`, `created_at`. `UNIQUE (item_id, version_no)`.
- Version 1 is the AI's original item, written at analysis time, so a fully-edited item
  can always be diffed back to what the machine actually said.
- Deleting an item is a **soft delete** (`deleted_at`) — its versions and review history
  must survive it.

---

## C.5 Review activity rules

Every human review action appends one row: `item_id`, `actor_id`, `activity_type`,
`from_status`, `to_status`, `comment`, `created_at`.

`activity_type ∈ {comment, status_change, priority_change, edit, approve, reject,
request_clarification}`

Enforced invariants:

1. **A status change without a `review_activities` row is impossible.** Both writes happen
   in one transaction in the review service; a database trigger rejects a status change
   that arrives without its activity.
2. **`Approved` and `Rejected` require a human actor.** `actor_id` is `NOT NULL` and comes
   from the JWT, never from the request body.
3. **AI never transitions anything.** The analysis service may only insert items at
   `status = 'draft'`; a CHECK constraint on insert-time status enforces it.
4. Valid transitions: `draft → needs_clarification | reviewed | rejected` ·
   `needs_clarification → draft | reviewed | rejected` · `reviewed → approved | rejected |
   needs_clarification` · `approved → implemented | needs_clarification` ·
   `rejected → draft`. Enforced by trigger, so an API bug cannot skip review.

---

## C.6 Minimal workspace boundary

- On first sign-in, a `SECURITY DEFINER` trigger on `auth.users` creates, in one
  transaction: a `profiles` row, an `organizations` row with `is_personal = true`, and an
  `organization_members` row with `role = 'owner'`. The client is never trusted to do this.
- **Every project belongs to an organization.** `projects.organization_id` is `NOT NULL`.
  There is no user-owned-project path to retrofit later.
- Access is always decided by **membership**, never by `created_by`.
- Roles: `owner`, `member`. MVP only ever writes `owner`. `member` exists so that adding
  invitations later is a feature, not a migration of every policy.

**Not built:** invitations, team-management UI, billing, organization switching beyond a
single personal workspace, custom roles, ownership transfer. The schema accommodates them;
no code path exercises them.

---

## C.7 RLS strategy

RLS is **enabled on all 12 tables**, and no table gets a permissive default.

The whole model reduces to one predicate, via a `STABLE SECURITY DEFINER` helper:

```sql
is_org_member(org uuid) -- true if auth.uid() is in organization_members for org
```

`SECURITY DEFINER` is required to avoid infinite RLS recursion when
`organization_members`' own policy needs to consult `organization_members`.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | self | self | self | ✗ |
| `organizations` | member | ✗ (trigger only) | owner | ✗ |
| `organization_members` | member of same org | ✗ (trigger only) | ✗ | ✗ |
| `projects` | `is_org_member` | `is_org_member` | `is_org_member` | owner |
| `domain_profiles` | any authenticated | ✗ | ✗ | ✗ |
| `source_documents` | project's org | project's org | **✗** | **✗** |
| `analysis_runs` | project's org | project's org | **✗** | **✗** |
| `analysis_items` | project's org | service only | project's org | soft delete only |
| `item_source_references` | project's org | with parent item | ✗ | with parent item |
| `item_relations` | project's org | project's org | project's org | project's org |
| `item_versions` | project's org | project's org | **✗** | **✗** |
| `review_activities` | project's org | project's org (`actor_id = auth.uid()`) | **✗** | **✗** |

Where a policy says "project's org", it reads the row's denormalized `project_id` and
checks `is_org_member` on that project's organization — one indexed hop.

**Immutability is enforced by the absence of a policy, not by application discipline.** A
`service_role` key would bypass RLS entirely, which is exactly why it is confined to
seeding and the auth trigger and never reaches a request handler carrying user input.

**Verification requirement (Definition of Done):** every RLS claim above must be proven by
signing in as a second user and failing to read or write the first user's rows — not by
reading the policy and agreeing with it.

---

## C.8 Source traceability strategy

`item_source_references`: `item_id`, `project_id`, `source_document_id`, `excerpt`,
`start_offset`, `end_offset`, `evidence_strength`.

- `excerpt` is stored **verbatim**, not just as offsets. Offsets alone would be unreadable
  in an export and would break if a source were ever migrated; the excerpt is the durable
  record, the offsets are the highlighting mechanism.
- Offsets are optional — a provider that cannot locate an exact span still produces a
  usable citation. When present they must satisfy
  `substring(raw_text, start, end) = excerpt`; a mismatch is a validation failure, not a
  silent tolerance. This is the check that catches a model quoting text it invented.
- `evidence_strength` (0..1) is per-reference and distinct from the item's overall
  `confidence`: one is *how good is this citation*, the other is *how sure is the model
  about this requirement*.
- **A source reference may only point at a `source_documents` row.** There is no column,
  type, or code path by which a `domain_profiles` row can become evidence. A domain
  profile may generate an open question or fire a validation rule; it can never justify a
  business fact.
- Items with `evidence_class = 'stated'` must carry ≥ 1 reference; `assumed` items must
  carry none. Enforced in the output contract — see `AI-OUTPUT-CONTRACT.md` §D.5.

---

## Deliberate simplifications (17 concepts → 12 tables)

| Concept in the spec | Where it lives | Why not its own table |
|---|---|---|
| Source Segment | `item_source_references` (offsets into `source_documents.raw_text`) | A segment with no citation referencing it has no consumer. Offsets give the same capability with no orphan rows and no re-segmentation problem when a source changes. Promote it only if segment-level annotation (independent of an item) is ever required. |
| User Story, Acceptance Criterion, Risk, Assumption, Constraint, Open Question | `analysis_items` rows discriminated by `item_type` | Identical lifecycle (draft→approved), identical permissions (project's org), identical query pattern (fetch all items for a run). Six tables would mean six copies of the versioning, review, and RLS machinery. Type-specific fields live in validated `attributes` JSONB. |
| Requirement Version | `item_versions` | Same thing, named for the fact that it versions all item types, not only requirements. |
| Review Activity | `review_activities` | Kept as its own table — different lifecycle (append-only), different query pattern (audit timeline). |

**Rule going forward:** a new table is justified only when an entity has a genuinely
different lifecycle, permission model, or query pattern. "It is conceptually distinct" is
not sufficient.
