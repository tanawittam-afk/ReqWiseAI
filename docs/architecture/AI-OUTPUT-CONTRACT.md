# ReqWise AI — AI Output Contract (D)

Status: **proposed** · 2026-07-24 · part of the Architecture Gate.
No code exists. The TypeScript below is the specification, not the implementation.

`lib/schema.ts` will be the single source of truth: the provider prompt, the Zod
validators, the persistence layer, the UI renderer, and every exporter read from it.

---

## D.1 The pipeline, and where trust begins

```
provider (untrusted)  →  raw output
                          │  stored verbatim in analysis_runs.raw_provider_output
                          ▼
                       Zod parse  ──fail──►  run persisted as `invalid`, zero items
                          │ pass
                          ▼
                       semantic checks (§D.5, §D.6)  ──fail──►  same
                          │ pass
                          ▼
                       validated_output  →  analysis_items + item_source_references
                          │
                          ▼
                       UI (only ever renders this side of the line)
```

**Nothing crosses into the database or the UI unvalidated.** The raw output is kept for
audit and debugging, and is never rendered as content.

---

## D.2 Validated structured output

```ts
type AnalysisOutput = {
  schemaVersion: string;          // e.g. "1.0.0" — stored on the run
  promptVersion: string;          // which prompt produced this
  outputLang: "th" | "en";
  summary: {
    itemCount: number;
    unresolvedQuestionCount: number;
    lowConfidenceCount: number;
  };
  items: AnalysisItem[];
  relations: ItemRelationDraft[]; // proposed traceability links
};
```

## D.3 Supported item types

Fourteen, matching `analysis_items.item_type`:

`problem_statement` · `business_objective` · `stakeholder` · `business_requirement` ·
`functional_requirement` · `non_functional_requirement` · `user_story` ·
`acceptance_criterion` · `business_rule` · `assumption` · `risk` · `constraint` ·
`open_question` · `quality_finding`

The spec's fifteenth output, *Requirement Source References*, is not an item type — it is
the `sourceReferences` array carried by every item (`item_source_references` in the
database). Modelling it as a type would allow a citation to exist detached from the thing
it cites.

## D.4 Item shape — required and optional fields

```ts
type AnalysisItem = {
  // --- required on every item ---
  localId: string;              // provider-scoped, e.g. "i-14"; used only to wire
                                //   relations within one response. NOT the human key.
  type: ItemType;
  title: string;                // 1–160 chars
  description: string;          // 1–4000 chars
  priority: "critical" | "high" | "medium" | "low" | "unassigned";
  status: "draft";              // literal — the only value the schema accepts
  evidenceClass: "stated" | "inferred" | "assumed";
  confidence: number;           // 0..1
  sourceReferences: SourceReference[];   // may be empty only per §D.5

  // --- optional ---
  rationale?: string;           // why the model produced this
  attributes?: TypeAttributes;  // discriminated on `type` — see below
  tags?: string[];
};

type SourceReference = {
  sourceId: string;             // must match a source in the request
  excerpt: string;              // verbatim
  startOffset?: number;
  endOffset?: number;
  evidenceStrength?: number;    // 0..1 — quality of *this citation*
};
```

`attributes` is a **Zod discriminated union on `type`**:

| type | attributes |
|---|---|
| `user_story` | `{ asA, iWant, soThat }` |
| `acceptance_criterion` | `{ given?, when?, then, storyLocalId? }` |
| `risk` | `{ impact: 1–5, likelihood: 1–5, mitigation? }` |
| `stakeholder` | `{ role, interest?, influence? }` |
| `non_functional_requirement` | `{ category, metric?, target? }` |
| `open_question` | `{ blocks?: string[], category }` |
| `quality_finding` | `{ finding: "ambiguous" \| "incomplete" \| "conflicting" \| "untestable" \| "duplicate", targetLocalIds: string[] }` |
| all others | `undefined` |

Notes that matter:

