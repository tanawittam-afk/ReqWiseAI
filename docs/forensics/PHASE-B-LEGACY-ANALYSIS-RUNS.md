# Phase B Legacy `analysis_runs` Forensics

Date: 2026-07-27  
Mode: read-only forensic analysis  
Verdict: **NO-GO for Phase B completion**

## Executive summary

Migration 20 is applied and correctly prevents new incoherent analysis results through
`public.persist_analysis_result(...)`. The existing-run preflight found 31 incompatible
rows among 231 runs.

The read-only inventory classifies 30 rows as **Verification/Test Data, high confidence**
and one row as **Unknown / Insufficient Evidence, low confidence**. The high-confidence
conclusion does not rely on a project or source name alone. Thirty rows match one of two
exact historical verifier fingerprints:

- 15 rows match `scripts/verify-db.mts`: a directly inserted `valid` mock run with no raw
  or validated payload, followed by two business requirements, one version snapshot and
  two review activities.
- 15 rows match `scripts/verify-sources.mts`: a directly inserted `valid` mock run with no
  raw payload, `validated_output = {"items":[]}`, and no items or other downstream rows.

Run `08edaef7-5c4f-45a0-be0a-eec3a7c2818f` has the same empty legacy payload shape as the
source verifier, but it does not match that script's exact project/source identity or
isolated project dependency shape. It sits in a mixed project and therefore defaults to
preservation as unknown.

All 31 lack the original raw provider output. Fifteen also lack validated output.
Therefore no payload can be backfilled deterministically without fabricating historical AI
output. Changing status or constructing an error payload would also change historical
meaning.

The safest strategy is to preserve the rows unchanged and make the verification boundary
legacy-aware without weakening the migration 20 contract for new writes. A future verifier
change should pin the exact 31-row legacy incompatibility set, retaining the distinction
between 30 proven verifier fixtures and one unknown row, and fail if the set grows or any
fingerprint changes. No such application or verifier change is made in this forensic step.

No database data was inserted, updated, deleted, archived, reseeded or otherwise mutated.

## New contract definition

The authoritative database contract is split between the table schema and migration 20's
canonical persistence RPC:

| Area | Contract |
|---|---|
| Status values | `valid`, `invalid`, `provider_error` only. There are no `pending`, `processing`, `completed`, or `failed` run states. |
| Always required | `project_id`, `source_document_id`, nonblank `provider`, nonblank `schema_version`, `output_lang`, `validation_status`, `created_by`, and `created_at`. |
| Nullable metadata | `model`, `prompt_version`, `request_key`, raw output, validated output, and error are nullable subject to the status rules below. |
| `valid` | Raw output is non-null and not JSON null; validated output is non-null and not JSON null; error is SQL null; items and relations are arrays; at least one item exists. |
| `invalid` | Raw output is non-null and not JSON null; validated output is SQL null; error is non-null and not JSON null; zero items and zero relations. |
| `provider_error` | Raw and validated output are SQL null; error is non-null and not JSON null; zero items and zero relations. |
| Provider/model metadata | Provider is required and nonblank. Model and prompt version are intentionally nullable. |
| Version metadata | Schema version is required and nonblank. All 31 legacy rows carry `1.0.0`. |
| Timestamps | `created_at` is non-null. `analysis_runs` has no `updated_at`, consistent with run immutability. |
| Relationships | Project FK is required. `(source_document_id, project_id)` must reference the same source/project pair. All 31 relationships are valid. |
| Idempotency | Optional `request_key` must be 8–100 characters and unique per project when present. All 31 have a null key. |
| Mutability | Update and delete triggers reject changes to `analysis_runs`, including service-role attempts. Re-running creates a new run. |

Migration 20 enforces the status/payload rules at the RPC boundary. It does not rewrite or
retroactively repair existing rows.

## Read-only inventory

The executable inventory is
[`scripts/forensics/legacy-analysis-runs-readonly.sql`](../../scripts/forensics/legacy-analysis-runs-readonly.sql).
It returns one redacted structural record per affected run, including run/project/source
IDs, organization ID, `created_at`, the deliberately absent `updated_at`, status/provider/
model/prompt/schema metadata, payload type and top-level keys only, a hashed creator ID plus
organization role, relationship validity, downstream counts and project-level dependency
counts. It never returns prompt text, source contents, payload values, titles, email
addresses or review comments.

Facts common to all 31:

