@AGENTS.md

# ReqWise AI

A production-quality AI-assisted **requirements analysis platform**. Unstructured business
information goes in — meeting notes, stakeholder interviews, customer messages, project
briefs, feedback, operational problems — and structured software requirements come out,
for Business Analysts, System Analysts, Product Managers, Developers, Designers, and QA
to review and use.

Multi-domain by design. Primary demonstration domain: **Booking and Smart Space
Management**. Also supported: General Software, Custom Domain. Future profiles: HR,
E-commerce, Retail, Restaurant, Healthcare.

Also a portfolio artifact for Business Analyst / System Analyst roles. Where a choice is
between more impressive engineering and more legible BA judgment, pick the one that makes
the BA thinking visible.

---

## Core product principle-

**The AI assists the Business Analyst. It never decides.** Every rule below follows from
this — if a change would weaken it, stop and ask.

- Separate facts from assumptions, visibly
- Keep every requirement traceable to the source text it came from
- Human review and editing are always available
- Nothing is ever auto-approved
- Surface missing information rather than filling the gap
- Surface ambiguous statements rather than resolving them silently
- Show confidence where it helps a reviewer judge
- Never invent an unsupported business rule

---

## Analysis outputs

An analysis run produces all fifteen:

1. Problem Statement
2. Business Objectives
3. Stakeholders
4. Business Requirements
5. Functional Requirements
6. Non-functional Requirements
7. User Stories
8. Acceptance Criteria
9. Business Rules
10. Assumptions
11. Risks
12. Constraints
13. Open Questions for Stakeholders
14. Requirement Source References
15. Requirement Quality Findings

---

## Stack

Next.js (App Router) · TypeScript **strict** · Tailwind · Supabase (Postgres + Auth) ·
Zod for schema validation · a server-side AI provider adapter · a deterministic mock AI
provider for local development · accessible reusable UI components · unit + integration
tests, and e2e tests on critical flows.

Follow existing repository conventions where they exist. **Do not pin a dependency
version** unless the repository already requires it.

**Do not add a library beyond the list above without asking.** No state-management
library, no component library, no ORM, no i18n package — bilingual TH/EN uses the `<T>` +
`data-locale` CSS-swap pattern copied from `../Portfolio/site`.

**Never expose an AI provider API key to the browser.** Same for the Supabase
service-role key. If either would land in a client component, a `NEXT_PUBLIC_*` var, or a
response body — stop.

---

## Architecture layers

Keep these separated. The Core Requirement Engine stays domain-independent; domain
knowledge lives only in the Domain Profile Layer.

**1. Source Input Layer** — typed text, pasted meeting notes, interview transcripts,
customer messages, plain-text file upload. PDF and DOCX are optional future work; do not
build them unasked.

**2. Core Requirement Engine** — domain-independent: information extraction, requirement
classification, user story generation, acceptance criteria generation, ambiguity
detection, missing-information detection, conflict detection, quality validation.

**3. Domain Profile Layer** — business context injected *around* the engine, never into
it. A profile may carry: domain name, description, terminology, typical stakeholders,
common workflows, common business rules, required clarification categories, common risks,
suggested non-functional requirements, domain validation rules, stakeholder question
templates. Initial profiles: General Software · Booking and Smart Space · Custom Domain.
*Adding a domain must never require editing the engine.*

**4. Human Review Layer** — edit AI content, approve or reject individual requirements,
mark items as needing clarification, comment, update priority and status.

**5. Traceability Layer** — Business Goal → Business Requirement → Functional Requirement
→ User Story → Acceptance Criterion → (future) Test Case.

**6. Export Layer** — Markdown, JSON, CSV where appropriate, printable requirement
document. PDF and external integrations come later.

---

## Data model

Entities: User · Organization · Project · Domain Profile · Source Document · Source
Segment · Analysis Run · Requirement · Requirement Relation · User Story · Acceptance
Criterion · Risk · Assumption · Constraint · Open Question · Requirement Version · Review
Activity.

Every generated requirement supports: stable ID · requirement type · title · description ·
priority · status · source references · confidence · review state · created and updated
timestamps.

ID format — stable, zero-padded, never renumbered once issued:
`BR-001` · `FR-001` · `NFR-001` · `US-001` · `AC-001` · `RISK-001` · `Q-001`

Traceability is the point of this product. **Do not drop IDs or source references to
simplify a component.**

### Mutability — read this before touching persistence

Two different rules, easy to conflate:

