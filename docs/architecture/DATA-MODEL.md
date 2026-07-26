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
| 6 | `source_documents` | The raw business input, verbatim. Revisioned: `document_key` + `revision_number` | **Editable until analysed, then frozen** |
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

**`source_documents`** — revisioned audit evidence. Never deleted; frozen once cited.
*(Narrowed in Slice 3, migration `20260724000008_source_revisions.sql`.)*

The reason offsets must not move has not changed. What changed is the observation that a
source is not evidence of anything until something cites it:

- **Before any analysis run references it**, a revision may be edited in place. Nothing
  points at its offsets yet, so nothing can be invalidated. This is the ordinary case —
  a BA pastes notes, re-reads them, fixes a typo.
- **The moment an `analysis_runs` row references it**, the revision is permanently frozen:
  `raw_text`, `title`, `kind` and metadata alike. A citation is a snapshot of how the
  document read at that moment, not of its body alone.
- **Editing a frozen revision creates revision N+1** — a new row sharing the predecessor's
  `document_key`, with `revision_number = N+1` and `supersedes_source_document_id` pointing
  back. The earlier revision, and every run that cites it, are untouched.
- **No revision is ever hard-deleted**, frozen or not. RLS has no DELETE policy and
  `source_documents_no_delete` refuses even the service role. Permanent purge is a future
  privileged retention workflow, not a user action and not a manual trigger-disabling step.
- **An archived project is read-only**: no source may be added, edited or superseded under
  it until it is restored (`guard_source_document_insert` / `guard_source_document_update`).

"Locked" is **not a column**. It is `exists (select 1 from analysis_runs where
source_document_id = …)`, exposed as `source_document_is_locked(uuid)`. A stored boolean
could drift from the runs it claims to describe; a derived one cannot.

`raw_text` is stored **verbatim** — never trimmed, re-wrapped, whitespace-collapsed or
newline-normalised. One caveat worth knowing: browsers submit `<textarea>` newlines as CRLF
per the HTML spec, so text typed with LF arrives as CRLF and is stored that way. The server
does not alter it in either direction, and offsets are always measured against the stored
text, so `rawText.substring(start, end)` holds.

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

- A **significant edit** — change to `title`, `description`, `priority` or `attributes` —
  writes an `item_versions` row **capturing the state before the edit**, then updates the
  item and bumps `analysis_items.version_no`.
- **Since Slice 5 `item_type` is not on that list — it cannot change at all**, along with
  `display_id`, `provider_key`, `analysis_run_id`, `evidence_class`, `origin`,
  `confidence`, `rationale` and `created_at`. `guard_item_update()` raises on any of them,
  for every role and every path. A type change would move the item's display prefix and
  break every citation that already names it; the rest describe what the analysis *found*,
  and a version history of claims nobody made is worse than no history at all.
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
4. Valid transitions **as tightened by Slice 5** (`is_valid_status_transition`,
   20260725000013):

   | From | To |
   |---|---|
   | `draft` | `reviewed` · `needs_clarification` · `rejected` |
   | `needs_clarification` | `reviewed` · `rejected` |
   | `reviewed` | `approved` · `needs_clarification` · `rejected` |
   | `approved` | — terminal in the MVP |
   | `rejected` | — terminal in the MVP |

   Enforced by trigger, so an API bug cannot skip review. Three edges the Phase 3A table
   allowed were **withdrawn**: `approved → implemented`, `approved → needs_clarification`
   and `rejected → draft`. The `implemented` enum label survives (dropping an enum label
   rewrites every dependent row) and is simply unreachable until a later slice re-opens
   it deliberately. Reopening an approved requirement is a **change-request** workflow,
   not a status flip, and is out of scope.

5. **Returning to `draft` is not a review decision.** It appears nowhere in the table
   above, because nobody chooses it from a menu: it is what *editing* does to a review
   that no longer describes the text. See C.11.

---

## C.11 Human review, editing and concurrency (Slice 5)

Four rules, all enforced in the database so they hold on every path — the RPC, a
hand-rolled PostgREST call, or psql — and not only in the path the application happens
to use.

**1. A review does not survive a material edit.** Editing an item whose status is
`reviewed` or `needs_clarification` resets it to `draft` and appends a
`review_activities` row (`activity_type = 'edit'`) recording the reset. This happens
inside `guard_item_update()`, in the same transaction as the content write and the
version snapshot, so an item can never read "reviewed" while holding text nobody
reviewed. Editing a `draft` leaves it a draft and writes no activity.

**2. Approved and rejected items are frozen.** Both the RPC and the trigger refuse a
content change, so the freeze survives a client that bypasses the RPC.