- status `valid`; provider `mock`; schema version `1.0.0`; output language `th`
- model, prompt version, request key and error are null
- raw provider output is null
- creator currently has the organization `owner` role
- project is active; project/source relationships are valid; source count for the selected
  source/project pair is exactly one
- zero source references, zero traceability relations and zero workflow-state changes

### Compact 31-row index

`DB` means the exact `verify-db.mts` fingerprint. `SRC` means the exact
`verify-sources.mts` fingerprint. `UNK` means the structural mismatch is known but the
historical producer is not proven. The SQL artifact contains the full redacted per-row
metadata, including exact `created_at`.

| Run ID | Profile | Contract mismatches | Run-owned downstream | Project scope |
|---|---:|---|---|---|
| `821bc911-1120-44c2-afd8-474f8eda1252` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `c0c2c80a-150e-45a4-8cb3-8f27d25c7686` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `17334d0c-4cd1-4c9b-bba1-6144b41cf01f` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `08edaef7-5c4f-45a0-be0a-eec3a7c2818f` | UNK | missing raw; zero items | none | **mixed project** |
| `46784989-c3a8-40fc-b139-c4b239302bbf` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `21f7d406-b7d4-4fcc-9de1-0fe08843ee9f` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `ad9934d3-336b-428c-99fe-e88085c378f9` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `06781a9c-2085-4f15-89b5-f366988ea7f2` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `7db5c29d-2025-49e4-88d0-64681ae35ff8` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `e8ba0b79-9524-4ed3-892b-71355b443493` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `cc3f9892-f014-49a0-b40a-2dc5ca91faa0` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `96d79e12-b3df-4762-bf6f-f728e333d595` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `dfc66265-3267-48ef-af42-9c791d4ebab0` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `9a1bb880-0acb-4af5-b0e7-6c25183ddfa4` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `51bd729f-0e83-4356-973e-3e1f7f5f7d6a` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `d0d81e34-fe83-47f4-9bfa-5003aa23231e` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `094a26ed-718b-462b-9ec4-3ce1efc4e7ff` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `2a76ed77-7587-4fc3-a2a9-22216515637a` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `9a2dffc3-adb8-4e3c-aad0-65a52f69e546` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `f85fc5a4-febf-48e3-a1d8-bb0c0b43f366` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `f9826c3d-6588-454b-a879-d9607a6bed31` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `80f7a4d7-8e24-4376-ba38-e5d254df0e8c` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `1d1958ef-3e53-413f-88fe-032e37ab1658` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `cf281564-8b1c-4440-bd5f-c329c88a367c` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `dd8c49b0-669e-48cb-ad6e-9a82b0352f29` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `de43efff-33a3-4653-b894-b7ef4a8aaa5a` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `1a308512-86c8-4983-a017-15cb2e1578e4` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `627cb99b-3238-4e7d-a98b-4e8cd9bfa3de` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `284f7794-cc49-4754-ad70-54fd0d6cfe02` | SRC | missing raw; zero items | none | run-local; 3 project sources |
| `264579c1-d760-4503-aec2-d034697c931c` | DB | missing raw and validated | 2 BR, 1 version, 2 reviews | run-local |
| `0a6300a7-4259-439f-bf56-1745a31158cb` | SRC | missing raw; zero items | none | run-local; 3 project sources |

## Classification

| Category | Count | Confidence | Evidence | Risk if modified | Risk if preserved |
|---|---:|---|---|---|---|
| Verification/Test Data | 30 | High | 15 exact DB fingerprints and 15 exact SRC fingerprints: project/source identity, metadata, exact payload shape, script-specific item provider keys, version/review transitions and isolated dependency shape as applicable | DB profile carries verifier-created requirements and audit rows; deletion is destructive even though provenance is known. | Strict all-history validation continues to fail unless the verifier recognizes the fixed legacy set. |
| Seed or Demo Data | 0 | — | No row classified from a demo/sample name alone. | — | — |
| Plausible Real User Data | 0 | — | No unmatched user-activity fingerprint remained. | — | — |
| System-Generated Transitional Data | 0 | — | Fifteen zero-item rows matched the stronger exact SRC fingerprint; the remaining mixed-project row stays Unknown rather than being inferred transitional. | — | — |
| Unknown / Insufficient Evidence | 1 | Low | `08edaef7-…` matches the empty legacy payload shape but not either exact known verifier identity/dependency fingerprint; its project is mixed. | High: project contains other user-visible and audit records. | It remains visible and blocks strict whole-history verification. |