- **Analysis Run is immutable.** The raw validated model output is preserved exactly as
  returned. Re-running inserts a *new* run. Never `UPDATE` a run — the before/after
  history is a feature.
- **Requirements are editable** — that is the whole Human Review Layer. Every edit writes
  a **Requirement Version** row and a **Review Activity** row. History is append-only;
  the current state is mutable.

### Status workflow

`Draft` → `Needs Clarification` → `Reviewed` → `Approved` → `Rejected` → `Implemented`

**AI-generated requirements always start as `Draft`.** No code path may create a
requirement in any other status.

### Priority

`Critical` · `High` · `Medium` · `Low` · `Unassigned`

**Do not infer `Critical` without strong evidence** in the source. `Unassigned` is the
honest default.

---

## AI output contract

`lib/schema.ts` is the single source of truth for the analysis output contract. The
provider adapter, the Zod validator, the UI renderer, and the Markdown/JSON/CSV exporters
all read from it — a field name must never get a second definition.

Model output is **validated before it is stored or rendered**. Never render unvalidated
model output in the UI.

A generated item looks like:

```ts
{
  id: string;
  type: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low" | "unassigned";
  status: "draft";
  sourceReferences: Array<{
    sourceId: string;
    excerpt: string;
    startOffset?: number;
    endOffset?: number;
  }>;
  confidence: number;
  rationale?: string;
}
```

### Provider rules

- All model calls go through the **server-side provider adapter**. No component calls a
  provider directly.
- The **mock provider is deterministic** — same input, same output, no network. Local
  development and tests run on it.
- **Never pin a single model.** Keep an ordered fallback chain. A pinned model gets
  retired and takes the whole app down with it — this already happened once in
  `../Job Application Tracker Dashboard/api/match.js`.
- **Rate-limit every route that spends money on a model call.**
- UI language (chrome) and output language (what the model writes in) are two separate
  controls. Do not collapse them into one toggle.

---

## Demo domain — Booking and Smart Space

Actors: Customer · Walk-in Customer · Marketing User · Front Desk Staff · Operations
Staff · Administrator · Management.

Workflows: room search · room booking · walk-in booking · customer identity · payment ·
check-in · QR verification · room usage · drink ordering · cancellation · refund ·
post-service feedback · CRM campaign activation.

**Assume no cancellation, refund, payment, or identity policy that is not in the source
information.** A missing policy produces a clarification question, never a plausible
guess. This is the sharpest test of the core principle above.

---

## Design direction — "tech" workspace, light + dark

> **Full specification: [`docs/design/INTERFACE.md`](docs/design/INTERFACE.md)** — the
> three-panel structure comes from the owner's Final Interface Direction (2026-07-25); the
> visual language (this section's "Visual character") was replaced 2026-08-02 with a
> "tech" redesign shipped across 7 phases (`HANDOFF.md` has the commit record). That file
> is authoritative; this section is its summary.
>
> **Dark mode is shipped, not prepared-and-unused.** Both `:root` (light) and
> `[data-theme="dark"]` are fully defined in `app/globals.css`, switchable at runtime via
> the toggle in the sidebar/toolbar, persisted to `localStorage`. Every component reads
> the shared tokens — never a hardcoded colour, never Tailwind's `dark:` variant (that
> bypasses the toggle and follows the OS instead; this broke once in `auth-form.tsx`, see
> `HANDOFF.md`).

A precise, technical analytical workspace. Not a generic admin dashboard. Not a chatbot
page. Usability, information density and long-form reading come before decorative effects.

**Visual character:** hairline borders and background-shade shifts for depth, plus a soft
shadow on resting cards and panels **in light mode only** (`--shadow-card`/
`--shadow-panel`, added 2026-09-02 — see `INTERFACE.md` §9 for why the original
no-shadow rule was reversed and how dark mode still gets none) · one saturated primary
accent (`--accent`, blue) for interaction/selection · a second accent (`--signal`, green)
reserved exclusively for citation/liveness, never decoration · soft per-item-type tints
(`--tint-context`/`-requirement`/`-spec`/`-caveat`) for the four content families, always
paired with the item type's own text label, never colour alone · controlled
`--ok`/`--warn`/`--danger` status colors, always paired with a word · sharp small radii
(`--radius-card: 4px` controls, `--radius-panel: 6px` panels), never Tailwind's default
`rounded-lg`/`rounded-md` · mono type (JetBrains Mono) for IDs/counts/badges, a geometric
display face (Space Grotesk) for headings/nav, Inter for body · high density without
crowding · motion of 120–220ms, only for panel collapse, inspector opening, selection,
highlight navigation and loading.

