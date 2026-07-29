# Phase B Legacy Freeze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish ReqWiseAI Phase B with a read-only, fail-closed verifier that preserves exactly 30 proven verifier fixtures and one explicitly unknown legacy run without treating any of them as contract-valid.

**Architecture:** A version-controlled JSON manifest records exact legacy IDs, classification and safe group fingerprints. Pure TypeScript parses the manifest, canonicalizes safe query results, classifies contract-valid versus known legacy versus unexpected-invalid rows and produces privacy-safe summaries. The linked command runs the existing SELECT/CTE-only forensic SQL through the Supabase CLI with a 60-second timeout; fixture-writing integration behavior remains inaccessible to the linked mode.

**Tech Stack:** TypeScript strict · Zod 4 · Node native type stripping · Vitest · Supabase CLI · PostgreSQL SELECT/CTE

## Global Constraints

- Work only in `C:/Users/User/Desktop/ReqWiseAIwithCodex/ReqWiseAI-worktree/ReqWiseAI` on branch `reqwise-ai`.
- Preserve all 31 legacy rows unchanged.
- Do not execute linked/live `INSERT`, `UPDATE`, `DELETE`, `UPSERT`, `TRUNCATE`, DDL, seed, reset, fixture creation or migration commands.
- Do not add or apply migration 21; do not edit applied migration 20.
- Do not retrieve, return, hash or log full payloads, source text, prompts, generated bodies, credentials or personal information.
- Linked mode requires exactly 15 `verify-db`, 15 `verify-sources` and one preserved unknown ID.
- Clean mode requires zero incompatible rows.
- Invalid mode, duplicate IDs, inventory drift, fingerprint drift and unexpected invalid rows fail closed.
- Unit-test fixtures are in-memory only.
- Keep every shell/network/browser wait bounded to at most 60 seconds.
- Stage paths explicitly; never use `git add .`, `git add -A`, `commit -a`, reset, stash, clean or force operations.
- Every commit ends with `Co-Authored-By: Codex Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Pure Legacy Manifest and Verifier Contract

**Files:**
- Create: `scripts/analysis-verification/legacy-analysis-runs.json`
- Create: `lib/analysis/legacy-verifier.ts`
- Create: `tests/analysis/legacy-verifier.test.ts`

**Interfaces:**
- Consumes: safe row objects returned by `scripts/forensics/legacy-analysis-runs-readonly.sql`
- Produces:
  - `parseLegacyManifest(input: unknown): LegacyManifest`
  - `parseVerifierMode(value: string | undefined): "clean" | "linked-legacy"`
  - `verifyLegacyInventory(mode, manifest, input): LegacyInventoryResult`
  - `formatLegacyInventoryResult(result): string`

- [ ] **Step 1: Write RED tests for manifest and modes**

Test literal fixtures for:

```ts
parseVerifierMode(undefined) === "clean";
parseVerifierMode("linked-legacy") === "linked-legacy";
parseVerifierMode("anything-else"); // throws
parseLegacyManifest({ ...duplicate IDs... }); // throws
parseLegacyManifest({ ...unknown ID in fixture group... }); // throws
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
npx vitest run tests/analysis/legacy-verifier.test.ts
```

Expected: FAIL because `lib/analysis/legacy-verifier.ts` does not exist.

- [ ] **Step 3: Implement manifest parsing and fail-closed mode parsing**

Use Zod strict objects. The manifest schema contains:

```ts
type LegacyManifest = {
  version: 1;
  expectedLegacyCount: 31;
  groups: Array<{
    outcome: "known-legacy-fixture" | "known-legacy-unknown";
    origin: "verify-db.mts" | "verify-sources.mts" | "unknown";
    ids: string[];
    expectedFingerprint: SafeLegacyFingerprint;
    preservationReason: string;
  }>;
};
```

Validate 15/15/1 totals, unique IDs across groups, and the exact unknown ID
`08edaef7-5c4f-45a0-be0a-eec3a7c2818f`.

- [ ] **Step 4: Add the canonical manifest**

Copy the 15 DB IDs and 15 SRC IDs from the verified forensic report. Store only safe
contract/dependency fields and no payload values or personal data.

- [ ] **Step 5: Run focused tests GREEN**

Run the same Vitest command. Expected: manifest/mode tests pass.

### Task 2: Deterministic Safe Fingerprinting and Inventory Classification

**Files:**
- Modify: `lib/analysis/legacy-verifier.ts`
- Modify: `tests/analysis/legacy-verifier.test.ts`

**Interfaces:**
- Consumes: manifest plus redacted forensic summary/row results
- Produces four explicit outcomes:
  - `contract-valid`
  - `known-legacy-fixture`
  - `known-legacy-unknown`
  - `unexpected-invalid`

- [ ] **Step 1: Write RED behavior tests**

Add literal safe rows covering:

```text
linked exact 15/15/1 passes
legacy never reports contract-valid
extra incompatible row fails
missing expected row fails
safe fingerprint drift fails
mismatch-code drift fails
duplicate database row ID fails
unknown reclassification fails
downstream count drift fails
clean zero-incompatible passes
clean incompatible fails
extra sensitive fields are stripped and absent from formatted output
safe output contains IDs/counts only
```

- [ ] **Step 2: Confirm RED**

Run the focused test and confirm failures name missing classification/fingerprint behavior.

- [ ] **Step 3: Implement canonical fingerprints**

Build a new object containing only:

```ts
{
  classification,
  classificationConfidence,
  status,
  provider,
  model,
  promptVersion,
  schemaVersion,
  outputLang,
  payloadStructure,
  mismatchCodes: [...].sort(),
  downstreamCounts,
  projectDependencies,
  provenanceFingerprint
}
```

Recursively sort object keys, preserve explicit nulls, sort mismatch arrays and serialize
without locale-sensitive operations. Compare the canonical serialization to the manifest
fingerprint and calculate a SHA-256 digest only for safe diagnostics.

- [ ] **Step 4: Implement fail-closed classification**

Linked mode requires exact manifest/database set equality and exact fingerprint matches.
Clean mode passes only when the incompatible-row array is empty. Never auto-add IDs or
rewrite the manifest.

- [ ] **Step 5: Run focused tests GREEN**

Expected: all verifier tests pass with no secret/payload sentinel in output.

### Task 3: Read-Only Runtime Integration

**Files:**
- Modify: `scripts/forensics/legacy-analysis-runs-readonly.sql`
- Modify: `scripts/verify-analysis.mts`
- Modify: `package.json`
- Modify: `tests/analysis/legacy-verifier.test.ts`

**Interfaces:**
- Consumes: `--mode clean|linked-legacy`
- Produces: bounded SELECT-only query execution and privacy-safe aggregate report

- [ ] **Step 1: Write RED integration-boundary tests**

Test the parser against the Supabase CLI JSON envelope and prove payload/body fields are
ignored. Test that linked mode arguments select `--linked`, clean mode selects `--local`,
and command construction contains no migration, seed or mutation command.

- [ ] **Step 2: Confirm RED**

Run focused tests; expected failure is missing CLI-envelope/query-command helpers.

- [ ] **Step 3: Extend the SELECT-only summary**

Add `total_run_count` and `contract_valid_count` to the existing forensic query summary.
Keep the executable file limited to one `WITH ... SELECT`.

- [ ] **Step 4: Integrate the bounded query**

`scripts/verify-analysis.mts`:

```ts
const mode = parseVerifierMode(readModeArgument(process.argv.slice(2)));
const query = runReadOnlyForensicQuery({ mode, timeoutMs: 60_000 });
const manifest = loadAndParseManifest();
const result = verifyLegacyInventory(mode, manifest, query);
console.log(formatLegacyInventoryResult(result));
```

Linked mode returns after the read-only inventory check and never reaches fixture-writing
code. Any retained isolated fixture mode must require an explicit local-only guard and
must reject linked/non-local URLs.

- [ ] **Step 5: Make the repository command explicit**

Set `verify:analysis` to invoke `--mode linked-legacy` followed by the existing SELECT-only
ACL query. Default parser behavior remains strict clean mode.

- [ ] **Step 6: Run focused tests and Node import regression**

```powershell
npx vitest run tests/analysis/legacy-verifier.test.ts
npx vitest run tests/providers/node-runtime-import.test.ts
```

### Task 4: Static, Linked and Application Gates

**Files:**
- Inspect only unless a verified failure requires a scoped fix

**Interfaces:**
- Consumes: completed verifier
- Produces: fresh evidence for every required gate

- [ ] **Step 1: Statically validate database commands**

Confirm the forensic and ACL SQL files have no executable DDL/DML statement starts and
contain no returned raw payload/body fields.

- [ ] **Step 2: Run final static gates**

```powershell
npm test
npm run typecheck
npm run lint
git diff --check
```

Require at least 705 tests.

- [ ] **Step 3: Run linked read-only gates**

```powershell
npm run verify:analysis
npx supabase migration list --linked
```

Do not run `verify:db` or `verify:sources` because their current implementations create
linked fixtures. Record them as not run under the no-mutation contract.

- [ ] **Step 4: Reuse or start one bounded dev server**

Check ports 3000–3002. Reuse only a healthy server for this repository; otherwise start
`npm run dev` with a 60-second startup timeout and capture PID, URL and safe logs.

- [ ] **Step 5: Run bounded browser verification**

Check protected-route behavior, an existing project/run, current and preserved legacy run
rendering, relevant empty/error states, keyboard behavior, 375/1024/desktop layouts,
overflow, console and failed requests. Do not create or mutate database data.

- [ ] **Step 6: Run production gates**

```powershell
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Run a bounded local `npm run start` smoke only if no conflicting server exists and stop
only the process created by this task.