The 15 rows with review/version activity are still verification fixtures: the activity
shape is exactly the code path in `verify-db.mts`, which inserts two business requirements,
edits one once, and reviews it `draft -> reviewed -> approved`. Names were only a supporting
indicator and were never sufficient for classification.

## Mismatch taxonomy

Mismatch codes overlap because one row may violate more than one invariant.

| Mismatch | Count | Affected runs | Historical cause | Deterministic backfill |
|---|---:|---|---|---|
| `valid_missing_raw` | 31 | All 31 | Thirty are explained by exact direct-insert verifier fingerprints; the mixed-project row's producer is unknown. | **No.** No original raw provider output exists in any affected row and it cannot be reconstructed. |
| `valid_missing_validated` | 15 | All DB-profile IDs | `verify-db.mts` inserted the run without either payload, then inserted review-surface rows separately. | **No.** Current mutable items are not the original validated provider response. |
| `valid_has_zero_items` | 16 | 15 SRC IDs plus `08edaef7-…` | Fifteen are exact `verify-sources.mts` inserts; the mixed-project row has the same exact `{"items":[]}` payload but unknown provenance. | **No.** Copying validated to raw would fabricate raw output and still leave an incoherent valid/zero-item result. |

No rows have blank provider/schema metadata, invalid relationships, lifecycle timestamp
problems, error/success payload crossover, legacy top-level keys other than `items`, or
partially populated provider-error records.

## Dependency and impact analysis

### Run-owned dependencies

- DB profile, 15 rows: each owns two business requirements, one item-version audit row and
  two review-activity rows. Deleting the run would cascade through user-visible items and
  append-only audit history. It would not break source references or traceability
  relations because both counts are zero.
- SRC profile, 15 rows: each owns zero items, user stories, acceptance criteria,
  assumptions, risks, questions, quality findings, references, relations, versions,
  reviews or workflow transitions.
- Unknown profile, 1 row: owns no downstream rows, but its project contains extensive
  records belonging to other runs.
- All 31 are reachable through analysis history/detail routes. DB-profile items also feed
  workspace/history/project summaries and exports through their normal item queries.

### Project-level scope

Thirty rows have run-local project dependencies: the project contains no other run or
downstream item/reference/relation/version/review records beyond those owned by the
affected run.

Fifteen SRC-profile rows are in exact three-source verifier projects. The unknown row is
also in a project with multiple sources. Therefore even an isolated run never authorizes
project- or source-level deletion.

One run requires additional protection:

`08edaef7-5c4f-45a0-be0a-eec3a7c2818f`

Its own run has no downstream rows, but its project contains 6 analysis runs, 4 source
documents, 81 items, 59 source references, 28 relations, 3 item versions and 10 review
activities. Any project-level cleanup would risk unrelated user-visible and audit data.
This run is excluded from the targeted-cleanup preview below.

## Remediation decision matrix

| Option | Eligible rows | Prerequisites | Data-loss risk | Auditability / reversibility | Complexity | New-contract effect | Recommendation |
|---|---|---|---|---|---|---|---|
| A. Preserve unchanged and support legacy reads | All 31 | Exact immutable legacy ID/fingerprint registry; strict checks for post-migration rows | None | High / fully reversible code change | Low–medium | None; new writes remain strict | **Recommended** |
| B. Deterministic metadata-only backfill | None | A value derivable without inference | Low in principle | High / blocked by immutable-run design | Low | None | Not applicable; metadata is already coherent |
| C. Payload contract migration | None | Original raw/validated provider response | High; would fabricate AI history | Poor / irreversible historical rewrite | High | Risks weakening meaning | **Reject** |
| D. Mark legacy/incompatible without deleting | All 31 | Future migration or checked-in compatibility registry; exact ID/fingerprint checks | None | High / reversible | Medium | None | **Recommended companion to A** |
| E. Archive targeted rows | None currently | An archive model and product semantics that do not exist | Medium | Medium | Medium–high | Could create a second lifecycle | Do not add for this issue alone |
| F. Delete proven verification fixtures | At most 30 exact-fingerprint candidates; unknown mixed-project run excluded | Fresh dependency check, explicit approval, designed immutability exception, backup/rollback | High for 15 DB rows because audit/items cascade | Deletion is not reversible without restore | High | None, but violates preserved-history principle | Not recommended |
| G. Re-run analysis from source | Optional new runs only | Original source still valid, provider configuration, cost approval if live | No old-row loss, but semantic drift | High as a new immutable run | Medium | None | May create a new coherent run; does not remediate legacy rows |

## Recommended plan

