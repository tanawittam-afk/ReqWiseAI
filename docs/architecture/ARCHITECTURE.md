# ReqWise AI — Architecture Package

Status: **Architecture Gate — proposed, awaiting approval**
Date: 2026-07-24
Scope authority: `../../CLAUDE.md` (product spec) + the owner's Phase 1 decisions of
2026-07-24 (recorded in `../../HANDOFF.md`).

Companion documents:
- [`DATA-MODEL.md`](DATA-MODEL.md) — entities, immutability, versioning, RLS
- [`AI-OUTPUT-CONTRACT.md`](AI-OUTPUT-CONTRACT.md) — validated output, evidence, mock provider

No feature code, migration, dependency, or UI exists as a result of this document.

---

## A. MVP Scope

### A.1 User journey (the one journey the MVP must serve)

A Business Analyst has a page of messy Thai meeting notes from a Smart Space / room-booking
client. They need reviewable, traceable requirements out of it — and they need to be able
to see *which sentence* produced each requirement, fix what the AI got wrong, and mark
what they accept.

```
sign in
  → personal workspace exists automatically
  → create project, pick domain profile "Booking and Smart Space"
  → paste the meeting notes as a source document
  → choose an available provider and run analysis
  → workspace opens split-pane: source on the left, structured items on the right
  → select a requirement → its source excerpt highlights in the left pane
  → edit a requirement's wording → a new item version is recorded
  → approve it (or mark Needs Clarification) → a review activity is recorded
```

### A.2 First vertical slice

Exactly the journey above, end to end — UI through database. The deterministic mock remains
the no-key default; a server-configured Gemini provider may be selected when it is available.
Sequenced in §E.

### A.3 In scope (MVP)

- Email auth via Supabase; automatic personal-workspace bootstrap
- Project creation under an organization, with a domain profile selected at creation
- Plain-text source document (typed or pasted), stored immutably
- One analysis run over one source document, via the **mock or Gemini provider**
- All 14 analysis item types persisted through one central `analysis_items` table
- Source references with excerpt and offsets, rendered as highlights
- Item editing with version history
- Review actions: approve · reject · needs clarification · comment · status change
- Split-pane Requirements Intelligence Workspace (read + edit + review)
- Domain profile layer with three profiles present in schema; **Booking and Smart Space
  is the only one with real content and a real UI path**

### A.4 Deferred (designed for, not built in MVP)

| Deferred | Where the seam already exists |
|---|---|
| General Software / Custom Domain profiles | `domain_profiles` rows; engine reads them generically |
| Export (Markdown / JSON / CSV / print) | `analysis_items` + `item_relations` are the only inputs an exporter needs |
| Traceability map UI, version comparison UI | `item_relations`, `item_versions` are populated from slice 6 onward |
| Command palette | pure UI addition |
| Multi-source analysis runs | see DATA-MODEL §"Deliberate simplifications" |
| PDF / DOCX ingestion | Source Input Layer boundary is format-agnostic |
| Conflict detection between requirements | `item_relations.relation_type = 'conflicts_with'` reserved |
| Product-wide user rate limiting | provider transport retries are bounded; broader per-user quotas remain deferred |

**Shipped since this table was written** (kept here rather than silently deleted, so the
original deferral and its outcome stay readable): Export, the traceability map, version
comparison, the question/quality workflows, change requests, TH/EN chrome, a public
`/demo`, — in Phase 5 of the 2026-08-03 UX/UI plan — a **workspace-scope layer**
that did not exist in the MVP shape above: `/workspace/dashboard`,
`/workspace/requirements` and `/workspace/reviews` read across every project the caller
can see, on the same user-scoped client and the same RLS policies as the per-project
queries (`lib/workspace/queries.ts`), no new table, no new policy, no new RPC — and, in
Phase 2 of the 2026-09-17 "Usable Product" plan, the **quality score**: a pure function
over an already-loaded run's items (`lib/analysis/workspace-view.ts`'s `qualityScore()`),
surfaced on the analysis workspace's Quality tab (later in the same phase, also as a
small badge on each project card). No coverage percentage or trend shipped alongside
it — those stay deferred, and the score formula itself is fixed and documented, never a
number an AI provider supplies. The same phase also shipped **TH/EN output-language
switching**, editable post-creation (not just at intake, where a control already existed
since Phase 4) via `set_project_output_language()`, plus a third preference,
`"match_source"`: `buildAnalysisInput()` resolves it to a concrete `'th'`/`'en'` per run
using a Thai-character-ratio detector (`lib/analysis/language-detect.ts`) reading the
source's own text — code-decided, never the AI. `analysis_runs.output_lang` itself is
unchanged: still a plain, factual, historical record of what a specific run was actually
written in, never `projects.output_lang`'s current (and now editable) live value —
the export layer (`lib/export/load.ts`) was corrected in the same round to read the
*latest run's* value for exactly this reason, since those two could now legitimately
disagree.