### Task 5: Review, Documentation and Logical Commits

**Files:**
- Modify: `docs/forensics/PHASE-B-LEGACY-ANALYSIS-RUNS.md`
- Modify: `HANDOFF.md`
- Include only relevant existing Phase B files

**Interfaces:**
- Consumes: fresh test/database/browser/build evidence
- Produces: reviewer-approved Phase B decision and path-specific commits

- [ ] **Step 1: Run focused security/contract self-review**

Check no mutation, migration 21, constraint weakening, arbitrary allowlist expansion,
sensitive output, secret, auto-update path, unsafe mode fallback, skipped gate or unrelated
change.

- [ ] **Step 2: Request independent targeted review**

Reviewer scope: manifest correctness, deterministic fingerprinting, modes, privacy,
fail-closed behavior, tests and database mutation risk.

- [ ] **Step 3: Resolve findings and rerun all affected gates**

After any code change rerun focused tests, full tests, typecheck, lint, build, diff check
and linked `verify:analysis`.

- [ ] **Step 4: Update only verified documentation**

Record manifest/verifier paths, 15/15/1 result, unknown ID, SELECT-only linked result,
fresh counts, browser/build result, reviewer verdict, zero mutation and remaining
limitations.

- [ ] **Step 5: Inspect and stage exact paths**

Use explicit `git add -- <paths>`, inspect `git diff --cached --name-only` and
`git diff --cached --check` before every commit.

- [ ] **Step 6: Create logical commits**

Commit relevant Phase B provider/runtime work, forensic evidence and legacy verifier in
dependency order. Do not stage the broader pre-existing portfolio-completion plan unless
its inclusion is independently justified by the final diff.

- [ ] **Step 7: Print final status and commit hashes**

Phase B is COMPLETE only if every required non-destructive gate has fresh evidence and the
reviewer has no material finding. Otherwise return NO-GO with the exact blocker.