1. Preserve all 31 legacy rows unchanged.
2. In a separate implementation step, update only verification behavior so the exact known
   legacy incompatibility set is explicitly grandfathered by ID plus structural
   fingerprint. Record 30 as proven verifier fixtures and `08edaef7-…` as preserved
   unknown; do not relabel the latter as test data. The verifier must fail if an ID changes
   shape, disappears unexpectedly, or the set grows beyond 31.
3. Continue enforcing migration 20 for every new RPC write; do not relax provider,
   status, payload, item or relation invariants.
4. Verify that application reads remain payload-safe and that no UI path renders raw
   unvalidated output.
5. Re-run `verify:analysis`. Only after it passes without creating incoherent fixtures,
   continue the remaining runtime/browser/build gates.
6. Treat cleanup as a separate CRITICAL/destructive operation only if the owner later
   prefers deletion despite the preserved-history tradeoff.

This recommendation repairs verification semantics, not historical data. It does not
fabricate missing AI output or redefine what any old run meant.

## Rows requiring explicit human approval

**Any mutation of any of the 31 rows requires new explicit approval bound to exact IDs and
the exact proposed action. No such approval has been requested or granted in this step.**

If fixture deletion were chosen later, the maximum exact-fingerprint candidate set is the
following 30 IDs. This is not a recommendation:

```text
821bc911-1120-44c2-afd8-474f8eda1252
c0c2c80a-150e-45a4-8cb3-8f27d25c7686
17334d0c-4cd1-4c9b-bba1-6144b41cf01f
46784989-c3a8-40fc-b139-c4b239302bbf
21f7d406-b7d4-4fcc-9de1-0fe08843ee9f
ad9934d3-336b-428c-99fe-e88085c378f9
06781a9c-2085-4f15-89b5-f366988ea7f2
7db5c29d-2025-49e4-88d0-64681ae35ff8
e8ba0b79-9524-4ed3-892b-71355b443493
cc3f9892-f014-49a0-b40a-2dc5ca91faa0
96d79e12-b3df-4762-bf6f-f728e333d595
dfc66265-3267-48ef-af42-9c791d4ebab0
9a1bb880-0acb-4af5-b0e7-6c25183ddfa4
51bd729f-0e83-4356-973e-3e1f7f5f7d6a
d0d81e34-fe83-47f4-9bfa-5003aa23231e
094a26ed-718b-462b-9ec4-3ce1efc4e7ff
2a76ed77-7587-4fc3-a2a9-22216515637a
9a2dffc3-adb8-4e3c-aad0-65a52f69e546
f85fc5a4-febf-48e3-a1d8-bb0c0b43f366
f9826c3d-6588-454b-a879-d9607a6bed31
80f7a4d7-8e24-4376-ba38-e5d254df0e8c
1d1958ef-3e53-413f-88fe-032e37ab1658
cf281564-8b1c-4440-bd5f-c329c88a367c
dd8c49b0-669e-48cb-ad6e-9a82b0352f29
de43efff-33a3-4653-b894-b7ef4a8aaa5a
1a308512-86c8-4983-a017-15cb2e1578e4
627cb99b-3238-4e7d-a98b-4e8cd9bfa3de
284f7794-cc49-4754-ad70-54fd0d6cfe02
264579c1-d760-4503-aec2-d034697c931c
0a6300a7-4259-439f-bf56-1745a31158cb
```

The mixed-project run `08edaef7-5c4f-45a0-be0a-eec3a7c2818f` is excluded from any
cleanup candidate set. Project- and source-level cleanup is excluded for all rows.

## SQL previews

These previews are documentation only. None was executed.

### 1. Read-only verification

The complete executable SELECT-only version is the forensic SQL artifact linked above.
Its final shape is:

```sql
-- READ-ONLY; safe to execute.
with item_stats as (...),
     reference_stats as (...),
     relation_stats as (...),
     version_stats as (...),
     review_stats as (...),
     base as (...),
     incompatible as (...),
     classified as (...)
select record_type, result
from (... summary and redacted row results ...) forensic_results;
```

### 2. Candidate deterministic backfill

No row is eligible, so no mutation statement is proposed.

```sql
-- READ-ONLY eligibility proof. Expected count: 0.
select count(*) as deterministic_backfill_candidates
from public.analysis_runs
where false;
```

### 3. Candidate legacy marking