**Still deferred:** coverage percentage and trend, everywhere. The workspace-scope
dashboard (`/workspace/dashboard`) is a **deliberate scope cut, not an oversight**: it
stays score-free even after Phase 2 — every figure there is still a real `count` or the
length of a real list, and the four "outstanding work" numbers are derived by one tested
predicate each (`lib/workspace/outstanding.ts`), so a count and its list cannot drift
apart. A cross-project score rollup was never asked for and isn't built.

### A.5 Out of scope (not designed for)

Team invitations · team-management UI · billing · organization switching · custom role
matrices · ownership transfer · real-time collaboration · external tool integrations
(Jira/Azure DevOps) · test-case generation.

### A.6 Success criteria

1. A user can complete the §A.1 journey without touching the database directly.
2. Every AI-generated item on screen can be traced to an exact excerpt in the source.
3. No item reaches `Approved` without a recorded human `review_activity`.
4. Deleting nothing and updating no run: re-running analysis produces a second run, and
   the first remains byte-identical.
5. The whole slice can run offline — no network and no API key — with the default mock provider.
6. Removing Booking-and-Smart-Space content from `domain_profiles` degrades output
   quality but **breaks no code path** in the Core Requirement Engine.

---

## B. System Architecture

### B.1 Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation — Next.js App Router (server components +      │
│  focused client islands). No business logic. No provider     │
│  calls. Renders only validated data.                         │
└───────────────┬─────────────────────────────────────────────┘
                │ server actions / route handlers
┌───────────────▼─────────────────────────────────────────────┐
│  Application Services — orchestration & authorization        │
│  createProject · addSource · runAnalysis · editItem ·        │
│  reviewItem. Owns transactions. Owns the status workflow.    │
└──────┬──────────────────┬───────────────────┬───────────────┘
       │                  │                   │
┌──────▼────────┐  ┌──────▼─────────┐  ┌──────▼──────────────┐
│ Core          │  │ Domain Profile │  │ Persistence         │
│ Requirement   │◄─┤ Layer          │  │ (Supabase Postgres, │
│ Engine        │  │ data only      │  │  RLS-enforced)      │
│ domain-blind  │  └────────────────┘  └─────────────────────┘
└──────┬────────┘
       │ AiProvider interface
