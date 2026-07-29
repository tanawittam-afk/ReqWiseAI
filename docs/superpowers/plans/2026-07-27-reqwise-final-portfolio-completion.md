# ReqWiseAI Final Portfolio Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete ReqWiseAI from its current Phase A export baseline through a real server-side Gemini adapter, deployment-ready demo posture, portfolio documentation, and a verified final handoff without pushing, deploying, or deleting hosted data.

**Architecture:** Preserve the existing source → provider → strict validation → normalization → atomic persistence pipeline. Add Gemini behind the current provider boundary, reuse the existing database columns and RPC, extend deployment safeguards without editing applied migrations, and finish with evidence-based portfolio surfaces and an exact-count verification record.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Zod 4 · Supabase/PostgreSQL/RLS · native server-side `fetch` · Vitest · ESLint · Tailwind CSS

## Global Constraints

- Work only in `C:/Users/User/Desktop/ReqWiseAIwithCodex/ReqWiseAI-worktree/ReqWiseAI` on branch `reqwise-ai`.
- Start from clean HEAD `1c3c3fc`; Phase A feature commit `b0c6e9c` already exists and must not be recreated.
- Do not read, print, modify, or stage `.env.local`; never print any credential value.
- Do not modify applied migrations `supabase/migrations/20260724000001_*.sql` through `20260726000019_typed_traceability.sql`.
- Database changes are limited to `supabase/migrations/20260727000020_analysis_persistence_acl_and_coherence.sql`, and that file is created/applied only after Meejai confirms the DataTam BLOCK. No migration 21 or unrelated schema work is allowed.
- Do not modify `package-lock.json`; use native `fetch`, existing Zod, and existing dependencies.
- Do not push, deploy, link an external project, create an external account, run paid setup, execute database cleanup, or rewrite Git history.
- Every user-request path must use the user-scoped Supabase client and RLS; the service-role client stays out of application request paths.
- Analysis runs, raw provider output, validated provider output, and analyzed source revisions remain immutable.
- Provider output remains untrusted until strict schema, relation, evidence, and exact-offset validation pass.
- `persist_analysis_result()` is executable by `authenticated` only: `PUBLIC`, `anon`, and the renamed internal implementation receive no execute privilege.
- Provider/status/payload coherence is enforced in PostgreSQL as well as TypeScript; malformed payload combinations are refused rather than silently ignored.
- Invalid output persists zero items; provider errors persist zero items; a valid run persists atomically.
- Gemini credentials and models are server-only. No `NEXT_PUBLIC_GEMINI_*` variable is permitted.
- AI never approves requirements, invents evidence, repairs invalid JSON, guesses offsets, or promotes domain guidance into direct evidence.
- Mock remains deterministic and is the default for development, tests, offline demo, and no-key operation.
- The analysis confirmation must visibly offer the user `Deterministic Mock` and `Gemini` as required by Master Prompt §B2; older documentation that implies hidden environment-only selection does not override this selector.
- Status and metrics in UI and documentation must come from persisted data; do not invent percentages, usage, accuracy, time savings, or user counts.
- Deferred work stays deferred: approved-requirement change requests, collaboration, comments, notifications, relation editing, server PDF, DOCX, ZIP, Jira, Drive, billing, invitations, custom profile editor, advanced analytics, and native mobile.
- Stage paths explicitly; never use `git add .`, `git add -A`, `git commit -a`, reset, stash, clean, force, or rewrite operations.
- Every commit message in this plan ends with `Co-Authored-By: Codex Fable 5 <noreply@anthropic.com>`.
- A failed critical test stops the phase: do not commit and do not begin the next phase.
- Current-tree demo credentials must be redacted without printing their value. Rotation/revocation and any Git-history remediation are protected manual actions and are not executed by this plan.

## File Responsibility Map

| Path | Responsibility |
|---|---|
| `lib/providers/types.ts` | Provider key, generation metadata, provider interface |
| `lib/providers/errors.ts` | Typed provider failure categories and safe messages |
| `lib/providers/factory.ts` | Server-only provider selection and availability |
| `lib/providers/gemini/client.ts` | Native-fetch Gemini transport, timeout, bounded transport retry, model fallback |
| `lib/providers/gemini/prompt.ts` | Product rules and exact provider JSON contract |
| `lib/providers/gemini/provider.ts` | Gemini implementation of `AiProvider` |
| `lib/config/env.ts` | Pure server environment parser and safe public availability projection |
| `lib/analysis/run-analysis.ts` | Provider generation → validation → normalization outcomes |
| `lib/analysis/persist.ts` | Provider metadata and run outcome → existing atomic RPC |
| `lib/analysis/queries.ts` | Safe run metadata for history/result UI |
| `supabase/migrations/20260727000020_analysis_persistence_acl_and_coherence.sql` | RPC ACL restoration and database-enforced provider/status/payload coherence |
| `app/workspace/projects/[projectId]/sources/[sourceId]/analyze/*` | Provider selection, availability, pending and safe error UX |
| `scripts/verify-gemini.mts` | Offline transport/prompt/provider verification and optional live checks |
| `scripts/prepare-demo.mts` | Dry-run-first deterministic demo preparation; no production request-path seeding |
| `scripts/run-db-cleanup.mts` | Double guard around the destructive SQL; never invoked in this plan |
| `docs/DEPLOYMENT.md` | Vercel-compatible setup, environment, smoke tests, rollback and manual actions |
| `docs/PORTFOLIO-CASE-STUDY.md` | Evidence-based portfolio story, trade-offs, resume and interview material |
| `docs/DEMO-SCRIPT.md` | 3–5 minute and 60–90 second product walkthroughs |
| `docs/SCREENSHOT-CHECKLIST.md` | Safe demo-data-only capture plan |
| `docs/FINAL-VERIFICATION.md` | Exact final command counts and browser/security verdicts |
| `HANDOFF.md` | Current HEAD, commit inventory, verified state, limitations, resume instructions |

---

### Task 1: Phase A Re-verification Gate

**Files:**
- Inspect: `docs/handoff/SLICE-6C-EXPORT.md`
- Inspect: `docs/architecture/EXPORT.md`
- Test: `tests/export/**/*.test.ts`
- Runtime: `scripts/verify-export.mts`

**Interfaces:**
- Consumes: Phase A commit `b0c6e9c` and current clean HEAD `1c3c3fc`
- Produces: A recorded Phase A PASS or a blocking failure report; no source change and no commit

- [ ] **Step 1: Confirm the immutable baseline**

Run:

```powershell
git status --short --branch
git log --reverse --format='%h %s' 5e7b989..HEAD
git show --name-status --format='' b0c6e9c
```

Expected:

```text
## reqwise-ai
b0c6e9c feat(reqwise): add requirements export and printable handoff
fa0bc84 docs(reqwise): record the slice 6C commit hash in the handoff
1c3c3fc docs(reqwise): add a self-contained slice 6C handoff
```

- [ ] **Step 2: Run the focused export tests**

Run:

```powershell
npx vitest run tests/export
```

Expected: all export tests pass, including contract, CSV safety, deterministic ordering, readiness, print, scope, URL, Markdown and JSON.

- [ ] **Step 3: Run the hosted export verification**

Run:

```powershell
npm run verify:export
```

Expected: `26/26` checks pass. If hosted credentials are unavailable, record the command as blocked by environment and do not replace it with a success claim.

- [ ] **Step 4: Run the Phase A regression gate**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
git status --short
```

Expected: tests, typecheck, lint and build pass; `git diff --check` prints nothing; `git status --short` prints nothing.

- [ ] **Step 5: Exercise the browser export surface**

Verify in the running app:

```text
/workspace/projects/<visible-project-id>/exports
/workspace/projects/<visible-project-id>/exports/preview
/workspace/projects/<visible-project-id>/exports/print
/workspace/projects/<visible-project-id>/exports/download/markdown
/workspace/projects/<visible-project-id>/exports/download/json
/workspace/projects/<visible-project-id>/exports/download/requirements-csv
/workspace/projects/<visible-project-id>/exports/download/questions-csv
/workspace/projects/<visible-project-id>/exports/download/findings-csv
/workspace/projects/<visible-project-id>/exports/download/traceability-csv
```

Expected: authenticated routes load; six downloads return the documented type and `Cache-Control: no-store`; invalid format is 404; another tenant is not disclosed; print is A4 and unclipped; 834 px and 390 px have no horizontal overflow.

- [ ] **Step 6: End Phase A without a commit**

Run:

```powershell
git status --short
```

Expected: no changes. Do not create a Phase A commit.

---

### Task 2: Phase B Provider Contract and Safe Error Model

**Files:**
- Modify: `lib/providers/types.ts`
- Create: `lib/providers/errors.ts`
- Modify: `lib/providers/mock/mock-provider.ts`
- Modify: `lib/analysis/run-analysis.ts`
- Test: `tests/providers/provider-contract.test.ts`
- Modify test: `tests/providers/mock-provider.test.ts`

**Interfaces:**
- Consumes: `AnalysisInput`, current `validateAnalysis()`, `normalizeAnalysis()`
- Produces: `ProviderGeneration`, `ProviderMetadata`, `ProviderExecutionError`, and metadata-bearing `RunAnalysisResult`

- [ ] **Step 1: Write failing provider contract tests**

Create `tests/providers/provider-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runAnalysis } from "../../lib/analysis/run-analysis";
import { ProviderExecutionError } from "../../lib/providers/errors";
import type { AiProvider } from "../../lib/providers/types";
import { bookingInput, testPorts } from "../helpers";