**3. Optimistic concurrency.** `edit_analysis_item(p_expected_version, …)` refuses the
write when the row has moved on; `review_item(p_expected_status, …)` does the same for a
decision taken against a state that has since changed. Both raise **`PT409`**, *not*
`serialization_failure` (40001) — PostgREST treats 40001 as a transient fault and
**retries** it, which turned a lost update into an "upstream request timeout" instead of
a refusal (fixed in 20260725000014; `scripts/verify-review.mts` check 26 is what caught
it). `PT409` is PostgREST's convention for "answer with HTTP 409 Conflict", which is what
has actually happened, and it is never retried.

**4. Only twelve of the fourteen item types take this workflow.** `open_question` and
`quality_finding` are observations *about* the analysis rather than claims it makes:
a question is answered and a finding is acknowledged, neither is "approved".
`is_reviewable_item_type()` refuses both in the RPCs and in the trigger. Since slice 6A
they have workflows of their own — see C.12.

Editing runs through `edit_analysis_item` — a narrow `SECURITY DEFINER` RPC whose
signature accepts the item id, an expected version, the three editable fields and an
optional change reason, and **nothing else**. The parameters a function does not accept
are the ones no client can forge: there is no `status`, no `actor`, no `version_no`, no
evidence and no snapshot in its argument list. It re-derives membership, project status,
item type and current version from the database under `auth.uid()`.

`item_versions.change_reason` is populated by passing the reason through the
transaction-local setting `reqwise.change_reason`, which the trigger reads when it writes
the snapshot. Transaction-local, so a pooled connection cannot leak one edit's reason
into the next.

---

## C.12 Question resolution and quality workflow (Slice 6A)

The two types slice 5 locked out of requirement review get their own workflow, on the
same row rather than in a thirteenth table.

**Why no new table.** A one-to-one `item_workflows` table would restate rules that
already hold: `review_activities` is already append-only, project-scoped and
actor-stamped; every policy is already written against `analysis_items.project_id`; a
CHECK keyed on `item_type` makes impossible states unrepresentable in a way a foreign
key cannot; the workspace reads a whole run in one query and a side table makes that a
join; and a one-to-one side table can drift (two rows, or none) where a column cannot.
Five columns and two nullable columns on `review_activities` are the whole change.

| Column | Meaning |
|---|---|
| `analysis_items.workflow_state` | `item_workflow_state`; NULL for the twelve reviewable types |
| `analysis_items.resolution_text` | the answer, deferral reason, dismissal reason or resolution note behind the **current** state |
| `analysis_items.resolved_at` / `resolved_by` | who decided and when; both NULL or both set |
| `analysis_items.follow_up_on` | a deferral's optional follow-up date |
| `review_activities.from_workflow_state` / `to_workflow_state` | the transition; a row carries either a review transition or a workflow one, never both |

**States, by type** (`analysis_items_workflow_state_by_type`):

| Type | States | Transitions |
|---|---|---|
| `open_question` | `open` · `answered` · `deferred` · `not_applicable` | open → answered/deferred/not_applicable · deferred → answered/not_applicable/open · answered → open · not_applicable → open |
| `quality_finding` | `open` · `acknowledged` · `resolved` · `dismissed` | open → acknowledged/resolved/dismissed · acknowledged → resolved/dismissed/open · resolved → open · dismissed → open |
| everything else | none — `workflow_state` **must** be NULL | — |

**Rules the database enforces, not just the UI:**

1. **AI items start `open`.** `enforce_insert_draft()` assigns the state rather than
   validating it — a provider that offers one is ignored, not refused, because there is
   no state an analysis can legitimately claim.
2. **Every decision carries words**, with exactly one exception:
   `acknowledged` means "seen, not fixed" and needs none. Blankness is decided by
   `blank_to_null()`, which trims **all** whitespace — Postgres `trim()` removes spaces
   only, so a note of a newline and a tab satisfied the rule until 20260725000017.
3. **Reopening clears the decision but never the record of it.** `resolution_text`,
   `resolved_at`, `resolved_by` and `follow_up_on` are cleared; the answer that was
   given survives in the append-only activity written when it was given.
4. **A follow-up date belongs to deferral** and to nothing else
   (`analysis_items_follow_up_only_deferred`).
5. **The workflow columns move only through their own RPC.** `guard_item_update()`
   refuses a direct write, so an answer can never exist without the activity beside it.
6. **Optimistic concurrency** on `p_expected_state`, raised as `PT409` (see C.11 for why
   not `serialization_failure`).