┌──────▼────────────────────────────────────────┐
│ Provider Adapter — mock (default) │ gemini (server-only) │
└───────────────────────────────────────────────┘
```

Cross-cutting: **Human Review Layer**, **Traceability Layer**, **Export Layer** — each
described below as a boundary rather than a tier.

### B.2 Core Requirement Engine boundary

`lib/engine/` — extraction, classification, user-story and acceptance-criteria shaping,
ambiguity detection, missing-information detection, quality validation.

**The engine is domain-blind.** Its only inputs are:

```ts
analyze(input: {
  sources: SourceSnapshot[];
  profile: DomainProfile;   // data, not code
  outputLang: "th" | "en";
  provider: AiProvider;
}): Promise<AnalysisResult>
```

Hard rules — these are the Architecture Gate's acceptance criteria in code form:

- No file under `lib/engine/` may contain the strings `booking`, `smart space`, `room`,
  `refund`, `check-in`, or any other domain noun. This is lint-checkable and should be
  enforced by a test.
- No `if (profile.key === "...")` branch anywhere in the engine. Profiles are consumed as
  data — terminology lists, question templates, validation rules — never as identity.
- Adding a fourth domain profile must require **zero** engine edits.

### B.3 Domain Profile boundary

`lib/domain/` holds the profile *type* and loader; the content lives in the
`domain_profiles` table (seeded, not hardcoded). A profile carries: name, description,
terminology, typical stakeholders, common workflows, common business rules, required
clarification categories, common risks, suggested non-functional requirements, validation
rules, stakeholder question templates.

**A domain profile is context, never evidence.** It may cause a question to be asked or a
validation to fire; it may never be cited as the source of a business fact. Enforced in
the output contract (see AI-OUTPUT-CONTRACT §D.5) — a source reference can only point at a
`source_documents` row, and there is no code path that constructs one from a profile.

### B.4 Provider Adapter

`lib/providers/` — one interface, two implementations, selected by `AI_PROVIDER`
(default `mock`).

```ts
interface AiProvider {
  readonly name: string;
  readonly deterministic: boolean;
  generate(req: ProviderRequest): Promise<ProviderResponse>; // raw, unvalidated
}
```

- Providers return **raw** output. They never validate, never persist, never know about
  Postgres or React.
- Construction happens once, server-side, in a factory. The UI may submit a validated
  provider key and the database records safe provider/model metadata, but neither receives
  credentials, model configuration or a provider client.
- `lib/providers/factory.ts` selects a provider once on the server. `mock` is the default
  and remains available with no key. `gemini` is exposed only when its server-side
  configuration is complete; credentials and model configuration are never client props.
- The Gemini adapter uses native `fetch`, an **ordered configured model chain**, a bounded
  timeout and bounded retry for retryable transport failures. It does not repair model
  output or bypass the shared validation pipeline.
- Provider, actual model and prompt-version metadata cross the persistence boundary so a
  stored run describes what generated it. User-facing errors are projected from typed,
  canonical categories and exclude provider response bodies, prompts, source text, keys
  and request identifiers.

### B.5 Persistence Layer

Supabase Postgres. Two access paths, deliberately unequal:

- **User path** — anon key + user JWT, RLS enforced. Everything the app does on behalf of
  a user goes through this. RLS is the security boundary, not application `if` statements.
- **Trusted path** — service-role key, server-only, used solely for seeding
  `domain_profiles` and for the auth bootstrap trigger. Never reachable from a request
  handler that takes user input.

### B.6 Human Review Layer

Sits between Application Services and Persistence. Owns the status workflow:

`Draft → Needs Clarification → Reviewed → Approved → Rejected → Implemented`

- Every AI item is created as `Draft`. There is no code path that creates any other status.
- Every transition writes an append-only `review_activities` row with the actor.
- The system performs **no automatic transitions.** Nothing but a human action moves an
  item's status — see DATA-MODEL §C.5.

### B.7 Traceability Layer

Two mechanisms, deliberately distinct:

- **Vertical (item → source):** `item_source_references` — how a requirement is *justified*.
- **Horizontal (item → item):** `item_relations` — how requirements *derive from* each
  other: Business Goal → BR → FR → US → AC → (future) Test Case.

Both are first-class rows, never text fields, never denormalized into a description string.

### B.8 Export boundary

`lib/export/` — pure functions: `(items, relations, references, project) → string`.
No database access, no React, no I/O. This is what makes Markdown / JSON / CSV / print
four thin adapters over one shape, and it is why export can be deferred without risk.

**Built in slice 6C — see [`EXPORT.md`](EXPORT.md).** One amendment to the sentence above:
the reads live in `lib/export/load.ts`, the single database-touching module in the folder,
exactly as `lib/traceability/queries.ts` sits beside that folder's pure modules. Everything
downstream of it — `build`, `readiness`, `markdown`, `json`, `csv`, `print` — is pure as
described, which is what let the whole document be tested without a browser or a database.
Export needed **no migration**: it derives everything from existing tables and writes
nothing.

---

## E. Vertical Slice Sequence

Smallest sequence that makes the §A.1 flow work end to end. **Each slice is UI through
database, and each is independently demonstrable.** Do not start slice N+1 until slice N
is verifiable in the running app.

| # | Slice | Delivers | Verified by |
|---|---|---|---|
| 1 | **Auth + workspace bootstrap** | Sign up / sign in / sign out; trigger creates `profiles` + personal `organizations` + `organization_members(owner)` | New user signs in → exactly one personal org exists; a second user cannot see the first's org |
| 2 | **Project create** | Project list + create form; domain profile picked at creation from seeded `domain_profiles` | Project appears for its creator only; `project.organization_id` is the personal org |
| 3 | **Add source document** | Paste/type text, save; source is read-only afterwards | Source renders back verbatim; an UPDATE attempt is rejected by RLS, not by the UI |
| 4 | **Run mock analysis** | `runAnalysis` → mock provider → Zod validation → one `analysis_runs` row + N `analysis_items` + `item_source_references`, in one transaction | Same input twice → two runs, identical validated output; invalid fixture → run stored as `invalid` with zero items |
| 5 | **Workspace read view** | Split pane: source left, items right, grouped by type; selecting an item highlights its excerpt via offsets | Every visible item has at least one highlight, or is explicitly marked assumption/inferred |
| 6 | **Edit item** | Inline edit of title/description/priority → writes `item_versions` | Edit twice → two versions; version 1 unchanged; run's `validated_output` unchanged |
| 7 | **Review + approve** | Approve / reject / needs-clarification / comment → writes `review_activities` and moves status | No status change exists without a matching activity row; history is append-only |

Slices 1–4 are the risky half (auth boundary, RLS, transaction integrity, validation).
Slices 5–7 are mostly UI over shapes already proven.

**Not part of the first slice sequence:** export, traceability graph UI, version-compare
UI, quality score panel, second domain profile. Export/traceability and the Gemini provider
were added in later slices.

---

## Open architectural decisions

Listed in the report; recorded here so they are not lost:

1. **Item ID prefixes beyond `CLAUDE.md`'s examples.** The spec names `BR/FR/NFR/US/AC/RISK/Q`
   but there are 14 item types. Proposed additions: `PS` (problem statement), `OBJ`
   (business objective), `STK` (stakeholder), `RULE` (business rule), `ASM` (assumption),
   `CON` (constraint), `QF` (quality finding). Needs a yes.
2. **`evidence_class` field** (`stated` | `inferred` | `assumed`) added to every item —
   this is what makes "separate facts from assumptions" machine-checkable rather than a
   convention. It is an addition to the example object in `CLAUDE.md`, not a contradiction.
3. **One repair retry on invalid model output** before persisting the run as `invalid`.
   Zero-retry is also defensible. See AI-OUTPUT-CONTRACT §D.8.