describe("provider execution contract", () => {
  it("carries provider metadata on a valid generation", async () => {
    const provider: AiProvider = {
      name: "gemini",
      deterministic: false,
      async generate() {
        const { bookingValidOutput } = await import(
          "../../lib/providers/mock/fixtures/booking-smart-space.valid"
        );
        return {
          raw: bookingValidOutput,
          metadata: {
            provider: "gemini",
            model: "configured-model-a",
            promptVersion: "reqwise-gemini/1.0",
          },
        };
      },
    };

    const result = await runAnalysis(provider, bookingInput(), testPorts());
    expect(result.status).toBe("valid");
    expect(result.metadata).toEqual({
      provider: "gemini",
      model: "configured-model-a",
      promptVersion: "reqwise-gemini/1.0",
    });
  });

  it("turns a typed transport failure into a safe provider_error", async () => {
    const provider: AiProvider = {
      name: "gemini",
      deterministic: false,
      async generate() {
        throw new ProviderExecutionError(
          "rate_limited",
          "The analysis provider is busy. Try again later.",
          { provider: "gemini", model: "configured-model-a", promptVersion: "reqwise-gemini/1.0" },
        );
      },
    };

    const result = await runAnalysis(provider, bookingInput(), testPorts());
    expect(result).toMatchObject({
      status: "provider_error",
      error: {
        category: "rate_limited",
        message: "The analysis provider is busy. Try again later.",
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/api key|stack|response body/i);
  });
});
```

- [ ] **Step 2: Run the new test and confirm RED**

Run:

```powershell
npx vitest run tests/providers/provider-contract.test.ts
```

Expected: FAIL because `ProviderExecutionError`, `ProviderGeneration`, and result metadata do not exist.

- [ ] **Step 3: Define the provider interfaces**

Implement in `lib/providers/types.ts`:

```ts
import type { AnalysisInput } from "../contracts/analysis-input";

export const PROVIDER_KEYS = ["mock", "gemini"] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

export type ProviderMetadata = {
  provider: ProviderKey;
  model: string | null;
  promptVersion: string | null;
};

export type ProviderGeneration = {
  raw: unknown;
  metadata: ProviderMetadata;
};

export interface AiProvider {
  readonly name: ProviderKey;
  readonly deterministic: boolean;
  generate(input: AnalysisInput): Promise<ProviderGeneration>;
}
```

- [ ] **Step 4: Implement the safe provider error**

Implement in `lib/providers/errors.ts`:

```ts
import type { ProviderMetadata } from "./types";

export const PROVIDER_ERROR_CATEGORIES = [
  "unavailable",
  "authentication_failed",
  "rate_limited",
  "timeout",
  "safety_refusal",
  "unknown",
] as const;

export type ProviderErrorCategory = (typeof PROVIDER_ERROR_CATEGORIES)[number];

export class ProviderExecutionError extends Error {
  constructor(
    readonly category: ProviderErrorCategory,
    message: string,
    readonly metadata: ProviderMetadata,
  ) {
    super(message);
    this.name = "ProviderExecutionError";
  }
}

export function safeProviderMessage(category: ProviderErrorCategory): string {
  switch (category) {
    case "unavailable":
      return "This analysis provider is not configured.";
    case "authentication_failed":
      return "The analysis provider could not authenticate.";
    case "rate_limited":
      return "The analysis provider is busy. Try again later.";
    case "timeout":
      return "The analysis provider took too long. Try again.";
    case "safety_refusal":
      return "The analysis provider declined this request.";
    case "unknown":
      return "The analysis provider could not produce a result. Try again.";
  }
}
```

- [ ] **Step 5: Make the mock return the common generation shape**

Change `createMockProvider().generate()` to return:

```ts
return {
  raw: generateRuntimeAnalysis(input),
  metadata: {
    provider: "mock",
    model: null,
    promptVersion: null,
  },
};
```

Update mock-provider tests to compare `generation.raw`, while continuing to prove byte-identical deterministic output.

- [ ] **Step 6: Carry metadata and typed errors through analysis**

Define `RunAnalysisResult` in `lib/analysis/run-analysis.ts` as:

```ts
export type RunAnalysisResult =
  | { status: "valid"; raw: unknown; analysis: NormalizedAnalysis; metadata: ProviderMetadata }
  | { status: "invalid"; raw: unknown; issues: ValidationIssue[]; metadata: ProviderMetadata }
  | {
      status: "provider_error";
      error: { category: ProviderErrorCategory; message: string };
      metadata: ProviderMetadata;
    };
```

Catch `ProviderExecutionError` explicitly. Map every other thrown value to category `unknown`, the safe unknown message, and metadata `{ provider: provider.name, model: null, promptVersion: null }`. Never place `err.message`, stack, source text, prompt text, or response content in the returned error.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run:

```powershell
npx vitest run tests/providers/provider-contract.test.ts tests/providers/mock-provider.test.ts tests/analysis
```

Expected: all selected tests pass.

- [ ] **Step 8: Inspect the task diff**

Run:

```powershell
git diff -- lib/providers/types.ts lib/providers/errors.ts lib/providers/mock/mock-provider.ts lib/analysis/run-analysis.ts tests/providers/provider-contract.test.ts tests/providers/mock-provider.test.ts
git diff --check
```

Expected: only the provider contract changes appear; no secret, dependency, or database change.

---

### Task 3: Phase B Gemini Prompt and Native-Fetch Client

**Files:**
- Create: `lib/providers/gemini/prompt.ts`
- Create: `lib/providers/gemini/client.ts`
- Create: `lib/providers/gemini/provider.ts`
- Test: `tests/providers/gemini-prompt.test.ts`
- Test: `tests/providers/gemini-client.test.ts`
- Test: `tests/providers/gemini-provider.test.ts`

**Interfaces:**
- Consumes: `AnalysisInput`, `providerOutputSchema`, `AUTHORED_RELATION_TYPES`, `ProviderGeneration`
- Produces: `buildGeminiPrompt(input): string`, `GeminiClient.generate(prompt)`, `createGeminiProvider(config)`

- [ ] **Step 1: Write failing prompt tests**

Create `tests/providers/gemini-prompt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildGeminiPrompt, GEMINI_PROMPT_VERSION } from "../../lib/providers/gemini/prompt";
import { bookingInput } from "../helpers";

describe("buildGeminiPrompt", () => {
  it("includes the source verbatim and the application-owned rules", () => {
    const input = bookingInput();
    const prompt = buildGeminiPrompt(input);
    expect(GEMINI_PROMPT_VERSION).toBe("reqwise-gemini/1.0");
    expect(prompt).toContain(input.sourceDocuments[0].text);
    expect(prompt).toContain(input.domainProfile.name);
    expect(prompt).toContain('"schema_version"');
    expect(prompt).toContain("Never approve a requirement");
    expect(prompt).toContain("rawText.slice(start_offset, end_offset) === excerpt");
    expect(prompt).toContain("Do not return markdown fences");
    expect(prompt).not.toMatch(/chain of thought/i);
  });

  it("keeps domain guidance distinct from direct evidence", () => {
    const prompt = buildGeminiPrompt(bookingInput());
    expect(prompt).toContain("Domain guidance is context, not direct source evidence");
    expect(prompt).toContain("assumed items have no source_references");
  });
});
```

- [ ] **Step 2: Write failing client and provider tests**

Create `tests/providers/gemini-client.test.ts` with a captured `fetch` stub:

```ts
import { describe, expect, it, vi } from "vitest";
import { createGeminiClient } from "../../lib/providers/gemini/client";

describe("Gemini client", () => {
  it("keeps the key in a server request header and returns candidate text", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"schema_version":"1.0.0"}' }] } }],
        }),
        {
          status: 200,
          headers: { "x-request-id": "request-safe-id" },
        },
      ),
    );
    const client = createGeminiClient({
      apiKey: "server-key",
      models: ["configured-model-a"],
      timeoutMs: 1_000,
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.generate("prompt")).resolves.toEqual({
      text: '{"schema_version":"1.0.0"}',
      model: "configured-model-a",
      requestId: "request-safe-id",
    });

    const [input, init] = fetchImpl.mock.calls[0];
    expect(String(input)).toContain(
      "/v1beta/models/configured-model-a:generateContent",
    );
    expect(init?.headers).toMatchObject({
      "content-type": "application/json",
      "x-goog-api-key": "server-key",
    });
    expect(JSON.stringify(init)).not.toContain("NEXT_PUBLIC");
  });
});
```

Cover these exact responses:

```text
200 candidate text containing valid JSON → returns text and configured-model-a
401 → authentication_failed, no retry
429 → rate_limited after two transport attempts
503 on model A then 200 on model B → model B succeeds
AbortError → timeout
200 with safety block and no candidate text → safety_refusal
200 malformed response → unknown
```

Create `tests/providers/gemini-provider.test.ts`. Instantiate one provider with a `fetch` stub returning a valid provider JSON candidate and a second provider whose stub returns the candidate text `not-json`. Assert:

```ts
import { createGeminiProvider } from "../../lib/providers/gemini/provider";
import { bookingValidOutput } from "../../lib/providers/mock/fixtures/booking-smart-space.valid";
import { bookingInput } from "../helpers";

const responseFor = (text: string): typeof fetch =>
  (async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text }] } }],
      }),
      { status: 200 },
    )) as typeof fetch;

const validProvider = createGeminiProvider({
  apiKey: "server-key",
  models: ["configured-model-a"],
  timeoutMs: 1_000,
  fetchImpl: responseFor(JSON.stringify(bookingValidOutput)),
});
const invalidProvider = createGeminiProvider({
  apiKey: "server-key",
  models: ["configured-model-a"],
  timeoutMs: 1_000,
  fetchImpl: responseFor("not-json"),
});

const validGeneration = await validProvider.generate(bookingInput());
const invalidGeneration = await invalidProvider.generate(bookingInput());

expect(validGeneration.raw).toMatchObject({ schema_version: "1.0.0" });
expect(validGeneration.metadata).toEqual({
  provider: "gemini",
  model: "configured-model-a",
  promptVersion: "reqwise-gemini/1.0",
});
expect(invalidGeneration.raw).toBe("not-json");
```

- [ ] **Step 3: Run the tests and confirm RED**

Run:

```powershell
npx vitest run tests/providers/gemini-prompt.test.ts tests/providers/gemini-client.test.ts tests/providers/gemini-provider.test.ts
```

Expected: FAIL because the Gemini modules do not exist.

- [ ] **Step 4: Implement the prompt from the existing contract**

In `lib/providers/gemini/prompt.ts`, export:

```ts
import { z } from "zod";
import type { AnalysisInput } from "../../contracts/analysis-input";
import { providerOutputSchema } from "../../contracts/provider-output";
import { AUTHORED_RELATION_TYPES } from "../../contracts/relations";

export const GEMINI_PROMPT_VERSION = "reqwise-gemini/1.0";

export function buildGeminiPrompt(input: AnalysisInput): string {
  const contract = z.toJSONSchema(providerOutputSchema);
  const sources = input.sourceDocuments.map((source) => ({
    key: source.key,
    title: source.title,
    rawText: source.text,
  }));

  return [
    "You are ReqWiseAI's requirements-analysis provider.",
    "Return one JSON object and nothing else. Do not return markdown fences.",
    "Never approve a requirement. Every generated item starts as application-owned draft.",
    "Never fabricate evidence or offsets.",
    "For every cited reference: rawText.slice(start_offset, end_offset) === excerpt.",
    "Domain guidance is context, not direct source evidence.",
    "Assumed items have no source_references and include a rationale.",
    `Output language: ${input.outputLang}.`,
    `Allowed relation types: ${AUTHORED_RELATION_TYPES.join(", ")}.`,
    `Domain profile: ${JSON.stringify(input.domainProfile)}.`,
    `Project context: ${JSON.stringify(input.projectContext ?? {})}.`,
    `Sources: ${JSON.stringify(sources)}.`,
    `Exact JSON contract: ${JSON.stringify(contract)}.`,
  ].join("\n\n");
}
```

The prompt must not include database organization ids, user ids, run ids, credentials, or instructions to reveal reasoning.

- [ ] **Step 5: Implement the native-fetch client**

Use this public contract in `lib/providers/gemini/client.ts`:

```ts
export type GeminiClientConfig = {
  apiKey: string;
  models: readonly [string, ...string[]];
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export type GeminiTextResult = {
  text: string;
  model: string;
  requestId: string | null;
};

export function createGeminiClient(
  config: GeminiClientConfig,
): { generate(prompt: string): Promise<GeminiTextResult> };
```

For each configured model, POST to:

```ts
const url =
  `https://generativelanguage.googleapis.com/v1beta/models/` +
  `${encodeURIComponent(model)}:generateContent`;
```

Send:

```ts
{
  contents: [{ role: "user", parts: [{ text: prompt }] }],
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0,
  },
}
```

Rules:

- Apply one `AbortController` timeout per attempt.
- Retry only 429, 500, 502, 503, 504, network failure, and timeout.
- Use at most two attempts per model and then advance to the next configured model.
- Do not retry 400, 401, 403, a safety refusal, valid-but-invalid contract output, invalid evidence, or illegal relations.
- Never log the key, prompt, response body, source text, or stack.
- Capture only the safe request id header and aggregate status internally.
- Translate every terminal failure to `ProviderExecutionError` with `safeProviderMessage()`.

- [ ] **Step 6: Implement the Gemini provider**

Export from `lib/providers/gemini/provider.ts`:

```ts
export type GeminiProviderConfig = {
  apiKey: string;
  models: readonly [string, ...string[]];
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export function createGeminiProvider(config: GeminiProviderConfig): AiProvider;
```

`generate(input)` must:

1. Build the prompt with `buildGeminiPrompt(input)`.
2. Call the client.
3. Run `JSON.parse(text)` exactly once.
4. Return the parsed value on success.
5. Return the original text on `SyntaxError`, allowing `validateAnalysis()` to classify the run as invalid.
6. Return metadata `{ provider: "gemini", model, promptVersion: GEMINI_PROMPT_VERSION }`.
7. Never strip fences, repair JSON, drop fields, modify excerpts, or derive offsets.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run:

```powershell
npx vitest run tests/providers/gemini-prompt.test.ts tests/providers/gemini-client.test.ts tests/providers/gemini-provider.test.ts tests/contracts tests/validation tests/traceability
```

Expected: all selected tests pass, including illegal relation and evidence refusals.

- [ ] **Step 8: Inspect the task diff**

Run:

```powershell
git diff -- lib/providers/gemini tests/providers
git diff --check
```

Expected: no dependency or lockfile change; no credential literal.

---

### Task 4: Phase B Server Environment Projection and Provider Factory

**Files:**
- Create: `lib/config/env.ts`
- Create: `lib/providers/factory.ts`
- Modify: `.env.example`
- Test: `tests/config/env.test.ts`
- Test: `tests/providers/factory.test.ts`

**Interfaces:**
- Consumes: `process.env` only in server modules, `createMockProvider()`, `createGeminiProvider()`
- Produces: safe `ProviderOption[]` for UI and `createProvider(key)` for the server action

- [ ] **Step 1: Write failing environment tests**

Create `tests/config/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readServerEnvironment, toProviderOptions } from "../../lib/config/env";