- **`status` is a literal `"draft"`.** A provider cannot emit an approved requirement,
  because the schema will not parse one. This is the machine-checkable form of "the AI
  never decides".
- **`localId` is not `human_key`.** `BR-001` is allocated by the database per project, at
  insert. A provider that could choose stable IDs could collide with, or renumber,
  requirements a stakeholder has already cited.
- Priority defaults to `unassigned`. See §D.7.

## D.5 Source evidence contract

1. Every `sourceId` must match a source document supplied in that request. An unknown id
   fails the run — it means the model hallucinated a document.
2. When offsets are present, `raw_text.substring(startOffset, endOffset)` must equal
   `excerpt`. Mismatch fails the run. **This is the single most valuable check in the
   system**: it is what makes a fabricated quotation impossible to display.
3. `excerpt` must be a genuine substring of the named source even when offsets are absent.
   If it is not, the model invented the quote.
4. **A domain profile can never be a source.** `sourceId` may only reference
   `source_documents`. There is no schema path from `domain_profiles` to evidence.
5. Cardinality by evidence class — §D.6.

## D.6 Fact vs assumption rules

`evidenceClass` is the mechanism that makes "separate facts from assumptions" enforceable
rather than aspirational:

| `evidenceClass` | Meaning | References required |
|---|---|---|
| `stated` | The source says this, directly | **≥ 1**, and the excerpt must verify |
| `inferred` | Derived from stated content by reasoning | **≥ 1** supporting excerpt, plus `rationale` **required** |
| `assumed` | Not supported by any source | **0 — must be empty** |

Additional enforced rules:

- An `assumed` item that carries a source reference **fails validation.** That combination
  is the exact failure mode this product exists to prevent: an invention wearing a citation.
- Every `assumed` item must be either `type: "assumption"` or paired with an
  `open_question` item that targets it via `relations`. An unsupported claim must always
  leave a question behind for a stakeholder.
- Domain-profile knowledge (typical workflows, common business rules) may only produce
  `assumed` items or `open_question` items — **never `stated`**. The Smart Space profile
  knowing that booking systems usually have a refund policy does not make it a fact about
  *this* client. This is the rule that keeps the demo domain honest.

## D.7 Confidence contract

- `confidence` ∈ [0, 1], required on every item, provider-supplied.
- Display bands: **high** ≥ 0.8 · **medium** 0.5–0.79 · **low** < 0.5. Bands are a UI
  concern; the stored value is the raw number.
- Confidence is displayed with a label and an icon, **never by colour alone**
  (accessibility rule in `CLAUDE.md`).
- **Confidence triggers no automatic behaviour.** Nothing is hidden, auto-rejected, or
  auto-approved based on it. It informs a reviewer; it does not act. Low-confidence items
  are surfaced in `summary.lowConfidenceCount`, and that is the whole of it.
- `evidenceStrength` on a reference is separate and answers a different question: *how
  good is this citation*, not *how sure is the model about the requirement*.

## D.8 Invalid output handling

On Zod failure or a semantic-check failure (§D.5, §D.6):

1. **Nothing is partially written.** The run and its items are one transaction; a failed
   validation writes zero `analysis_items`.
2. The run **is still persisted**, with `validation_status = 'invalid'`,
   `raw_provider_output` intact, and the structured validation error stored. A failed run
   is evidence, not garbage — it is how a bad prompt gets diagnosed.
3. **Zero repair.** An invalid provider payload is never sent back to the provider for
   rewriting. The invalid run is persisted as evidence and the user may explicitly start
   a new run.
4. **The output is never silently repaired.** No defaulting a missing `priority`, no
   dropping an item that failed its checks, no coercing a bad `evidenceClass`. A partially
   valid analysis presented as complete is worse than an honest failure.
5. `provider_error` (timeout, 5xx, no response) is a distinct `validation_status` from
   `invalid` (a response that arrived but was wrong) — different causes, different fixes.
6. The UI states which failure occurred and offers a re-run. It never renders raw output.