**No silent requirement mutation.** Answering a question or resolving a finding does not
touch any requirement's text, status, evidence, source references or version, does not
create a requirement, and does not alter the analysis run. Where an answer plainly
implies a requirement should change, the UI says *"This answer may require a requirement
change."* and shows a **disabled** *Create change request — Coming next*. Acting on an
answer is a change-request workflow with its own audit trail — deliberately not this
slice, and the reason `approved` stays terminal (C.5).

**Evidence.** A question raised from a domain profile has no source reference by
construction; the source panel shows no highlight and says *"Generated from domain
guidance; no direct source evidence."* Inventing a highlight for the nearest plausible
sentence would fabricate the exact thing a citation exists to prove.

**Archived projects** are readable in full — questions, answers, findings, resolutions
and activity — and refuse every workflow action at the UI, the service and the RPC.

---

## C.13 Typed traceability relations (Slice 6B)

Until this slice every row in `item_relations` was `derives_from`, because the provider
contract carried an untyped `related_item_keys` list and persistence had to label the
edge somehow. `derives_from` was therefore not a statement about the relationship — it
was the absence of one. Slice 6B gives the edge a kind.

**The vocabulary** (`lib/contracts/relations.ts`; enum labels added in
`20260726000018`). A label means one direction and only one direction; there is no
reversed spelling of the same edge, because a reader who must check which way round a
row was written cannot trust the matrix built from it.

| Type | Reads as | Spine? |
|---|---|---|
| `supports` | objective → business requirement | ✔ |
| `implemented_by` | business requirement → functional / non-functional requirement | ✔ |
| `expressed_as` | functional requirement → user story | ✔ |
| `validated_by` | story or requirement → acceptance criterion | ✔ |
| `constrained_by` | requirement → constraint or business rule | — |
| `raises_question` | open question → the item it questions | — |
| `flags_quality_issue` | quality finding → the item it flags | — |
| `mitigates` | requirement / rule / constraint → risk | — |
| `related_to` | any → any; a real link with no specific type | — |
| `derives_from` | **legacy only** — child → parent, never authored again | ✔ (direction recorded) |

`refines`, `satisfies`, `verifies`, `conflicts_with` and `duplicates` survive in the enum
from Phase 3A, unreachable and unwritten, for the same reason the `implemented` status
label does (§C.5): dropping a label rewrites every dependent row.

**Why a function and not a thirteenth table.** The `(relation_type, from_type, to_type)`
matrix lives in `is_allowed_relation_pair()`. A lookup table would need seeding, and a
seed row naming a label added in the same transaction is exactly what part 1 of the
migration exists to avoid; it would also turn an immutable rule into mutable data. The
standing test — a new table is justified only by a genuinely different lifecycle,
permission model or query pattern — is not met. The same matrix is stated in
`ALLOWED_RELATION_PAIRS`, where the tests and the UI can read it; the database remains
the enforcement point, and when one changes the other must.

**Rules the database enforces:**

1. **The pair must be legal for the type.** `implemented_by` from a business requirement
   to an acceptance criterion is refused, not stored and rendered as nonsense. There is
   no same-type exemption: no spine rule lists one type on both sides, because
   decomposition *within* a level is not traceability *across* levels.
2. **No self-relation, no duplicate** (`from ≠ to`, plus the existing unique key).
3. **No edge crosses a project or an organization**, and the check holds against the
   service role, not only through RLS.
4. **An archived project refuses a new relation** and still reads in full.
5. **A cycle over the hierarchical spine is refused**, deferred to the end of the
   transaction so a legitimate multi-edge insert is judged on its finished shape.
   `related_to` is deliberately *not* hierarchical: it makes no parent/child claim, so
   "A related_to B, B related_to A" is two ordinary rows rather than a loop. The
   observation types (`raises_question`, `flags_quality_issue`, `constrained_by`,
   `mitigates`) describe the spine from outside it and cannot form one.
6. **A new run may not write `derives_from`.** `AUTHORED_RELATION_TYPES` is what the
   validator accepts; the legacy label loads and displays but is never authored again.
7. **An invalid relation rolls the whole run back** — no run, no items, no relations,
   consistent with §C.9.

**Legacy rows are not touched.** The `derives_from` rows written before this slice keep
their label, their direction and their meaning. Re-typing them would be a guess about a
relationship the provider never stated, and the triggers fire on INSERT/UPDATE, so those
rows are never evaluated against rules written after they were stored. The two
conventions coexist because direction is *recorded* (`HIERARCHY_DIRECTION`) rather than
assumed, and `canonicalHierarchyEdge()` normalises both to `[parent, child]` before any
matrix row or cycle is read. A pre-existing cycle among legacy rows, if one exists, is
surfaced as a coverage indicator (`existing_cycle`) for a human to repair — repairing it
in SQL would mean deciding which edge the analysis "meant".