describe("server environment", () => {
  it("keeps Gemini optional", () => {
    const env = readServerEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      AI_PROVIDER: "mock",
    });
    expect(env.gemini).toEqual({ available: false, apiKey: null, models: [] });
    expect(toProviderOptions(env)).toEqual([
      { key: "mock", label: "Deterministic Mock", available: true },
      { key: "gemini", label: "Gemini", available: false },
    ]);
  });

  it("parses an ordered model chain without exposing the key", () => {
    const env = readServerEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      GEMINI_API_KEY: "secret",
      GEMINI_MODEL: "configured-model-a",
      GEMINI_FALLBACK_MODELS: "configured-model-b,configured-model-c",
    });
    expect(env.gemini.models).toEqual([
      "configured-model-a",
      "configured-model-b",
      "configured-model-c",
    ]);
    expect(JSON.stringify(toProviderOptions(env))).not.toContain("secret");
  });
});
```

- [ ] **Step 2: Write failing factory tests**

Create `tests/providers/factory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ServerEnvironment } from "../../lib/config/env";
import { ProviderExecutionError } from "../../lib/providers/errors";
import { createProvider, providerSelectionSchema } from "../../lib/providers/factory";

const noGeminiEnv: ServerEnvironment = {
  supabaseUrl: "https://project.supabase.co",
  supabaseAnonKey: "anon",
  applicationUrl: "http://localhost:3000",
  runtimeEnvironment: "test",
  defaultProvider: "mock",
  gemini: { available: false, apiKey: null, models: [] },
};

const geminiEnv: ServerEnvironment = {
  ...noGeminiEnv,
  gemini: {
    available: true,
    apiKey: "server-key",
    models: ["configured-model-a", "configured-model-b"],
  },
};