## D.9 Mock provider contract

The mock is what makes the entire first vertical slice buildable and testable with no key,
no network, and no cost.

**Determinism — non-negotiable:**

- Pure function of `(sources, domainProfileKey, outputLang, promptVersion)`.
- No network, no `Date.now()`, no `Math.random()`, no environment reads.
- Any pseudo-randomness is seeded from a hash of the input.
- **Same input → byte-identical output.** This is assertable in a unit test, and it is what
  makes the e2e tests stable.

**Input-awareness (added slice 4.1).** The runtime mock analyses *the text it is given*.
It segments the source document from the analysis input, matches concepts against a
bilingual TH/EN lexicon plus vocabulary derived from the domain profile row, and emits
citations whose offsets index into that same string. It reads the domain profile from
the input — which the server loaded from `domain_profiles` — and never imports
`lib/domain/profiles/*.ts` at runtime.

The earlier fixture-replay behaviour was replaced because it made a citation into a
claim about a document the user had never seen: a "valid" run was only reachable when
the source text was byte-identical to the fixture, and every real source produced an
`invalid` run. Implementation: `lib/providers/mock/runtime/`.

**Coverage — the *contract fixture* (test-only, `lib/providers/mock/fixtures/`) must
produce, at minimum:**

- at least one item of **every one of the 14 types**, so no UI branch is unexercised
- at least one item per `evidenceClass`, including a correctly-empty `assumed` item
- at least one low-confidence (< 0.5) item
- at least one `open_question` linked to an `assumed` item via `relations`
- at least one `quality_finding` targeting an ambiguous requirement
- source references with **correct, verifiable offsets** into the fixture source text
- a `user_story` with its `acceptance_criterion` children linked through `relations`

That fixture is exercised directly by the schema, evidence, relation and normalization
suites. It is **not** reachable from the runtime provider — a fixture standing in for an
analysis is the bug slice 4.1 removed.

The *runtime* strategy has its own, lighter minimum for ordinary non-empty notes: a
problem statement, business objective, stakeholder, business requirement, functional
requirement, user story, acceptance criterion, an assumption or risk, an open question,
and a quality finding. Fewer than 14 types is acceptable there — inventing an item type
the text gives no basis for would be worse than omitting it.

**Deliberately invalid fixtures** must also exist — an excerpt that does not match its
offsets, an `assumed` item carrying a citation, a non-`draft` status — so that §D.8 is
tested for real rather than assumed to work.

The mock's output passes through the **exact same validation path** as a real provider. It
is never trusted, never fast-pathed. A mock that bypassed validation would test nothing.

## D.10 Gemini provider contract

Gemini is a server-only adapter selected by `lib/providers/factory.ts`; the deterministic
mock remains the default when no real provider is configured.

- The prompt includes each source document verbatim and asks for one strict JSON value
  matching this contract. It never treats profile context as source evidence.
- The client uses native `fetch` and an ordered, configured model chain. Retry is bounded
  to retryable transport failures; a model advances only after its bounded attempts are
  exhausted.
- Model text is parsed as JSON exactly once. There is no markdown-fence stripping,
  best-effort field coercion, item dropping, relation rewriting or model repair request.
- Parsed output enters the same Zod, evidence-offset and typed-relation validation path as
  mock output. Any failure produces an `invalid` run with zero normalized items.
- Successful and failed runs persist the actual provider, model and prompt version used.
  Read models expose only safe metadata required by the UI.
- Provider failures are converted to typed canonical categories. Safe projections never
  contain API keys, prompts, full source text, raw responses, request identifiers or
  provider-supplied error messages.
- `GEMINI_API_KEY`, `GEMINI_MODEL` and optional fallback-model configuration are
  server-only. No `NEXT_PUBLIC_GEMINI_*` variable or provider credential may cross into
  a client component.

`npm run verify:gemini` exercises the adapter through injected transports only. A live
Gemini call is a separate protected manual gate and is not implied by offline success.