**Every interactive action is visibly framed, in three tiers** (added 2026-09-02, after
an owner audit found bare underlined text standing in for buttons in 13 places and sidebar
items with no border at rest — "หาปุ่มไม่เจอ"): primary (filled accent), secondary
(surface fill + a clear border), tertiary/ghost (transparent + a hairline border — never
bare text). See `app/_components/ui/action-styles.ts`, `button.tsx` and `action-link.tsx`
for the one shared definition both a client `Button` and a server-renderable `ActionLink`
draw from.

**Signature interface** — the Analysis Workspace is a stable **three-panel** layout:
**Source Document · Requirements · Requirement Inspector**. The requirements panel is the
largest, and holds requirement rows as small **bordered cards**, each with its own frame,
radius and light-mode shadow (revised 2026-09-02 from the original "compact rows, not
cards" — the owner's trade-off: fewer rows visible per screen, in exchange for a row a
reader can actually tell apart from its neighbours; see `INTERFACE.md` §5). Selecting a
requirement highlights the exact source excerpt it came from; the inspector shows that
item's detail without a modal and can be collapsed. Below `xl` the inspector becomes a
drawer; on tablet portrait and mobile a segmented control shows one panel at a time,
preserving the selection. Open questions and quality findings stay reachable without
leaving the workspace, on their own tab.

**Components:** application sidebar · compact toolbar · one-row analysis summary · source
panel with in-panel search and highlight navigation · grouped requirement cards ·
requirement inspector · domain selector · source editor · open-question queue ·
traceability map · version comparison view · command palette · review status controls.

**Avoid:** neon saturation as a resting-state color (reserve it for `--signal` citation
moments only) · permanent glowing relationship lines · excessive gradients or
glassmorphism · floating decorative orbs · oversized KPI cards · marketing-style hero
sections **inside the app** (the public landing page at `/` is a separate, already-
established exception — it sits outside the workspace shell) · generic template
dashboards · chat bubbles as the primary interaction · a
shadow anywhere in dark mode, or a shadow heavier than `--shadow-card`/`--shadow-panel` in
light mode · a Tailwind `dark:` class on any component · decoration that costs
readability · an action rendered as bare underlined text with no border.

**Never invent a metric to fill a mockup.** The reference render shows a quality score,
coverage percentages and sparklines; no such data exists, and the quality-score panel is
deferred by `ARCHITECTURE.md` §A.4. Show what the database holds.

---

## Accessibility

Keyboard navigation · visible focus states · readable contrast · semantic HTML · labels on
every form control · **never communicate status by color alone** · respect reduced-motion
preferences where practical.

---

## Engineering rules

1. Inspect the relevant existing files before editing.
2. Follow current repository conventions.
3. Implement only the requested step.
4. Do not implement future steps unless required as a minimal dependency.
5. Do not perform unrelated refactoring — flag it, don't fix it.
6. Reuse components before creating duplicates.
7. Keep business logic out of presentation components.
8. Validate all external and AI-generated data.
9. Add tests for important logic.
10. Never commit secrets.
11. Update `.env.example` when adding an environment variable.
12. Preserve unrelated user changes.

### Do not touch without asking

- `.env.local` and any key or secret
- Supabase migrations already applied to the live project
- `package-lock.json`, `node_modules/`, `.next/`
- The `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md` (tool-managed)

---

## Working method

**Before editing:** inspect only files relevant to the current step · summarize the
current implementation briefly · identify the minimum file set to modify.

**While editing:** don't rewrite large files unnecessarily · don't duplicate documentation
· no speculative architecture · **prefer one small complete vertical slice over several
incomplete features**.

**After editing, report:**

1. What was implemented
2. Files created or changed
3. Important technical decisions
4. Tests or checks executed
5. Test results
6. Known limitations
7. Manual verification steps
8. Recommended next step

Write implementation reports **in Thai**, except code and technical identifiers.

---

## Definition of done

1. `npm run build` and `npm run lint` pass clean
2. Tests pass — unit and integration for logic, e2e for a critical flow
3. The behavior was exercised in the running app, not just compiled
4. Anything touching auth or data: verified as a *second* user that RLS still hides the
   first user's rows
5. `.env.example` updated if an environment variable was added
6. `HANDOFF.md` reflects the current state