```sql
-- DO NOT EXECUTE — REQUIRES EXPLICIT USER APPROVAL
-- Conceptual future migration preview only. Prefer an exact compatibility registry
-- over changing immutable analysis_runs or weakening migration 20.
create table public.legacy_analysis_run_compatibility (
  analysis_run_id uuid primary key references public.analysis_runs(id),
  reason text not null,
  fingerprint_version text not null,
  recorded_at timestamptz not null default now()
);

insert into public.legacy_analysis_run_compatibility
  (analysis_run_id, reason, fingerprint_version)
select
  id,
  case
    when id = '08edaef7-5c4f-45a0-be0a-eec3a7c2818f'
      then 'pre-migration-20 incompatible; provenance unknown'
    else 'proven pre-migration-20 verifier fixture'
  end,
  'phase-b-forensics-v1'
from public.analysis_runs
where id in (/* exact 31 IDs from the read-only inventory */);
```

### 4. Candidate targeted fixture cleanup

```sql
-- DO NOT EXECUTE — REQUIRES EXPLICIT USER APPROVAL
-- Conceptual exact-run preview only.
-- This DELETE is currently rejected by analysis_runs_no_delete.
-- No trigger-bypass SQL is provided. Fifteen runs would cascade items and audit rows.
delete from public.analysis_runs
where id in (
  '821bc911-1120-44c2-afd8-474f8eda1252',
  'c0c2c80a-150e-45a4-8cb3-8f27d25c7686',
  '17334d0c-4cd1-4c9b-bba1-6144b41cf01f',
  '46784989-c3a8-40fc-b139-c4b239302bbf',
  '21f7d406-b7d4-4fcc-9de1-0fe08843ee9f',
  'ad9934d3-336b-428c-99fe-e88085c378f9',
  '06781a9c-2085-4f15-89b5-f366988ea7f2',
  '7db5c29d-2025-49e4-88d0-64681ae35ff8',
  'e8ba0b79-9524-4ed3-892b-71355b443493',
  'cc3f9892-f014-49a0-b40a-2dc5ca91faa0',
  '96d79e12-b3df-4762-bf6f-f728e333d595',
  'dfc66265-3267-48ef-af42-9c791d4ebab0',
  '9a1bb880-0acb-4af5-b0e7-6c25183ddfa4',
  '51bd729f-0e83-4356-973e-3e1f7f5f7d6a',
  'd0d81e34-fe83-47f4-9bfa-5003aa23231e',
  '094a26ed-718b-462b-9ec4-3ce1efc4e7ff',
  '2a76ed77-7587-4fc3-a2a9-22216515637a',
  '9a2dffc3-adb8-4e3c-aad0-65a52f69e546',
  'f85fc5a4-febf-48e3-a1d8-bb0c0b43f366',
  'f9826c3d-6588-454b-a879-d9607a6bed31',
  '80f7a4d7-8e24-4376-ba38-e5d254df0e8c',
  '1d1958ef-3e53-413f-88fe-032e37ab1658',
  'cf281564-8b1c-4440-bd5f-c329c88a367c',
  'dd8c49b0-669e-48cb-ad6e-9a82b0352f29',
  'de43efff-33a3-4653-b894-b7ef4a8aaa5a',
  '1a308512-86c8-4983-a017-15cb2e1578e4',
  '627cb99b-3238-4e7d-a98b-4e8cd9bfa3de',
  '284f7794-cc49-4754-ad70-54fd0d6cfe02',
  '264579c1-d760-4503-aec2-d034697c931c',
  '0a6300a7-4259-439f-bf56-1745a31158cb'
);
```

### 5. Post-remediation verification

```sql
-- READ-ONLY. Run only after a separately approved remediation.
select
  count(*) filter (
    where validation_status = 'valid'
      and (
        raw_provider_output is null
        or raw_provider_output = 'null'::jsonb
        or validated_output is null
        or validated_output = 'null'::jsonb
        or error is not null
      )
  ) as incoherent_valid_rows,
  count(*) as total_runs
from public.analysis_runs;
```

This compact check must be paired with item/relation counts from the full forensic query;
it is not a substitute for the application verifier.

## Remaining blockers and Phase B recommendation

**NO-GO for Phase B completion.** This forensic step is complete, but Phase B is not.

Remaining gates:

- design and implement an exact legacy-aware verification strategy without weakening new
  writes
- re-run hosted `verify:analysis` and confirm fixture lifecycle/cleanup behavior
- finish interactive browser verification
- perform the remaining build/runtime checks
- live Gemini verification remains separate and credential-dependent

No cleanup, backfill, fixture creation, migration, production behavior change or Phase B
completion is authorized by this report.