**Coverage is derived, never stored.** `lib/traceability/coverage.ts` answers mechanical
questions about the shape of the graph — an objective with no requirement beneath it, an
orphan, an approved item linked to a rejected one, an unresolved question or finding. A
stored count would be a second copy of a fact the relations already hold, free to drift
the moment somebody edits an item — the argument that keeps `source_document_is_locked()`
derived (§C.3). The indicators assist review and do not replace it, and the UI says so.

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
| `projects` | `is_org_member` | `is_org_member` | `is_org_member` | **✗** (archive instead) |
| `domain_profiles` | any authenticated | ✗ | ✗ | ✗ |
| `source_documents` | project's org | project's org (active project only) | project's org, **unlocked revision, active project** | **✗** |
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

## C.9 Atomic analysis persistence (Slice 4)

`persist_analysis_result()` (`20260724000010`/`...011`) is the one door an analysis
run's output is written through — a run, its items, their source references, and
their relations all land in one transaction or none do.

- **No service role in the request path.** The function is `SECURITY DEFINER`, owned
  by the migration role, so it bypasses RLS the same way `source_document_is_locked()`
  and `project_is_active()` already do (§C.7's own precedent) — but the server still
  calls it on the caller's **user-scoped** client, and the function re-derives
  `auth.uid()`, membership, and archive status itself before writing anything.
- **Display ids are allocated inside the function**, as a *reserved range* per
  `(project, prefix)` — see §C.10. The number a caller sees from the pure
  normalization layer (`lib/normalization/ports.ts`) is a local placeholder,
  discarded here.
- **Local keys, not database ids, address relations and references.** The pure layer
  mints an id like `item-3` scoped to one run; the payload carries that as `local_key`
  and the function resolves it to a real `analysis_items.id` in a temp table before
  wiring up `item_source_references` and `item_relations`. A `local_key` that fails to
  resolve produces `NULL` into a `not null` column and rolls back the whole run — a
  safety net, since `validateAnalysis()` already guarantees every key resolves before
  persistence is ever attempted.
- **Idempotency** — `analysis_runs.request_key`, unique per project (partial index,
  only rows written through this path carry one). A client-generated key travels with
  the confirmation form. A key identifies one *attempt*, so replaying it returns the
  existing run only when the attempt is genuinely the same: same source document,
  same actor, same provider, same output language. A key arriving with a different
  context is a **collision and is refused** — answering it with a run about somebody
  else's source would be a wrong answer rather than a refusal.
- **`related_item_keys` has no relation kind of its own** in the provider contract
  (`AI-OUTPUT-CONTRACT.md`), so every edge it produces is recorded as
  `item_relations.relation_type = 'derives_from'`. This is a known simplification, not
  a claim about the specific relationship — see HANDOFF.md.

---

## C.10 Display id range allocation (Slice 4.1)

`allocate_display_number_range(project, prefix, count)` (`20260725000012`) reserves a
whole block of numbers for one item-type prefix, and is the only sanctioned way for
`persist_analysis_result()` to obtain display ids.

- **The lock is per `(project, prefix)` and transaction-scoped** —
  `pg_advisory_xact_lock`, released automatically on commit or rollback. Two runs
  writing different prefixes never block each other; two runs writing the same prefix
  are strictly ordered.
- **The high-water mark stays derived.** There is no counter table: the mark is
  `max(number)` over committed `analysis_items` for that prefix, so it cannot drift
  from the rows it describes. The reservation holds because the lock is held until the
  caller's inserts commit.
- **Deadlock avoidance is by ordering.** A run touches many prefixes; the RPC
  allocates them in sorted prefix order so concurrent runs always take the locks in
  the same sequence.
- **Gaps are correct; collisions are not.** A rejected or deleted item leaves a
  permanent gap — a stakeholder may already have written that number down. The
  invariant is narrower and exact: *no two committed items in a project share a
  display id*, enforced finally by `unique (project_id, display_id)`.
- **Rollback semantics, stated precisely.** A transaction that fails commits no rows,
  so the mark does not move and the next caller receives the same numbers. Nothing was
  ever visible under those numbers, so that is not reuse.

`next_display_id()` (Phase 3A) remains for single-id callers and for `verify-db.mts`
check 7. It reads the mark without reserving anything, which is why the persistence
path no longer uses it.

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