describe("provider factory", () => {
  it("creates mock without Gemini configuration", () => {
    expect(createProvider("mock", noGeminiEnv).name).toBe("mock");
  });

  it("refuses unavailable Gemini", () => {
    expect(() => createProvider("gemini", noGeminiEnv)).toThrow(
      ProviderExecutionError,
    );
  });

  it("creates Gemini from server configuration", () => {
    expect(createProvider("gemini", geminiEnv).name).toBe("gemini");
  });

  it("rejects every unknown selection", () => {
    expect(providerSelectionSchema.safeParse("other").success).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests and confirm RED**

Run:

```powershell
npx vitest run tests/config/env.test.ts tests/providers/factory.test.ts
```

Expected: FAIL because the environment and factory modules do not exist.

- [ ] **Step 4: Implement the pure environment parser**

Export from `lib/config/env.ts`:

```ts
export type ServerEnvironment = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  applicationUrl: string | null;
  runtimeEnvironment: "development" | "test" | "production";
  defaultProvider: "mock" | "gemini";
  gemini: {
    available: boolean;
    apiKey: string | null;
    models: string[];
  };
};

export type ProviderOption = {
  key: "mock" | "gemini";
  label: string;
  available: boolean;
};

export function readServerEnvironment(
  source: Record<string, string | undefined> = process.env,
): ServerEnvironment;

export function toProviderOptions(env: ServerEnvironment): ProviderOption[];
```

Validation rules:

- Supabase URL and anon key are required.
- `NODE_ENV` maps only to development, test or production.
- `AI_PROVIDER` accepts only mock or gemini and defaults to mock.
- Gemini is available only when the server key and at least one configured model are non-empty.
- Split `GEMINI_FALLBACK_MODELS` by comma, trim, remove blanks and de-duplicate while preserving order.
- `APPLICATION_URL` is optional during build and required by the Phase C production-start check.
- Error messages name missing variable names but never values.

- [ ] **Step 5: Implement the provider factory**

Export from `lib/providers/factory.ts`:

```ts
import { z } from "zod";

export const providerSelectionSchema = z.enum(["mock", "gemini"]);

export function createProvider(
  key: "mock" | "gemini",
  env: ServerEnvironment,
  fetchImpl?: typeof fetch,
): AiProvider;
```

Behavior:

- `mock` always returns `createMockProvider()`.
- `gemini` throws category `unavailable` when key or model chain is absent.
- `gemini` calls `createGeminiProvider()` with `timeoutMs: 30_000`.
- No browser-importable module imports `lib/config/env.ts`.

- [ ] **Step 6: Update the environment example without a real value**

Replace the stale AI section in `.env.example` with:

```dotenv
# --- AI provider (server only) ---
AI_PROVIDER=mock
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_FALLBACK_MODELS=

# --- Application runtime ---
APPLICATION_URL=http://localhost:3000
```

Do not add a `NEXT_PUBLIC_` Gemini variable.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run:

```powershell
npx vitest run tests/config/env.test.ts tests/providers/factory.test.ts
npm run typecheck
```

Expected: all selected tests and typecheck pass.

- [ ] **Step 8: Inspect the task diff and secret surface**

Run:

```powershell
git diff -- .env.example lib/config/env.ts lib/providers/factory.ts tests/config/env.test.ts tests/providers/factory.test.ts
rg -n "NEXT_PUBLIC_GEMINI|AIza|GEMINI_API_KEY=.+" --glob '!node_modules/**' --glob '!.next/**' --glob '!.env.local'
git diff --check
```

Expected: the secret scan prints no real key and no public Gemini variable.

---

### Task 5: Phase B Database ACL and Provider/Payload Coherence Gate

**Files:**
- Create: `supabase/migrations/20260727000020_analysis_persistence_acl_and_coherence.sql`
- Test: `tests/contracts/persistence-boundary.test.ts`
- Modify: `scripts/verify-analysis.mts`
- Create: `scripts/verify-analysis-acl.sql`
- Modify: `package.json`
- Inspect: `scripts/verify-db-cleanup.sql`
- Inspect: `scripts/verify-db-cleanup-dryrun.sql`

**Interfaces:**
- Consumes: migration 19's exact 14-argument `public.persist_analysis_result(uuid,uuid,text,text,text,text,text,output_lang,run_validation_status,jsonb,jsonb,jsonb,jsonb,jsonb)` and Meejai's confirmed DataTam BLOCK
- Produces: mandatory migration 20 with coherence guards, authenticated-only execution, catalog ACL proof, and runtime payload-matrix proof

- [ ] **Step 1: Record the confirmed gate**

Record Meejai's confirmed findings in the Task Contract:

```text
the recreated 14-argument persist_analysis_result() lacks the required final ACL restoration
provider/status/payload combinations can be accepted or ignored without a coherent database contract
migration 20 is mandatory
the provider value must be nonblank but must not be allowlisted in PostgreSQL
idempotency context must not be expanded
```

Do not create a different migration or edit migrations 1–19.

- [ ] **Step 2: Write the failing static boundary test**

Create `tests/contracts/persistence-boundary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260727000020_analysis_persistence_acl_and_coherence.sql";

describe("analysis persistence database boundary", () => {
  it("replaces the exact signature and grants execution only to authenticated", () => {
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();
    expect(sql).toContain("create or replace function persist_analysis_result");
    expect(sql).toContain("revoke execute on function persist_analysis_result");
    expect(sql).toContain("grant execute on function persist_analysis_result");
    expect(sql).toMatch(/grant execute[\s\S]+to authenticated/);
    expect(sql).not.toMatch(/grant execute[\s\S]+to (public|anon)/);
  });

  it("rejects incoherent status and payloads without provider allowlisting", () => {
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();
    expect(sql).toContain("provider/status/payload contract");
    expect(sql).toContain("nullif(btrim(p_provider), '') is null");
    expect(sql).toContain("nullif(btrim(p_schema_version), '') is null");
    expect(sql).toContain("jsonb_typeof(p_items) <> 'array'");
    expect(sql).toContain("jsonb_typeof(p_relations) <> 'array'");
    expect(sql).toContain("when 'valid'::run_validation_status");
    expect(sql).toContain("when 'invalid'::run_validation_status");
    expect(sql).toContain("when 'provider_error'::run_validation_status");
    expect(sql).not.toContain("p_provider not in");
  });
});
```

- [ ] **Step 3: Run the test and confirm RED**

Run:

```powershell
npx vitest run tests/contracts/persistence-boundary.test.ts
```

Expected: FAIL because migration 20 does not exist.

- [ ] **Step 4: Create migration 20 from the exact current function**

Read the canonical current body:

```powershell
git show 1c3c3fc:supabase/migrations/20260726000019_typed_traceability.sql
```

Create `supabase/migrations/20260727000020_analysis_persistence_acl_and_coherence.sql` with `CREATE OR REPLACE FUNCTION` and the exact existing signature:

```sql
create or replace function public.persist_analysis_result(
  p_project           uuid,
  p_source            uuid,
  p_request_key       text,
  p_provider          text,
  p_model             text,
  p_prompt_version    text,
  p_schema_version    text,
  p_output_lang       output_lang,
  p_validation_status run_validation_status,
  p_raw_output        jsonb,
  p_validated_output  jsonb,
  p_error             jsonb,
  p_items             jsonb default '[]'::jsonb,
  p_relations         jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
```

Retain migration 19's declarations, authorization, idempotency, inserts, display-id allocation, evidence and typed-relation logic exactly. Do not rename the function, create an unchecked helper, allowlist providers, add columns/constraints, or expand the idempotency comparison.

- [ ] **Step 5: Add the mandatory coherence guards at the start of the function**

Immediately after `begin`, before authentication, idempotency, or inserts, add:

```sql
  -- provider/status/payload contract
  if nullif(btrim(p_provider), '') is null
     or nullif(btrim(p_schema_version), '') is null then
    raise exception 'provider and schema version are required'
      using errcode = 'check_violation';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_typeof(p_relations) <> 'array' then
    raise exception 'analysis items and relations must be arrays'
      using errcode = 'check_violation';
  end if;

  case p_validation_status
    when 'valid'::run_validation_status then
      if p_raw_output is null
         or p_raw_output = 'null'::jsonb
         or p_validated_output is null
         or p_validated_output = 'null'::jsonb
         or p_error is not null
         or jsonb_array_length(p_items) = 0 then
        raise exception 'valid analysis payload is incoherent'
          using errcode = 'check_violation';
      end if;

    when 'invalid'::run_validation_status then
      if p_raw_output is null
         or p_raw_output = 'null'::jsonb
         or p_validated_output is not null
         or p_error is null
         or p_error = 'null'::jsonb
         or jsonb_array_length(p_items) <> 0
         or jsonb_array_length(p_relations) <> 0 then
        raise exception 'invalid analysis payload is incoherent'
          using errcode = 'check_violation';
      end if;

    when 'provider_error'::run_validation_status then
      if p_raw_output is not null
         or p_validated_output is not null
         or p_error is null
         or p_error = 'null'::jsonb
         or jsonb_array_length(p_items) <> 0
         or jsonb_array_length(p_relations) <> 0 then
        raise exception 'provider-error analysis payload is incoherent'
          using errcode = 'check_violation';
      end if;
  end case;
```

Do not constrain `p_provider` to mock/Gemini, require model metadata, interpret error categories, add table constraints, or change the idempotency comparison.

- [ ] **Step 6: Restore the exact ACL**

Append:

```sql
revoke execute on function public.persist_analysis_result(
  uuid, uuid, text, text, text, text, text, output_lang, run_validation_status,
  jsonb, jsonb, jsonb, jsonb, jsonb
) from public;

revoke execute on function public.persist_analysis_result(
  uuid, uuid, text, text, text, text, text, output_lang, run_validation_status,
  jsonb, jsonb, jsonb, jsonb, jsonb
) from anon;

grant execute on function public.persist_analysis_result(
  uuid, uuid, text, text, text, text, text, output_lang, run_validation_status,
  jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;
```

The function owner retains ownership privileges. Do not rename the function, create an unchecked helper, or grant execution to any other API role.

- [ ] **Step 7: Add runtime checks before applying the migration**

Extend `scripts/verify-analysis.mts` with:

```text
existing analysis_runs rows satisfy the proposed provider/status/payload constraints
anonymous RPC execution is refused at the ACL boundary
authenticated coherent mock-valid payload succeeds
catalog ACL reports authenticated=true, anon=false and PUBLIC=false
authenticated coherent invalid payload succeeds with zero item and relation rows
authenticated coherent provider-error payload succeeds with zero item and relation rows
blank provider is refused with zero run rows
blank schema version is refused with zero run rows
non-array items or relations are refused with zero run rows
valid without validated output is refused with zero run rows
invalid carrying items is refused with zero run rows
provider_error carrying raw output is refused with zero run rows
same-context replay returns the original run
replay with a different source, provider or output language is refused
```

For anonymous ACL verification use an unsigned anon client:

```ts
const anonymous = createClient(URL_, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonymousResult = await anonymous.rpc("persist_analysis_result", coherentPayload);
const message = refused(anonymousResult, "anonymous persistence RPC");
assert(
  /permission denied|not found|schema cache/i.test(message),
  `anonymous reached the function body: ${message}`,
);
assert(!/authentication required/i.test(message), "PUBLIC still has execute privilege");
```

For every refused payload, query `analysis_runs` by its unique request key through the authenticated user's client and assert the count is zero. Do not enforce a provider allow-list, provider-specific model requirements, error-category allow-list, or a larger idempotency context in SQL.

The preflight inventory check reads `provider`, `model`, `prompt_version`, `validation_status`, `raw_provider_output`, `validated_output`, and `error` through the server-only verification client and applies the exact two proposed CHECK expressions in TypeScript. It prints aggregate row counts only, never raw output or error bodies.

- [ ] **Step 8: Run offline tests and confirm GREEN**

Run:

```powershell
npx vitest run tests/contracts/persistence-boundary.test.ts tests/analysis
npm run typecheck
git diff --check
```

Expected: the static boundary test and application tests pass before hosted schema mutation.

- [ ] **Step 9: Obtain Human Approval immediately before applying migration 20**

Present:

```text
target: the linked ReqWiseAI Supabase project
artifact: 20260727000020_analysis_persistence_acl_and_coherence.sql
effect: replace the current RPC body in place with provider/status/payload coherence guards, revoke PUBLIC/anon execution, and grant only authenticated execution
rollback: create a new rollback migration restoring the previous function body while retaining the authenticated-only ACL; never edit migration history
verification: ACL/catalog, coherent/incoherent payload matrix and idempotency runtime checks plus the full database/analysis/traceability suites
```

Do not apply the migration until Rancandel records explicit Human Approval bound to this exact migration version and action.

- [ ] **Step 10: Apply only migration 20 after approval**

Run:

```powershell
npx supabase db push
```

Expected: only `20260727000020_analysis_persistence_acl_and_coherence.sql` is pending and applied. If any other migration is listed, cancel without applying.

- [ ] **Step 11: Run post-migration verification**

Run:

```powershell
npm run verify:db
npm run verify:analysis
npm run verify:traceability
npm run verify:export
```

Expected: all prior checks plus the eleven new persistence-boundary checks pass. Record exact totals.

- [ ] **Step 12: Keep cleanup fixture patterns synchronized**

The new runtime checks use the existing analysis-verification account and project prefixes. Confirm both cleanup SQL files still match those prefixes; change neither when no new prefix was introduced.

- [ ] **Step 13: Inspect the migration diff**

Run:

```powershell
git diff -- supabase/migrations/20260727000020_analysis_persistence_acl_and_coherence.sql tests/contracts/persistence-boundary.test.ts scripts/verify-analysis.mts scripts/verify-db-cleanup.sql scripts/verify-db-cleanup-dryrun.sql
git diff --check
```

Expected: migration 20 is the only migration change and contains the in-place coherence contract, exact ACL and no data cleanup.

---

### Task 6: Phase B Orchestration, Persistence Metadata, and Safe Read Model

**Files:**
- Modify: `lib/analysis/persist.ts`
- Modify: `lib/analysis/queries.ts`
- Modify: `tests/analysis/persist.test.ts`
- Modify: `tests/analysis/queries.test.ts`
- Modify: `scripts/verify-analysis.mts`

**Interfaces:**
- Consumes: metadata-bearing `RunAnalysisResult`
- Produces: existing `persist_analysis_result()` arguments with actual provider/model/prompt and safe run history metadata

- [ ] **Step 1: Add failing persistence metadata tests**

In `tests/analysis/persist.test.ts`, add:

```ts
it("persists the actual provider metadata instead of hardcoding mock", async () => {
  const result: RunAnalysisResult = {
    status: "provider_error",
    error: { category: "timeout", message: "The analysis provider took too long. Try again." },
    metadata: {
      provider: "gemini",
      model: "configured-model-b",
      promptVersion: "reqwise-gemini/1.0",
    },
  };
  const client = clientWith({
    data: { run_id: "run-g", validation_status: "provider_error", duplicate: false },
  });

  await persistAnalysisResult(
    client,
    PROJECT,
    SOURCE,
    "request-key-gemini",
    bookingInput(),
    result,
  );

  expect(client.rpcCalls[0].args).toMatchObject({
    p_provider: "gemini",
    p_model: "configured-model-b",
    p_prompt_version: "reqwise-gemini/1.0",
    p_validation_status: "provider_error",
    p_items: [],
  });
});
```

Update every existing inline `RunAnalysisResult` fixture to include metadata and the safe structured error.

- [ ] **Step 2: Add failing query tests**

Extend the run fixture in `tests/analysis/queries.test.ts` with:

```ts
provider: "gemini",
model: "configured-model-b",
prompt_version: "reqwise-gemini/1.0",
```

Assert:

```ts
expect(detail).toMatchObject({
  provider: "gemini",
  model: "configured-model-b",
  promptVersion: "reqwise-gemini/1.0",
});
expect(rows[0]).toMatchObject({
  provider: "gemini",
  model: "configured-model-b",
});
```

- [ ] **Step 3: Run the tests and confirm RED**

Run:

```powershell
npx vitest run tests/analysis/persist.test.ts tests/analysis/queries.test.ts
```

Expected: FAIL because persistence is hardcoded to mock and queries do not select provider metadata.

- [ ] **Step 4: Pass metadata to the existing RPC**

In `lib/analysis/persist.ts`, use:

```ts
const common = {
  p_project: projectId,
  p_source: sourceId,
  p_request_key: requestKey,
  p_provider: result.metadata.provider,
  p_model: result.metadata.model,
  p_prompt_version: result.metadata.promptVersion,
  p_schema_version: PROVIDER_SCHEMA_VERSION,
  p_output_lang: input.outputLang,
};
```

For provider errors persist:

```ts
p_error: {
  category: result.error.category,
  message: result.error.message,
},
```

Keep `p_items: []`, `p_relations: []`, `p_raw_output: null`, and `p_validated_output: null`. Do not alter the RPC or any migration.

- [ ] **Step 5: Extend safe run queries**

Add to `AnalysisRunSummary`:

```ts
provider: "mock" | "gemini";
model: string | null;
```

Add to `AnalysisRunDetail`:

```ts
provider: "mock" | "gemini";
model: string | null;
promptVersion: string | null;
```

Select and map `provider, model, prompt_version`. Extend `safeErrorSummary()` to map the stored categories to the same safe messages; never return the stored provider message verbatim.

- [ ] **Step 6: Extend runtime persistence verification**

Add one check to `scripts/verify-analysis.mts` that persists a simulated Gemini provider-error outcome with:

```ts
metadata: {
  provider: "gemini",
  model: "configured-model-a",
  promptVersion: "reqwise-gemini/1.0",
}
```

Read the row back and assert:

```ts
assert(row.provider === "gemini", `provider is ${row.provider}`);
assert(row.model === "configured-model-a", `model is ${row.model}`);
assert(row.prompt_version === "reqwise-gemini/1.0", `prompt version is ${row.prompt_version}`);
assert(itemCount === 0, `provider-error run wrote ${itemCount} items`);
```

- [ ] **Step 7: Run focused tests and runtime verification**

Run:

```powershell
npx vitest run tests/analysis
npm run verify:analysis
```

Expected: all analysis tests pass and the runtime script reports its new exact total with every check passing.

- [ ] **Step 8: Inspect the task diff**

Run:

```powershell
git diff -- lib/analysis/persist.ts lib/analysis/queries.ts tests/analysis scripts/verify-analysis.mts
git diff --check
```

Expected: no migration change, no partial-persistence path, no raw provider error in the read model.

---

### Task 7: Phase B Provider Selection and Analysis History UI

**Files:**
- Modify: `app/workspace/projects/[projectId]/sources/[sourceId]/analyze/page.tsx`
- Modify: `app/workspace/projects/[projectId]/sources/[sourceId]/analyze/confirm-form.tsx`
- Modify: `app/workspace/projects/[projectId]/sources/[sourceId]/analyze/actions.ts`
- Modify: `app/workspace/projects/[projectId]/sources/[sourceId]/page.tsx`
- Modify: `app/workspace/projects/[projectId]/analyses/[runId]/page.tsx`
- Modify: `app/workspace/projects/[projectId]/analyses/[runId]/_components/inspector.tsx`
- Test: `tests/providers/selection.test.ts`
- Modify test: `tests/analysis/queries.test.ts`

**Interfaces:**
- Consumes: `ProviderOption[]`, `providerSelectionSchema`, `createProvider()`, safe query metadata
- Produces: explicit mock/Gemini selection, safe unavailable state, actual provider label in run history

- [ ] **Step 1: Write failing selection tests**

Create `tests/providers/selection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { providerSelectionSchema } from "../../lib/providers/factory";

describe("analysis provider selection", () => {
  it("accepts only application-owned provider keys", () => {
    expect(providerSelectionSchema.safeParse("mock").success).toBe(true);
    expect(providerSelectionSchema.safeParse("gemini").success).toBe(true);
    expect(providerSelectionSchema.safeParse("service-role").success).toBe(false);
    expect(providerSelectionSchema.safeParse("").success).toBe(false);
  });
});
```

Add a source-history query assertion that provider and model are available without raw provider output or actor ids.

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
npx vitest run tests/providers/selection.test.ts tests/analysis/queries.test.ts
```

Expected: FAIL until factory and query metadata are wired.

- [ ] **Step 3: Render server-derived provider options**

In the analyze page:

```ts
const environment = readServerEnvironment();
const providerOptions = toProviderOptions(environment);
```

Pass `providerOptions` and `defaultProvider` to `AnalyzeConfirmForm`. Pass booleans and labels only; never pass the API key, configured model list, full environment, or server error.

- [ ] **Step 4: Add accessible selection and unavailable text**

The form must render a fieldset:

```tsx
<fieldset className="flex flex-col gap-3">
  <legend className="text-sm font-semibold text-text">Analysis provider</legend>
  {providerOptions.map((option) => (
    <label key={option.key} className="flex min-h-11 items-start gap-3">
      <input
        type="radio"
        name="provider"
        value={option.key}
        defaultChecked={option.key === defaultProvider && option.available}
        disabled={!option.available}
      />
      <span>
        <span className="block text-sm font-medium">{option.label}</span>
        {!option.available && option.key === "gemini" ? (
          <span className="block text-xs text-text-muted">
            Gemini is not available in this workspace. Choose Deterministic Mock or try again later.
          </span>
        ) : null}
      </span>
    </label>
  ))}
</fieldset>
```

Keep the existing request key behavior and pending button. The default falls back to mock when the configured default is unavailable.

- [ ] **Step 5: Validate and instantiate on the server**

In `analyzeSourceAction()`:

```ts
const selected = providerSelectionSchema.safeParse(formData.get("provider"));
if (!selected.success) {
  return { error: "Choose an available analysis provider and try again." };
}

const environment = readServerEnvironment();
let provider: AiProvider;
try {
  provider = createProvider(selected.data, environment);
} catch {
  return { error: "This analysis provider is not configured." };
}
```

Continue to build the analysis input from the database, run the common pipeline, and persist through the user-scoped client. Do not accept source text, domain profile, organization id, actor id, model name, or API key from the form.

- [ ] **Step 6: Display actual provider metadata**

On source history rows show:

```text
Deterministic Mock
Gemini
```

On the analysis header show the same stored provider label. Keep the stored model available to server-side diagnostics and verification, but do not render it in the UI. Do not show API request ids, prompt text, raw output, token counts, fallback-chain details, or provider error bodies.

Replace the stale inspector claim that every relation is `derives_from` with:

```text
Relations are typed by the provider and validated against the application pair matrix.
Legacy derives_from rows remain visible without being reclassified.
```

- [ ] **Step 7: Run focused tests and the browser flow**

Run:

```powershell
npx vitest run tests/providers tests/analysis
npm run typecheck
npm run lint
```

Browser expectations:

```text
Mock is available and selected by default.
Gemini is disabled with a safe sentence when configuration is absent.
Submitting mock creates a mock run.
Pending disables resubmission while preserving the request key.
Run history shows the persisted provider.
No console error and no secret appears in page source or network form data.
```

- [ ] **Step 8: Inspect the UI diff**

Run:

```powershell
git diff -- app/workspace/projects lib/providers tests/providers
git diff --check
```

Expected: provider selection is a server-validated choice, not a client-trusted provider configuration.

---

### Task 8: Phase B Verification Script, Documentation, and Phase Commit

**Files:**
- Create: `scripts/verify-gemini.mts`
- Modify: `package.json`
- Modify: `docs/architecture/ARCHITECTURE.md`
- Modify: `docs/architecture/AI-OUTPUT-CONTRACT.md`
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: complete Phase B implementation and mockable native-fetch client
- Produces: offline Gemini verification, optional live verification status, Phase B commit

- [ ] **Step 1: Create the Gemini verifier**

Implement `scripts/verify-gemini.mts` with a local `check(name, fn)` harness and these ten exact checks:

```text
1. prompt contains Thai source verbatim
2. prompt contains English source verbatim
3. prompt preserves mixed Thai/English source
4. mocked valid JSON passes the full validation pipeline
5. malformed JSON becomes an invalid result with zero normalized items
6. unknown relation becomes invalid
7. exact-evidence mismatch becomes invalid
8. 429 is bounded and translated to rate_limited
9. 503 advances through the configured model chain
10. no key, prompt, full source or raw response is present in safe errors
```

At the end:

```ts
if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) {
  console.log("Live Gemini verification pending — credential unavailable");
} else {
  console.log("Live Gemini verification requires the protected manual gate documented in HANDOFF.md");
}
```

The script does not perform a live call automatically.

- [ ] **Step 2: Add the package command**

Add to `package.json`:

```json
"verify:gemini": "node scripts/verify-gemini.mts"
```

Do not change dependencies or `package-lock.json`.

- [ ] **Step 3: Update architecture documentation**

Document:

```text
factory-selected server-only providers
native-fetch Gemini client
ordered configured model chain
strict JSON with zero repair
exact evidence validation
typed relation validation
bounded transport retry
provider metadata persistence
safe error projection
mock default and no-key behavior
```

Update the stale “gemini later” descriptions. Do not claim a live call unless the protected live gate has actually run.

- [ ] **Step 4: Update the Phase B handoff state**

Record exact commands and results, provider files, environment variable names, runtime total, browser result, and:

```text
Live Gemini verification pending — credential unavailable
```

when the live gate did not run. Do not include environment values or demo credentials.

- [ ] **Step 5: Run the Phase B gate**

Run:

```powershell
npm run verify:gemini
npm run verify:analysis
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: every automated command passes; `verify:gemini` reports 10/10 offline checks and an honest live status.

- [ ] **Step 6: Review the complete Phase B diff**

Run:

```powershell
git diff --stat
git diff -- . ':!HANDOFF.md'
git status --short
rg -n "NEXT_PUBLIC_GEMINI|AIza|GEMINI_API_KEY=.+" --glob '!node_modules/**' --glob '!.next/**' --glob '!.env.local'
```

Expected: no applied migration, dependency, lockfile, secret, service-role request path, or unrelated file.

- [ ] **Step 7: Stage Phase B paths explicitly**

Run:

```powershell
git add -- .env.example package.json
git add -- lib/config/env.ts lib/providers/types.ts lib/providers/errors.ts lib/providers/factory.ts
git add -- lib/providers/mock/mock-provider.ts lib/providers/gemini/client.ts lib/providers/gemini/prompt.ts lib/providers/gemini/provider.ts
git add -- lib/analysis/run-analysis.ts lib/analysis/persist.ts lib/analysis/queries.ts
git add -- 'app/workspace/projects/[projectId]/sources/[sourceId]/analyze/page.tsx'
git add -- 'app/workspace/projects/[projectId]/sources/[sourceId]/analyze/confirm-form.tsx'
git add -- 'app/workspace/projects/[projectId]/sources/[sourceId]/analyze/actions.ts'
git add -- 'app/workspace/projects/[projectId]/sources/[sourceId]/page.tsx'
git add -- 'app/workspace/projects/[projectId]/analyses/[runId]/page.tsx'
git add -- 'app/workspace/projects/[projectId]/analyses/[runId]/_components/inspector.tsx'
git add -- scripts/verify-analysis.mts scripts/verify-gemini.mts
git add -- tests/config/env.test.ts tests/contracts/persistence-boundary.test.ts
git add -- tests/providers/provider-contract.test.ts tests/providers/mock-provider.test.ts tests/providers/gemini-prompt.test.ts tests/providers/gemini-client.test.ts tests/providers/gemini-provider.test.ts tests/providers/factory.test.ts tests/providers/selection.test.ts
git add -- tests/analysis/persist.test.ts tests/analysis/queries.test.ts
git add -- supabase/migrations/20260727000020_analysis_persistence_acl_and_coherence.sql
git add -- docs/architecture/ARCHITECTURE.md docs/architecture/AI-OUTPUT-CONTRACT.md HANDOFF.md
git diff --cached --name-only
git diff --cached --check
```

Expected: only Phase B files are staged. If another path appears, unstage that exact path before continuing.

- [ ] **Step 8: Commit Phase B**

Run:

```powershell
git commit -m "feat(reqwise): integrate Gemini requirements provider" -m "Co-Authored-By: Codex Fable 5 <noreply@anthropic.com>"
git status --short --branch
```

Expected: commit succeeds and the working tree is clean.

---

### Task 9: Phase C Production Environment Contract and Security Headers

**Files:**
- Modify: `lib/config/env.ts`
- Modify: `tests/config/env.test.ts`
- Create: `instrumentation.ts`
- Modify: `next.config.ts`
- Modify: `proxy.ts`
- Test: `tests/deployment/headers.test.ts`
- Create: `scripts/verify-deployment.mts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Phase B `ServerEnvironment`, request URL, Supabase browser origin
- Produces: production-start assertion, nonce-based CSP, authenticated no-store responses, deployment verifier

- [ ] **Step 1: Write failing production environment tests**

Add to `tests/config/env.test.ts`:

```ts
import { assertProductionEnvironment } from "../../lib/config/env";

it("requires an application URL only for production start", () => {
  const base = {
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "anon",
    applicationUrl: null,
    runtimeEnvironment: "production" as const,
    defaultProvider: "mock" as const,
    gemini: { available: false, apiKey: null, models: [] },
  };
  expect(() => assertProductionEnvironment(base)).toThrow(/APPLICATION_URL/);
  expect(() =>
    assertProductionEnvironment({ ...base, applicationUrl: "https://reqwise.example" }),
  ).not.toThrow();
});
```

- [ ] **Step 2: Write failing header tests**

Create `tests/deployment/headers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, securityHeaders } from "../../lib/config/security-headers";

describe("production security headers", () => {
  it("uses a nonce for scripts and restricts framing", () => {
    const csp = buildContentSecurityPolicy("nonce-value", "https://project.supabase.co");
    expect(csp).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(csp).toContain("connect-src 'self' https://project.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
    expect(csp).not.toContain("https://generativelanguage.googleapis.com");
  });

  it("sets browser hardening headers", () => {
    expect(securityHeaders("nonce-value", "https://project.supabase.co")).toEqual(
      expect.arrayContaining([
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
      ]),
    );
  });
});
```

- [ ] **Step 3: Run the tests and confirm RED**

Run:

```powershell
npx vitest run tests/config/env.test.ts tests/deployment/headers.test.ts
```

Expected: FAIL because the production assertion and security-header module do not exist.

- [ ] **Step 4: Add the production-start assertion**

Export from `lib/config/env.ts`:

```ts
export function assertProductionEnvironment(env: ServerEnvironment): void {
  if (env.runtimeEnvironment !== "production") return;
  if (!env.applicationUrl) {
    throw new Error("APPLICATION_URL is required for production start.");
  }
  const url = new URL(env.applicationUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("APPLICATION_URL must use HTTPS outside localhost.");
  }
  if (env.defaultProvider === "gemini" && !env.gemini.available) {
    throw new Error(
      "AI_PROVIDER=gemini requires GEMINI_API_KEY and at least one configured Gemini model.",
    );
  }
}
```

Create root `instrumentation.ts`:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionEnvironment, readServerEnvironment } = await import(
    "./lib/config/env"
  );
  assertProductionEnvironment(readServerEnvironment());
}
```

This is the Next 16 server-start hook documented in the repository's installed Next guides. It must not run in a client component and must not make optional Gemini configuration mandatory when the default is mock.

- [ ] **Step 5: Implement nonce-based security headers**

Create `lib/config/security-headers.ts`:

```ts
export function buildContentSecurityPolicy(
  nonce: string,
  supabaseOrigin: string,
): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function securityHeaders(nonce: string, supabaseOrigin: string) {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(nonce, supabaseOrigin) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
}
```

The documented exception is `style-src 'unsafe-inline'`, required by current Next/React style handling. Scripts use a nonce and never permit `unsafe-inline` or `unsafe-eval`. Gemini is server-to-server and therefore absent from browser `connect-src`.

- [ ] **Step 6: Attach the nonce and private cache policy in `proxy.ts`**

Before creating the response:

```ts
const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
const requestHeaders = new Headers(request.headers);
requestHeaders.set("x-nonce", nonce);
```

Create `NextResponse.next({ request: { headers: requestHeaders } })`, preserve the existing Supabase cookie refresh logic, and set every `securityHeaders()` entry on the response.

For `/workspace` and descendants set:

```ts
response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
```

Keep redirects and refreshed cookies working. Do not add Gemini or service-role values to request or response headers.

- [ ] **Step 7: Keep static configuration minimal**

In `next.config.ts`, retain typed `NextConfig` and add only stable non-nonce headers that are safe on static assets:

```ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
};
```

Nonce and request-specific CSP remain in `proxy.ts`.

- [ ] **Step 8: Add the deployment verifier**

Implement `scripts/verify-deployment.mts` with these exact offline checks:

```text
1. missing production APPLICATION_URL is refused
2. HTTP production URL outside localhost is refused
3. missing optional Gemini key does not break mock configuration
4. Gemini default without key/model is refused
5. CSP contains a script nonce and strict-dynamic
6. CSP excludes browser Gemini connectivity
7. workspace cache policy is private/no-store
8. frame, referrer, content-type and permissions headers are present
```

Add:

```json
"verify:deployment": "node scripts/verify-deployment.mts"
```

- [ ] **Step 9: Run focused tests and confirm GREEN**

Run:

```powershell
npx vitest run tests/config tests/deployment
npm run verify:deployment
npm run typecheck
npm run lint
npm run build
```

Expected: all commands pass and the deployment verifier reports `8/8`.

- [ ] **Step 10: Verify headers in the running app**

Run the application and inspect:

```text
/sign-in has CSP, nosniff, referrer and frame headers
/workspace redirects when signed out
/workspace has private, no-store after sign-in
Supabase session refresh still works
page scripts carry the current nonce
Gemini key/model are absent from response headers and page source
```

---

### Task 10: Phase C Dry-run-first Demo Preparation

**Files:**
- Create: `scripts/prepare-demo.mts`
- Test: `tests/deployment/demo-plan.test.ts`
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: an existing demo user supplied out-of-band and the user-scoped services
- Produces: deterministic dry-run report; an explicitly guarded apply mode that is not run by this plan

- [ ] **Step 1: Write failing demo-plan tests**

Create `tests/deployment/demo-plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEMO_SPEC, demoFingerprint, parseDemoMode } from "../../scripts/prepare-demo";

describe("demo preparation contract", () => {
  it("has one deterministic booking-domain source", () => {
    expect(DEMO_SPEC.projectName).toBe("ReqWiseAI Portfolio Demo");
    expect(DEMO_SPEC.domainKey).toBe("booking_smart_space");
    expect(DEMO_SPEC.sourceTitle).toBe("Portfolio demo — booking discovery meeting");
    expect(DEMO_SPEC.sourceText).toContain("จองห้องประชุม");
    expect(demoFingerprint(DEMO_SPEC)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("defaults to dry-run and guards apply", () => {
    expect(parseDemoMode([])).toBe("dry-run");
    expect(() => parseDemoMode(["--apply"], {})).toThrow(/RUN_DEMO_PREPARE=YES/);
    expect(parseDemoMode(["--apply"], { RUN_DEMO_PREPARE: "YES" })).toBe("apply");
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
npx vitest run tests/deployment/demo-plan.test.ts
```

Expected: FAIL because the demo preparation module does not exist.

- [ ] **Step 3: Define the deterministic demo contract**

Export from `scripts/prepare-demo.mts`:

```ts
export const DEMO_SPEC = {
  projectName: "ReqWiseAI Portfolio Demo",
  domainKey: "booking_smart_space",
  outputLang: "th",
  sourceTitle: "Portfolio demo — booking discovery meeting",
  sourceKind: "meeting_notes",
  sourceText: [
    "ลูกค้าต้องการจองห้องประชุมผ่านเว็บไซต์ โดยเลือกสาขา ห้อง วันที่ และเวลาได้",
    "พนักงานต้องเห็นรายการจองและตรวจสอบลูกค้าที่มาเช็กอิน",
    "ยังไม่ได้ข้อสรุปเรื่องการยกเลิก การคืนเงิน และช่องทางแจ้งเตือน",
  ].join("\n"),
} as const;
```

`demoFingerprint()` must SHA-256 the JSON serialization of this object. The fingerprint, project name, source title, and existing row counts are safe to print; email, password, user id, organization id, raw provider output, and full source text are not printed.

Export `main(args, env)` and guard direct execution so Vitest imports perform no authentication or database call:

```ts
import { pathToFileURL } from "node:url";

export async function main(
  args: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const mode = parseDemoMode(args, env);
  await prepareDemo(mode, env);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
```

- [ ] **Step 4: Implement dry-run behavior**

The default invocation:

```powershell
npm run demo:prepare
```

must:

1. Require `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `REQWISE_DEMO_EMAIL`, and `REQWISE_DEMO_PASSWORD` without printing values.
2. Sign in through the anon client so every query remains user-scoped.
3. Resolve the active `booking_smart_space` profile.
4. Find projects with the exact demo project name visible to that user.
5. Report one of `would_create`, `would_resume`, or `already_complete`.
6. Count sources, runs, review states, question states, finding states, typed relations, and export readiness.
7. Make zero inserts, updates, RPC transitions, deletes, account changes, or external calls.

- [ ] **Step 5: Implement guarded idempotent apply behavior**

`--apply` must require:

```text
RUN_DEMO_PREPARE=YES
```

and then use only:

```text
createProject()
createSource()
buildAnalysisInput()
createMockProvider()
runAnalysis()
persistAnalysisResult()
editItem()
reviewItem()
resolveQuestion()
updateFinding()
```

Rules:

- Re-read by exact project/source identity before each creation.
- Use a stable request key derived from `demoFingerprint()` so a rerun returns the existing analysis run.
- Move one requirement through reviewed to approved using valid RPC transitions.
- Leave at least one requirement reviewed.
- Answer one open question and leave another open.
- Resolve one quality finding and leave another open.
- Require typed relations and a non-blocked portfolio export.
- Refuse more than one matching demo project instead of guessing which to mutate.
- Never use the admin client, create an auth account, seed from a production request path, or delete an existing row.

The implementation is built and tested but `--apply` is not run in this plan. Applying hosted demo data requires Rancandel's fresh protected-action check.

- [ ] **Step 6: Add environment names and package command**

Add to `.env.example`:

```dotenv
# --- Manual demo preparation; never expose to the browser ---
REQWISE_DEMO_EMAIL=
REQWISE_DEMO_PASSWORD=
RUN_DEMO_PREPARE=
```

Add to `package.json`:

```json
"demo:prepare": "node scripts/prepare-demo.mts"
```

- [ ] **Step 7: Run tests and dry-run only**

Run:

```powershell
npx vitest run tests/deployment/demo-plan.test.ts
npm run demo:prepare
git status --short
```

Expected: unit tests pass. With no out-of-band demo credential, the command exits with a safe missing-variable message. With credentials present, it reports dry-run counts and writes nothing.

---

### Task 11: Phase C Destructive Cleanup Double Guard

**Files:**
- Modify: `scripts/verify-db-cleanup.sql`
- Modify: `scripts/verify-db-cleanup-dryrun.sql`
- Create: `scripts/run-db-cleanup.mts`
- Test: `tests/deployment/cleanup-guard.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing verification fixture patterns
- Produces: exact dry-run counts and a destructive path requiring both an environment flag and explicit `--execute`; no cleanup execution

- [ ] **Step 1: Write failing guard tests**

Create `tests/deployment/cleanup-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCleanupMode } from "../../scripts/run-db-cleanup";

describe("database cleanup guard", () => {
  it("defaults to dry-run", () => {
    expect(parseCleanupMode([], {})).toBe("dry-run");
  });

  it("requires both the command flag and environment flag", () => {
    expect(() => parseCleanupMode(["--execute"], {})).toThrow(
      /RUN_DESTRUCTIVE_DEMO_CLEANUP=YES/,
    );
    expect(() =>
      parseCleanupMode([], { RUN_DESTRUCTIVE_DEMO_CLEANUP: "YES" }),
    ).not.toThrow();
    expect(
      parseCleanupMode(["--execute"], { RUN_DESTRUCTIVE_DEMO_CLEANUP: "YES" }),
    ).toBe("execute");
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
npx vitest run tests/deployment/cleanup-guard.test.ts
```

Expected: FAIL because the cleanup wrapper does not exist.

- [ ] **Step 3: Implement the wrapper parser**

Export:

```ts
export function parseCleanupMode(
  args: string[],
  env: Record<string, string | undefined> = process.env,
): "dry-run" | "execute" {
  const execute = args.includes("--execute");
  if (execute && env.RUN_DESTRUCTIVE_DEMO_CLEANUP !== "YES") {
    throw new Error(
      "Destructive cleanup requires RUN_DESTRUCTIVE_DEMO_CLEANUP=YES and --execute.",
    );
  }
  return execute ? "execute" : "dry-run";
}
```

Export `main(args, env)` and use the same `pathToFileURL(process.argv[1])` direct-run guard as `scripts/prepare-demo.mts`, so importing `parseCleanupMode()` in Vitest never invokes the Supabase CLI.

Default execution invokes only `scripts/verify-db-cleanup-dryrun.sql`. The destructive SQL may be invoked only by the double-guarded branch. The wrapper prints the selected SQL filename and exit code, never database credentials or row content beyond the SQL report.

- [ ] **Step 4: Add a SQL-side guard**

At the top of `scripts/verify-db-cleanup.sql`, before `begin`, require:

```sql
do $$
begin
  if current_setting('reqwise.run_destructive_demo_cleanup', true) is distinct from 'YES' then
    raise exception 'destructive cleanup guard is not enabled';
  end if;
end
$$;
```

The wrapper prepends this session-local setting only in the double-guarded execute branch:

```sql
select set_config('reqwise.run_destructive_demo_cleanup', 'YES', false);
```

Direct execution of the destructive SQL therefore fails closed.

- [ ] **Step 5: Keep patterns and counts synchronized**

Ensure both SQL files carry the same account and project patterns. The dry-run must report counts for:

```text
auth.users
projects
source_documents
analysis_runs
analysis_items
item_source_references
item_relations
item_versions
review_activities
orphaned personal organizations
preserved accounts
preserved projects
manual-review demo projects
```

Add the Gemini verification fixture prefix only if `scripts/verify-gemini.mts` creates database fixtures. Offline-only verification adds no cleanup pattern.

- [ ] **Step 6: Add package commands**

Add:

```json
"verify:cleanup": "node scripts/run-db-cleanup.mts",
"cleanup:execute": "node scripts/run-db-cleanup.mts --execute"
```

- [ ] **Step 7: Run tests and dry-run only**

Run:

```powershell
npx vitest run tests/deployment/cleanup-guard.test.ts
npm run verify:cleanup
```

Expected: tests pass and dry-run reports exact counts. Do not run `npm run cleanup:execute`.

- [ ] **Step 8: Prove the destructive path fails closed**

Run without the environment flag:

```powershell
npm run cleanup:execute
```

Expected: exits before opening the destructive SQL and reports the missing double guard. Do not set the environment flag.

---

### Task 12: Phase C Route Resilience, Accessibility Findings, and Deployment Documentation

**Files:**
- Create: `app/workspace/loading.tsx`
- Create: `app/workspace/error.tsx`
- Modify: `app/workspace/projects/[projectId]/traceability/traceability-view.tsx`
- Modify: `app/workspace/projects/[projectId]/traceability/_components/matrix-view.tsx`
- Modify: `app/workspace/projects/[projectId]/traceability/_components/map-view.tsx`
- Modify: `app/globals.css`
- Create: `docs/DEPLOYMENT.md`
- Modify: `docs/architecture/ARCHITECTURE.md`
- Modify: `HANDOFF.md`
- Test: `tests/deployment/route-resilience.test.ts`

**Interfaces:**
- Consumes: existing route error/not-found behavior, traceability data, Phase C environment and headers
- Produces: non-blank workspace fallbacks, accessible traceability alternative, deployment/runbook documentation, Phase C commit

- [ ] **Step 1: Write failing route-resilience tests**

Create `tests/deployment/route-resilience.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("workspace resilience surfaces", () => {
  it("has workspace loading and error boundaries", () => {
    const loading = readFileSync("app/workspace/loading.tsx", "utf8");
    const error = readFileSync("app/workspace/error.tsx", "utf8");
    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-live="polite"');
    expect(error).toContain('"use client"');
    expect(error).toContain('role="alert"');
    expect(error).toContain("reset()");
  });

  it("keeps an accessible list alternative for traceability", () => {
    const view = readFileSync(
      "app/workspace/projects/[projectId]/traceability/traceability-view.tsx",
      "utf8",
    );
    expect(view).toMatch(/Matrix|accessible list/i);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
npx vitest run tests/deployment/route-resilience.test.ts
```

Expected: FAIL because workspace-level boundaries do not exist.

- [ ] **Step 3: Add the workspace loading surface**

Create `app/workspace/loading.tsx`:

```tsx
export default function WorkspaceLoading() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8 sm:px-8"
    >
      <span className="sr-only">Loading workspace</span>
      <div className="h-7 w-48 animate-pulse rounded bg-surface-muted" />
      <div className="h-40 animate-pulse rounded-[var(--radius-panel)] bg-surface-muted" />
    </main>
  );
}
```

- [ ] **Step 4: Add the safe workspace error boundary**

Create `app/workspace/error.tsx`:

```tsx
"use client";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8 sm:px-8">
      <section role="alert" className="rounded-[var(--radius-panel)] border border-danger-border bg-danger-soft p-5">
        <h1 className="text-lg font-semibold text-danger">The workspace could not be loaded</h1>
        <p className="mt-2 text-sm text-text-muted">
          Your data was not changed. Try loading this workspace again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
```

Do not render the received `error.message`, stack, policy, table, SQL, source text, provider output, or credential.

- [ ] **Step 5: Complete the accessibility audit**

Verify and correct only confirmed defects across workspace, auth, analysis, traceability and export:

```text
keyboard order follows visual order
all controls have visible focus
all inputs have programmatic labels
status includes text, not color alone
interactive targets are at least 44×44 CSS pixels
details/summary and tabs expose semantics
reduced motion disables nonessential animation
print keeps headings and table structure
traceability map has the Matrix/list alternative
tablet portrait panel switcher preserves selected item and pending forms
```

When an issue is fixed, add a focused test against its pure helper or rendered source. Do not change colors, layout, or animation without a measured violation.

- [ ] **Step 6: Write the deployment runbook**

`docs/DEPLOYMENT.md` must contain these exact sections:

```text
Deployment target: Vercel-compatible Next.js
Prerequisites
Environment variable names and browser/server boundaries
Build and production-start commands
Supabase migration inventory and “do not edit applied migrations”
Mock-default and Gemini-optional behavior
Security headers and CSP rationale
Demo preparation dry-run
Protected manual demo apply
Verification cleanup dry-run
Forbidden destructive cleanup in this release
Pre-deploy checklist
Post-deploy smoke test
Rollback procedure
Known scaling limits
Deployment status: not deployed
```

The rollback procedure restores the prior deployment version and does not roll back applied migrations because this phase adds none.

- [ ] **Step 7: Record performance limits without speculative optimization**

Document current limits:

```text
analysis history is not paginated
traceability loads a whole project graph
large matrices grow quadratically in visual density
source highlight holds the full source text in the workspace
export builds a whole project package in memory
demo verification fixtures accumulate until manual cleanup
```

Profile the production build and browser flow. Modify rendering only when a duplicate fetch, unnecessary client boundary, or observable blocking issue is confirmed.

- [ ] **Step 8: Run the Phase C gate**

Run:

```powershell
npx vitest run tests/config tests/deployment
npm run verify:deployment
npm run verify:cleanup
npm run verify:gemini
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all automated commands pass; cleanup remains dry-run; deployment remains local.

- [ ] **Step 9: Browser production-readiness verification**

Verify:

```text
protected-route redirect
private workspace cache
download headers
archived read-only state
Gemini unavailable state
mock analysis
export
traceability Matrix and Map
834 px and 390 px layout
keyboard-only flow
no console error
no horizontal overflow
no client secret
```

- [ ] **Step 10: Review and stage exact Phase C paths**

Run:

```powershell
git diff --stat
git diff --check
git add -- .env.example package.json instrumentation.ts next.config.ts proxy.ts
git add -- lib/config/env.ts lib/config/security-headers.ts
git add -- app/workspace/loading.tsx app/workspace/error.tsx app/globals.css
git add -- 'app/workspace/projects/[projectId]/traceability/traceability-view.tsx'
git add -- 'app/workspace/projects/[projectId]/traceability/_components/matrix-view.tsx'
git add -- 'app/workspace/projects/[projectId]/traceability/_components/map-view.tsx'
git add -- scripts/prepare-demo.mts scripts/run-db-cleanup.mts scripts/verify-db-cleanup.sql scripts/verify-db-cleanup-dryrun.sql scripts/verify-deployment.mts
git add -- tests/config/env.test.ts tests/deployment/headers.test.ts tests/deployment/demo-plan.test.ts tests/deployment/cleanup-guard.test.ts tests/deployment/route-resilience.test.ts
git add -- docs/DEPLOYMENT.md docs/architecture/ARCHITECTURE.md HANDOFF.md
git diff --cached --name-only
git diff --cached --check
```

Expected: only the named Phase C files are staged.

- [ ] **Step 11: Commit Phase C**

Run:

```powershell
git commit -m "chore(reqwise): harden deployment and demo workflows" -m "Co-Authored-By: Codex Fable 5 <noreply@anthropic.com>"
git status --short --branch
```

Expected: commit succeeds and the working tree is clean.

---

### Task 13: Phase D Compact Portfolio Project Overview

**Files:**
- Create: `lib/projects/portfolio-summary.ts`
- Modify: `lib/projects/types.ts`
- Modify: `app/workspace/projects/[projectId]/page.tsx`
- Modify: `app/workspace/_components/sidebar.tsx`
- Test: `tests/projects/portfolio-summary.test.ts`

**Interfaces:**
- Consumes: `loadExportInput()`, `scopeForPreset("portfolio_demo")`, `buildExportPackage()`, `assessReadiness()`
- Produces: persisted-data-only `PortfolioProjectSummary` and compact overview rows

- [ ] **Step 1: Write failing summary tests**

Create `tests/projects/portfolio-summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizePortfolioProject } from "../../lib/projects/portfolio-summary";
import { exportInput } from "../export/fixtures";

describe("portfolio project summary", () => {
  it("derives workflow and readiness counts from persisted export input", () => {
    const summary = summarizePortfolioProject(exportInput());
    expect(summary.requirements.total).toBeGreaterThan(0);
    expect(summary.review.reviewedOrApproved).toBeGreaterThanOrEqual(0);
    expect(summary.questions.open + summary.questions.closed).toBeGreaterThanOrEqual(0);
    expect(summary.findings.open + summary.findings.closed).toBeGreaterThanOrEqual(0);
    expect(["ready", "ready_with_warnings", "cannot_export"]).toContain(
      summary.exportReadiness,
    );
  });

  it("does not call coverage a quality score", () => {
    const summary = summarizePortfolioProject(exportInput());
    expect(summary).toHaveProperty("coverage");
    expect(summary).not.toHaveProperty("qualityScore");
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
npx vitest run tests/projects/portfolio-summary.test.ts
```

Expected: FAIL because the portfolio summary does not exist.

- [ ] **Step 3: Define and implement the summary**

Export:

```ts
export type PortfolioProjectSummary = {
  requirements: { total: number };
  review: { reviewedOrApproved: number; totalReviewable: number };
  questions: { open: number; closed: number };
  findings: { open: number; closed: number };
  coverage: { linked: number; items: number; orphans: number };
  exportReadiness: "ready" | "ready_with_warnings" | "cannot_export";
};

export function summarizePortfolioProject(input: ExportInput): PortfolioProjectSummary;
```

Implementation rules:

- Requirements exclude `open_question` and `quality_finding`.
- Reviewed or approved counts only status `reviewed` and `approved`.
- Open questions are workflow `open` or `deferred`; closed are `answered` or `not_applicable`.
- Open findings are workflow `open` or `acknowledged`; closed are `resolved` or `dismissed`.
- Build the package with `scopeForPreset("portfolio_demo")`.
- Use `assessReadiness(input, pkg)` for readiness.
- Use the package's project-wide coverage totals; do not recompute scope coverage.
- No percentage is shown when denominator is zero.

- [ ] **Step 4: Load the summary in the project route**

After `getProject()` succeeds:

```ts
const exportInput = await loadExportInput(supabase, projectId);
const portfolioSummary = exportInput ? summarizePortfolioProject(exportInput) : null;
```

RLS remains the visibility boundary. Render compact rows for:

```text
Sources
Analysis runs
Requirements
Review progress
Open questions
Open findings
Traceability coverage
Export readiness
```

Keep direct actions to Sources, Traceability and Export. Do not use oversized KPI cards or an invented score.

- [ ] **Step 5: Make planned navigation explicit**

In the sidebar:

- Keep Workspace and Projects active.
- Keep unimplemented workspace-wide destinations disabled.
- Replace “Coming in a later slice” with visible `Planned` text in the label or accessible description.
- Do not create fake workspace-wide Questions, Findings, Reviews, Traceability, Export, Domain Profile, or Settings routes.
- Preserve per-project Sources, Analysis, Traceability and Export links where they already exist.

- [ ] **Step 6: Run tests and browser verification**

Run:

```powershell
npx vitest run tests/projects tests/export tests/traceability
npm run typecheck
npm run lint
```

Browser expectations:

```text
summary uses real row counts
zero denominators show words rather than 0% quality
archived project keeps read-only Traceability and Export
planned destinations do not navigate
compact rows fit 834 px and 390 px without horizontal overflow
```

---

### Task 14: Phase D Landing, README, Architecture, Case Study, and Demo Assets

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/sign-in/page.tsx`
- Modify: `README.md`
- Modify: `docs/architecture/ARCHITECTURE.md`
- Create: `docs/PORTFOLIO-CASE-STUDY.md`
- Create: `docs/DEMO-SCRIPT.md`
- Create: `docs/SCREENSHOT-CHECKLIST.md`
- Modify: `HANDOFF.md`
- Test: `tests/portfolio/documentation.test.ts`

**Interfaces:**
- Consumes: verified features and exact test/runtime evidence through Phase C
- Produces: truthful portfolio presentation, reproducible demo instructions, Phase D commit

- [ ] **Step 1: Write failing documentation coverage tests**

Create `tests/portfolio/documentation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("portfolio documentation", () => {
  it("covers the required README sections", () => {
    const text = read("README.md");
    for (const heading of [
      "Product Overview",
      "Business Problem",
      "Target Users",
      "Core Workflow",
      "Features",
      "Architecture",
      "Data Model",
      "Human-in-the-loop Principles",
      "Source Evidence",
      "Security and RLS",
      "Mock and Gemini Providers",
      "Traceability",
      "Export",
      "Testing Strategy",
      "Local Setup",
      "Environment Variables",
      "Demo Instructions",
      "Deployment Guide",
      "Known Limitations",
      "Roadmap",
    ]) {
      expect(text).toContain(`## ${heading}`);
    }
  });

  it("contains both demo durations and no unsupported metric claim", () => {
    const text = read("docs/DEMO-SCRIPT.md");
    expect(text).toMatch(/3–5 minute/i);
    expect(text).toMatch(/60–90 second/i);
    const portfolio = read("docs/PORTFOLIO-CASE-STUDY.md");
    expect(portfolio).not.toMatch(/reduced .* by \d+%|improved .* by \d+%|used by \d+/i);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
npx vitest run tests/portfolio/documentation.test.ts
```

Expected: FAIL because README is still the scaffold and portfolio documents do not exist.

- [ ] **Step 3: Refine landing and sign-in without a marketing takeover**

The landing page must contain:

```text
ReqWiseAI
AI-assisted Requirements Intelligence Workspace
Meeting notes → exact evidence → human review → typed traceability → developer handoff
AI assists; a person decides
Open workspace / Sign in / Create account
```

Use the existing compact `max-w-2xl` composition; do not create an oversized hero, gradient spectacle, dashboard cards, fake customer logos, or usage metrics.

The sign-in page keeps safe server-action errors and adds:

```text
Demo access is provided out of band. No credential is published in this application.
```

- [ ] **Step 4: Replace the scaffold README**

Write all twenty tested sections. The setup commands are:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

Document variable names only. State that `.env.local` is never committed, mock is the default, Gemini is optional, hosted migration application and deployment are manual, and the project is not deployed by this plan.

- [ ] **Step 5: Finish architecture documentation**

Document:

```text
system context
provider adapter and factory
mock and Gemini boundaries
strict output and typed relations
exact evidence and source immutability
atomic persistence
human edit/review
question and finding workflows
traceability
export
environment and deployment boundary
RLS and server-only secrets
immutable versus editable records
```

Remove stale statements that Gemini, typed relations, traceability UI, or export are future work.

- [ ] **Step 6: Write the portfolio case study**

Use these headings:

```text
Problem
Target User
Business Value
Research and Assumptions
Product Decisions
Main Workflow
Architecture Decisions
Key Technical Challenges
Security
Testing
Results
Trade-offs
Future Roadmap
Resume Bullet Options
Interview Talking Points
```

Claims use evidence-bearing language:

```text
Designed to reduce
Demonstrates
Validated through tests
Supports
```

Resume bullets name the verified stack and behaviors but contain no percentage, user count, business outcome, deployment claim, or live-Gemini claim without evidence.

- [ ] **Step 7: Write both demo scripts**

The 3–5 minute script follows:

```text
Open project
Add meeting notes
Choose Mock or explain Gemini availability
Run analysis
Select a requirement
Show exact source highlight
Edit and review
Approve one requirement
Answer a stakeholder question
Resolve a quality finding
Open Traceability Matrix and Map
Inspect typed relations
Open Export
Download Markdown, JSON and CSV
Open printable developer handoff
```

The 60–90 second script compresses the same proof into source → evidence → human decision → traceability → export. It does not show a disabled deferred feature as though it were implemented.

- [ ] **Step 8: Write the screenshot checklist**

Required captures:

```text
landing
project overview
analysis three-panel workspace
exact source highlight
review/history inspector
question workflow
quality finding workflow
traceability matrix
traceability map with accessible alternative
export readiness and preview
print document
Gemini provider selector or honest unavailable state
desktop 1440 px
tablet portrait 834 px
mobile 390 px
```

Before every capture confirm:

```text
demo data only
no real email
no password
no key
no verification fixture owner
no console error
no horizontal overflow
```

- [ ] **Step 9: Run the Phase D gate**

Run:

```powershell
npx vitest run tests/portfolio tests/projects
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all commands pass and documentation coverage is green.

- [ ] **Step 10: Review and stage exact Phase D paths**

Run:

```powershell
git diff --stat
git diff --check
git add -- app/page.tsx app/sign-in/page.tsx app/workspace/_components/sidebar.tsx
git add -- 'app/workspace/projects/[projectId]/page.tsx'
git add -- lib/projects/portfolio-summary.ts lib/projects/types.ts
git add -- tests/projects/portfolio-summary.test.ts tests/portfolio/documentation.test.ts
git add -- README.md docs/architecture/ARCHITECTURE.md docs/PORTFOLIO-CASE-STUDY.md docs/DEMO-SCRIPT.md docs/SCREENSHOT-CHECKLIST.md HANDOFF.md
git diff --cached --name-only
git diff --cached --check
```

Expected: only the named Phase D files are staged.

- [ ] **Step 11: Commit Phase D**

Run:

```powershell
git commit -m "docs(reqwise): finalize portfolio experience and case study" -m "Co-Authored-By: Codex Fable 5 <noreply@anthropic.com>"
git status --short --branch
```

Expected: commit succeeds and the working tree is clean.

---

### Task 15: Phase E Current-tree Credential Redaction and Security Audit

**Files:**
- Modify: `HANDOFF.md`
- Modify: `docs/handoff/SLICE-6C-EXPORT.md`
- Test: `tests/security/documentation-secrets.test.ts`

**Interfaces:**
- Consumes: tracked current-tree documentation known to contain a demo credential pair
- Produces: current-tree documentation with out-of-band credential instructions and an explicit protected/manual history warning

- [ ] **Step 1: Write a secret-presence test without printing the credential**

Create `tests/security/documentation-secrets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("tracked documentation credentials", () => {
  it("does not publish a demo sign-in pair", () => {
    const text = [
      readFileSync("HANDOFF.md", "utf8"),
      readFileSync("docs/handoff/SLICE-6C-EXPORT.md", "utf8"),
    ].join("\n");
    expect(text).not.toMatch(/slice3\.demo@reqwise\.dev\s*[/·:]\s*\S+/i);
    expect(text).toContain("Demo credentials are managed out of band");
  });
});
```

- [ ] **Step 2: Run the test and confirm RED without printing matching lines**

Run:

```powershell
rg -l "slice3\.demo@reqwise\.dev" HANDOFF.md docs/handoff/SLICE-6C-EXPORT.md
npx vitest run tests/security/documentation-secrets.test.ts
```

Expected: `rg -l` prints filenames only; the test fails without printing the credential value.

- [ ] **Step 3: Redact the current tree without placing the old value in logs**

Run this non-echoing mechanical replacement:

```powershell
$redactionScript = @'
const fs = require("node:fs");
const paths = [
  "HANDOFF.md",
  "docs/handoff/SLICE-6C-EXPORT.md",
];
const pair = /`[^`\r\n]+@[^`\r\n]+`\s*\/\s*`[^`\r\n]+`/g;
const replacement =
  "Demo credentials are managed out of band. Request current demo access from the project owner; never place an account password in tracked documentation.";
for (const path of paths) {
  const before = fs.readFileSync(path, "utf8");
  const matches = before.match(pair) ?? [];
  if (matches.length !== 1) {
    throw new Error(`${path}: expected exactly one credential pair, found ${matches.length}`);
  }
  fs.writeFileSync(path, before.replace(pair, replacement), "utf8");
}
'@
node -e $redactionScript
```

This command:

- read only the two named files;
- match the demo-access sentence structurally, not print it;
- fail when exactly one replacement per file is not made;
- write no credential value to stdout, stderr, the patch description, test output, or final report.

Do not rotate the account, revoke the password, delete the user, or rewrite history in this step.

- [ ] **Step 4: Record the protected/manual security blocker**

In `HANDOFF.md`, state:

```text
Current-tree demo credentials were redacted.
The previously published credential must be rotated or revoked by the owner before public release.
Rotation/revocation is a protected external action and has not been executed.
The value remains in Git history unless the owner separately authorizes history remediation.
This repository's no-history-rewrite rule remains in force.
```

Do not repeat the email or password.

- [ ] **Step 5: Run the documentation security test and current-tree scan**

Run:

```powershell
npx vitest run tests/security/documentation-secrets.test.ts
rg -l "slice3\.demo@reqwise\.dev" HANDOFF.md docs/handoff/SLICE-6C-EXPORT.md
git grep -n -I -E "AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|GEMINI_API_KEY=.+|SUPABASE_SERVICE_ROLE_KEY=.+" -- ':!package-lock.json'
```

Expected: test passes; the filename-only email scan prints nothing; the current-tree secret scan prints nothing. Do not claim Git-history remediation.

---

### Task 16: Phase E Full-system Verification and Final Handoff

**Files:**
- Create: `docs/FINAL-VERIFICATION.md`
- Modify: `HANDOFF.md`
- Modify: `docs/handoff/SLICE-6C-EXPORT.md`
- Include test: `tests/security/documentation-secrets.test.ts`

**Interfaces:**
- Consumes: exact Phase A–D commits and the clean post-redaction current tree
- Produces: exact-count final verification record, final handoff, optional documentation-only commit; no push/deploy/cleanup

- [ ] **Step 1: Confirm commit and migration inventory**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -12
Get-ChildItem -File supabase\migrations\*.sql | Sort-Object Name | Select-Object -ExpandProperty Name
```

Expected:

```text
branch reqwise-ai
clean except the intentional Phase E documentation/security files
Phase A, B, C and D commits present
20 applied migration files ending in 20260727000020_analysis_persistence_acl_and_coherence.sql
no migration after the approved Phase B integrity repair
```

- [ ] **Step 2: Run every runtime verifier separately and capture exact totals**

Run:

```powershell
npm run verify:db
npm run verify:projects
npm run verify:sources
npm run verify:analysis
npm run verify:review
npm run verify:workflow
npm run verify:traceability
npm run verify:export
npm run verify:gemini
npm run verify:deployment
npm run verify:cleanup
```

Record every exact passed/total count in `docs/FINAL-VERIFICATION.md`. `verify:cleanup` is dry-run only. If any verifier is blocked by an unavailable hosted credential, record `blocked` with the command and do not write `passed`.

- [ ] **Step 3: Run the complete automated quality gate**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Record exact Vitest file/test counts and the build result. Do not summarize only as “all passed.”

- [ ] **Step 4: Run production start locally**

With safe local environment names already configured out of band:

```powershell
npm run start
```

Verify the built application answers locally, then stop the process cleanly. Do not deploy or expose it externally.

- [ ] **Step 5: Execute the browser end-to-end checklist**

Record PASS, FAIL, BLOCKED, or NOT APPLICABLE for each:

```text
1. Sign in
2. Open Demo Project
3. Add Source through textarea
4. Analyze with Mock
5. Analyze with Gemini only after the protected live-call gate
6. Confirm exact source highlight
7. Edit requirement
8. Mark reviewed
9. Approve requirement
10. Answer question
11. Resolve finding
12. Open Traceability Matrix
13. Open Traceability Map
14. Confirm inspector relation sentences
15. Open Export
16. Download Markdown
17. Download JSON
18. Download CSV
19. Open printable document
20. Open archived project
21. Confirm archived read-only
22. Test cross-tenant URL without disclosing existence
23. Test protected route signed out
24. Tablet portrait 834 px
25. Tablet landscape
26. Keyboard navigation
27. No horizontal overflow
28. No application console error
```

When live Gemini has not received protected approval, item 5 is `BLOCKED — live credential/use not authorized`; verify the unavailable state instead.

- [ ] **Step 6: Verify data integrity**

Use existing runtime checks and browser evidence to record:

```text
analysis runs unchanged after creation
raw provider output unchanged
locked source revisions reject edits
approved items remain terminal
review activities append-only
workflow activities append-only
typed relations valid
legacy derives_from rows unchanged
cross-project relation refused
export performs no database write
demo preparation dry-run performs no write
```

- [ ] **Step 7: Verify authorization and security**

Record:

```text
RLS hides another tenant
service role absent from application request path
Gemini secret absent from browser bundle
auth user id absent from export
raw provider output absent from export
download and print routes protected
safe user-facing errors
private cache on authenticated pages
current-tree documentation credential redacted
credential rotation/revocation still protected/manual
Git-history remediation not executed
```

Run:

```powershell
git grep -n -I -E "NEXT_PUBLIC_GEMINI|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|GEMINI_API_KEY=.+|SUPABASE_SERVICE_ROLE_KEY=.+" -- ':!package-lock.json'
git status --short
```

Expected: current-tree scan is clean. Do not scan `.env.local` and do not claim historical removal.

- [ ] **Step 8: Write the final verification record**

`docs/FINAL-VERIFICATION.md` must contain:

```text
Verified HEAD and date
Command-by-command exact totals
Build and production-start result
Browser 28-step table
Responsive and accessibility result
Data-integrity result
Authorization/RLS result
Export result
Gemini automated result
Gemini live status
Deployment status: not deployed
Cleanup dry-run exact counts
Demo status
Known limitations
Protected manual actions
```

- [ ] **Step 9: Update the final HANDOFF**

Record:

```text
current HEAD before the optional final-doc commit
commit inventory
completed features
routes
20 migrations, with migration 20 limited to persistence ACL and coherence
environment variable names only
unit test exact count
runtime exact counts
browser results
live Gemini status
deployment status: not deployed
demo dry-run/apply status
cleanup dry-run counts
known and scaling limitations
credential rotation/revocation blocker
manual cleanup instructions without executing them
3–5 minute demo path
exact resume-here command and next manual gate
```

Remove stale statements that the next automatic task is the deferred change-request workflow.

- [ ] **Step 10: Review Phase E changes**

Run:

```powershell
git diff -- HANDOFF.md docs/handoff/SLICE-6C-EXPORT.md docs/FINAL-VERIFICATION.md tests/security/documentation-secrets.test.ts
git diff --check
git status --short
```

Expected: Phase E contains only security redaction, final verification and handoff documentation/test changes.

- [ ] **Step 11: Create the optional final documentation commit**

Only when every non-protected required gate is PASS and the final documents contain exact evidence:

```powershell
git add HANDOFF.md docs/handoff/SLICE-6C-EXPORT.md docs/FINAL-VERIFICATION.md tests/security/documentation-secrets.test.ts
git diff --cached --name-only
git diff --cached --check
git commit -m "docs(reqwise): update final handoff" -m "Co-Authored-By: Codex Fable 5 <noreply@anthropic.com>"
```

If a critical test failed, do not commit. Keep the best valid artifacts and report the exact failure.

- [ ] **Step 12: Confirm the stop conditions**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -8
```

Final state:

```text
working tree clean after the optional documentation commit
no push
no deployment
no database cleanup
no external account creation
no credential rotation/revocation
no Git-history rewrite
no deferred roadmap implementation
```

Stop and return the Thai final report required by the Master Prompt.
