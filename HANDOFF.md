# ReqWise AI — Handoff

**Read `CLAUDE.md` first.** It holds the stack lock, the project rules, and the
definition of done. This file holds *state*: where the build actually is right now.

Last updated: 2026-09-02 (**Phase 8 shipped end to end — the master plan is now
complete.** The seed-apply blocker below was cleared: the owner resumed the paused
Supabase project from the dashboard, and `npx supabase db query --linked -f
supabase/seed.sql` applied cleanly. Confirmed live via `select key, name,
jsonb_array_length(...) ... from domain_profiles`: `general_software` now shows
**terminology_count: 4** (was 0), **business_rules_count: 4** (was 0),
**workflows_count: 8** (was 4), `is_active: true` — matching the enriched TypeScript
exactly, alongside `booking_smart_space`'s unchanged 4/3/8. **All 8 phases of the
2026-08-03 UX/UI Master Plan are now shipped.** Not yet done, and not blocking: a live
`claude-in-chrome` check that `/workspace/projects/new` actually renders General
Software as selectable against a real signed-in session — the code wiring
(`SUPPORTED_DOMAIN_PROFILE_KEYS`) is confirmed correct by direct read of both call
sites, just not exercised live this round.)

Earlier: 2026-09-02 (**Phase 8 — General Software domain, code shipped, DB seed
apply blocked.** The master plan's last phase. `general-software.ts` enriched to
booking's depth, `"general_software"` added to `SUPPORTED_DOMAIN_PROFILE_KEYS`,
`supabase/seed.sql` regenerated. Verified offline with a throwaway mock-provider run
(15 items, all 13 output types, matching the booking profile's spread on the same
text) before flipping the flag — `build`/`lint`/`typecheck`/`test` clean, 800/800.
Applying the regenerated seed to the live database is **blocked**: the linked Supabase
project is `INACTIVE` (paused) and the CLI has no way to wake it — needs the account
owner to resume it from the dashboard, then rerun `npx supabase db query --linked -f
supabase/seed.sql`. See "Phase 8" below for the full writeup and the exact resume
command. One commit: `1e034ad`.)

Earlier: 2026-09-02 (**i18n sweep closed out — exports, sources, project
overview.** Continuation of the round Phase 7 disclosed as incomplete. Six commits:
exports (`eb0a8d6`), sources list + form (`5501df9`), source detail/edit/analyze flow
(`e298eb3`), projects list (`58f9074`), project overview + archive controls
(`23bea60`), and this HANDOFF update. **Grep count: 67 of 83 `.tsx` files now use
`<T>`/`useLocale`, up from 33 at the start of this round** (`grep -rl "<T \|useLocale"
app --include=*.tsx | wc -l`). Every file named as a gap in the Phase 7 follow-up entry
below is now swept. The 16 remaining files are audited, not skipped — each is one of:
a UI primitive with no hardcoded strings (`button`/`chip`/`empty-state`/`notice`/
`tabs.tsx`), infra (`icon.tsx`, `t.tsx`), a pure structural component with no literal
text (`workspace-item-row.tsx`, `analyses/[runId]/_components/panel.tsx`), a metadata-
only file with nothing rendered (`app/layout.tsx`, `demo/layout.tsx`, `demo/page.tsx`),
a pure redirect (`app/workspace/page.tsx`), or `exports/_components/document.tsx` —
deliberately excluded per CLAUDE.md: export output is a document governed by
`analysis_runs.output_lang`, not chrome. Two shared-vocabulary label maps remain the
same deliberate, permanent scope boundary Phase 7 already recorded — `SOURCE_KIND_LABELS`
(`lib/contracts/source.ts`) joins `STATUS_LABEL`/`PRIORITY_LABEL`/`TYPE_LABEL`/
`TYPE_SHORT_LABEL`/`EVIDENCE_LABEL` (`item-labels.ts`) and the review-activity label
maps as the same kind of gap: localizing them means threading a `locale` argument
through a lib layer that returns plain strings today, consumed by multiple call sites
outside any one page's file list. Provider labels (`providerLabel()`) are also
untranslated by design — the master plan's trap #2: the run header must always
disclose which real provider produced a run, in the terms it actually ran under.
`npm run build`/`lint`/`typecheck`/`test` clean after every slice (800/800 throughout).
`vitest.config.ts` gained a `resolve.alias` for `@/` (mirroring `tsconfig.json`, no new
dependency) — `tests/providers/selection.test.ts` directly renders
`AnalysisProviderControls`, which now imports `app/_components/t` the same way every
other swept component does; Vitest doesn't share Next.js's path-alias resolution, so
this was the one place the gap was actually exercised by a test. No browser
verification pass this round — same disclosed limitation as the entry below;
build/lint/typecheck/test plus direct diff review were the verification method.)

Earlier: 2026-08-05 (**Phase 7 follow-up — i18n sweep continued + real browser
verification.** Closes the two gaps Phase 7 explicitly disclosed as incomplete: the i18n
sweep and a live keyboard/browser pass. Eight commits.

**i18n:** seven more slices wrapped in `<T>`/`useLocale()`+`pick()` — auth screens
(sign-in/sign-up/`AuthForm`, whose `submitLabel` prop became a `sign-in`|`create-account`
enum instead of a free English string), the four workspace-root pages (dashboard,
requirements, reviews, settings), shared chrome (`badges.tsx`, `item-chips.tsx`,
`theme-toggle.tsx`, `project-nav.tsx`), and the analysis workspace's summary bar, source
panel, requirement row, workspace shell, result-page header, and requirements panel
(tabs/search/filters/groups). **Grep count: 33 of 83 `.tsx` files now use `<T>`/
`useLocale`, up from 14 at the start of this round** (`grep -rl "<T \|useLocale" app
--include=*.tsx | wc -l`). Still untranslated and left for a future round: the
inspector (`inspector.tsx`, the single largest remaining file), the review/workflow/
change-request action panels, history panel, traceability, exports, sources and
projects-list pages/forms — all disclosed, none silently skipped. Two label maps are a
**deliberate, permanent scope boundary**, not a gap: `STATUS_LABEL`/`PRIORITY_LABEL`/
`TYPE_LABEL`/`TYPE_SHORT_LABEL`/`EVIDENCE_LABEL` (`item-labels.ts`) and `activityLabel()`
+`WORKFLOW_ACTIVITY_LABEL`/`CHANGE_REQUEST_ACTIVITY_LABEL` (`lib/review/history.ts`,
`lib/contracts/*.ts`) are shared status vocabulary consumed by many components outside
this round's file list — localizing them means threading a `locale` argument through a
lib layer that today returns plain strings, which is a bigger, separate piece of work
than "wrap the JSX this page renders."

**Browser verification, actually run this time** (previous two sessions could not
get a real session going): signed in as `slice3.demo@reqwise.dev`, `claude-in-chrome`,
dev server on `localhost:3000`. Found and fixed two real bugs along the way:

1. **The skip link never moved keyboard focus.** It scrolled to `#main-content` (URL
   hash changed) but focus stayed on `<body>`, because none of the skip link's three
   targets (`app/page.tsx`, `app/workspace/layout.tsx`, `app/demo/layout.tsx`) carried a
   `tabindex`. Fixed with `tabIndex={-1}` plus a `focus-visible` outline (existing
   `--accent` token) on all three. Confirmed via `.focus()` + click-activation: focus now
   lands on the correct element every time.
2. **A Next.js 16 dev warning fired on every load**: `scroll-behavior: smooth` is set
   deliberately in `globals.css`, but `<html>` never declared
   `data-scroll-behavior="smooth"`, so Next.js logged a warning every navigation. Added
   the attribute to `app/layout.tsx`. Confirmed gone via `read_console_messages` on a
   fresh navigation.

**What was and wasn't exercised:** `resize_window` returns a "success" message in this
session (previous two sessions got an outright error) but **does not actually change the
render viewport** — `window.innerWidth` stayed `1920` regardless of the width requested,
confirmed via JS after each call. The sandbox is still effectively pinned above `xl`
(1280px), so the inspector drawer's `lg`–`xl`-only `role="dialog"`/`aria-modal`/Escape
code path (added Phase 7, commit `5df86c3`) was **read and confirmed correct in code, not
exercised live** — same honest limitation Phase 6 recorded, still true. What *was*
exercised live: theme + language toggles across dashboard/project/analysis-workspace
screens (instant swap, zero console errors, zero hydration warnings, confirmed via
`read_console_messages`); the Inspector open/close toggle and its static third-column
behavior at the sandbox's actual width; Escape correctly doing nothing to the inspector
at that width (it is not a dialog there, by design); two `EmptyState` primitive
instances triggered live (`requirements-view.tsx`'s filter-miss state via
`/workspace/requirements`, and `requirements-panel.tsx`'s own filter-miss state inside
the analysis workspace) — both rendered with a working next-action link
(`Clear filters`), the second one correctly in Thai per this round's own translation.
Pure multi-step keyboard-only `Tab`/`Return` sequences via the `computer` tool's `key`
action were **unreliable in this sandbox** — the same single action sometimes landed on
the expected element and sometimes did not, independent of any application code (isolated
by re-testing the identical sequence multiple times with waits inserted). Mouse clicks,
programmatic `.focus()`, and single Tab-then-check spot-checks were consistently
reliable and are what the findings above rest on; a genuinely continuous human keyboard
session remains the gold-standard confirmation this environment could not fully replace.

Earlier: 2026-08-05 (**UX/UI Master Plan Phase 7 (Visual polish and i18n
completion) shipped** — five slices, five commits: the `lucide-react` icon rollout is
now complete (every remaining unicode glyph used as an icon, ~35 call sites across the
sidebar, toolbar, inspector, badges, chips, and every "← Back"/"↗ external" link, now
renders through `app/_components/icon.tsx`); the `--space-shell-*` page-shell spacing
token (`app/globals.css`) closes the audit's "no spacing scale" finding for the one
place density actually drifted (the outer page wrapper's `gap-*`, unified from a
3–8 spread to one value); the Phase 1 `EmptyState` primitive finally has real call
sites (sources, projects, exports, traceability, requirements); a skip link plus
`#main-content` and the `lg`-breakpoint inspector drawer's `role="dialog"`/
`aria-modal`/Escape handler close the three accessibility gaps the audit named; and a
bounded i18n pass wrapped the toolbar breadcrumb and account menu. Motion was audited
(every transition already 150–200ms, inside the 120–220ms budget) and needed no
changes. `INTERFACE.md`'s Implementation notes table gained four new rows. See "Phase
7" below for the full five-slice breakdown, the tab-pattern decision (kept
`aria-pressed`, did not adopt `role="tablist"`), and what the i18n sweep did and did
not cover.

Earlier: 2026-08-05 (**UX/UI Master Plan Phase 6 (Mobile) shipped** — the whole app
now holds a 44px-touch-target-until-`lg` line, not just the analysis workspace: sidebar
becomes a stacked nav behind a Menu button below `md`, every project/source/export/
traceability "back" link and control that used to be a 36px desktop-only target now
carries `min-h-11 lg:min-h-9`, and the traceability matrix's wide `<table>` (already
scrolling in its own container) was audited and left alone. `INTERFACE.md` §13 row added.
See "Phase 6" below for the six-slice breakdown and how breakpoint correctness was
verified when the sandbox's `resize_window` tool turned out to be non-functional.

Earlier: 2026-08-05 (**UX/UI Master Plan Phase 5 (Navigation and Dashboard) shipped**
— four new routes (`/workspace/dashboard`, `/workspace/requirements`, `/workspace/reviews`,
`/workspace/settings`), the sidebar rebuilt so every entry works, the `startsWith`
active-state bug fixed, a project sub-nav added, and `INTERFACE.md` §7 + `ARCHITECTURE.md`
§A.4 rewritten in the same commit. 800/800 tests (was 762). See "Phase 5" below.
The plan's stated risk for this phase — *"RLS must be re-proven, not assumed"* — is
closed: a new `npm run verify:workspace` passes **12/12** against the live project,
proving a second user sees **zero** of the first's rows on all four new queries. One
**new** finding while doing it: the cleanup dry-run's `unknown` bucket is no longer
empty — nothing is at risk, but see the section of that name.)

Earlier: 2026-08-04 (**UX/UI Master Plan Phase 4 (remove the friction) shipped** —
`/workspace/projects/new` is now one screen that creates the project, stores the source
and runs the first analysis in one submission, plus a one-click "try an example" path.
Measured: example flow **7.1s**, real flow **8.9s**. See "UX/UI Master Plan" immediately
below. One pre-existing, unrelated failure was found while verifying — see
"`verify:analysis` manifest drift" below; it is **not** caused by Phase 4 and was left
for the owner to decide on.)

Earlier: 2026-08-03 (Phase 3 landing page shipped — `/` rewritten into a real
introduction with two real screenshots from `/demo` and deep-linked claims. Same day,
earlier: Phase 2 (public demo) shipped, Phase 1 (Foundation kit) shipped, the plan
itself was agreed, and before that `buildGeminiPrompt()` was tuned to fix the offset and
relation validation failures the 2026-08-02 live verification found — see "Gemini prompt
tuning" below.)

---

## 🗺️ UX/UI Master Plan (agreed 2026-08-03) — the next body of work

**Full plan:** `C:\Users\User\.claude\plans\abundant-herding-ember.md`. Read it before
starting any phase; this section is the index and the state pointer.

**Status: all 8 phases done as of 2026-09-02. This is the master plan's last phase —
nothing is planned beyond it.**

### Phase 8 — shipped 2026-09-02

**Goal, per the plan:** prove the Domain Profile Layer boundary by shipping a second
working domain, with zero engine or provider-prompt changes.

- **`lib/domain/profiles/general-software.ts` enriched** to comparable depth with
  `booking-smart-space.ts` — the plan's two named gaps (`terminology`,
  `commonBusinessRules`, both previously empty) are filled, along with every other
  field, all within `profile-schema.ts`'s length/count limits. Only `terminology`,
  `commonWorkflows` and `requiredClarificationCategories` actually feed the mock
  provider's `profileVocabulary()` (`lib/providers/mock/runtime/lexicon.ts`); the rest
  exist for future real providers and for the Settings page's profile display, per
  `DomainProfile`'s full shape (`lib/domain/types.ts`) — enriching them is correct for
  parity, not for mock-output richness.
- **`"general_software"` added to `SUPPORTED_DOMAIN_PROFILE_KEYS`**
  (`lib/domain/availability.ts`) — the entire blast radius of this one line: it's now
  selectable (not "Coming soon") on `/workspace/projects/new`, and Settings drops its
  unsupported-domain caveat for it.
- **`supabase/seed.sql` regenerated** via `npm run seed:profiles` (pure codegen, no DB
  touched) — diff confirmed to only change the `general_software` row's content.
- **Verified offline before flipping the flag** (the plan's trap #10 — "a domain that
  yields 2 items looks broken"): a throwaway script (not committed, deleted after use)
  ran the real mock provider directly against the enriched profile with realistic
  admin-dashboard meeting-notes text and got **15 items across all 13 output types** —
  identical spread to the booking profile on the same text. `npm run build`/`lint`/
  `typecheck`/`test` all clean, 800/800 (`tests/domain/seed-sync.test.ts` covers the
  regenerated seed).
- **DB apply — first attempt blocked, second attempt succeeded.** The linked project
  (`ReqWiseAI`, `rgfwtflsvnlgfiuoxowm`) was `INACTIVE` (Supabase free-tier auto-pause);
  `npx supabase db query --linked -f supabase/seed.sql` failed with a connection
  timeout, and the CLI has no `restore`/`resume` subcommand to wake it programmatically.
  The owner resumed the project from the Supabase dashboard; a retry of the same
  command then applied cleanly. Confirmed with a direct select
  (`select key, name, jsonb_array_length(content->'terminology') as
  terminology_count, jsonb_array_length(content->'commonBusinessRules') as
  business_rules_count, jsonb_array_length(content->'commonWorkflows') as
  workflows_count, is_active from domain_profiles order by key;`):
  `general_software` → `terminology_count: 4` (was 0), `business_rules_count: 4`
  (was 0), `workflows_count: 8` (was 4), `is_active: true` — exactly matching the
  enriched TypeScript, next to `booking_smart_space`'s unchanged 4/3/8.
- **Not yet done, and not blocking**: a live `claude-in-chrome` check that
  `/workspace/projects/new` renders General Software as selectable against a real
  signed-in session, and that Settings drops its unsupported-domain caveat for it.
  The code-level wiring (`SUPPORTED_DOMAIN_PROFILE_KEYS`, both call sites) is confirmed
  correct by direct read, and the database row backing it is now live and enriched —
  this is a UI-rendering smoke check, not a question of whether the feature works.

### Phase 1 — shipped 2026-08-03

- **i18n mechanism** — `lib/i18n.ts` (`useLocale()`, `pick()`), `app/_components/t.tsx`
  (`<T en="…" th="…">`), `app/_components/lang-toggle.tsx`, all ported from
  `../Portfolio/site` and adapted to this repo's naming (`reqwise-locale` storage key,
  matching `reqwise-theme`). CSS swap rules and the toggle's pressed-state rule added to
  `app/globals.css`, duplicated inside `@media print` so a printed export can never show
  both languages. Pre-paint script in `app/layout.tsx` extended to stamp `data-locale`
  before first paint alongside the existing `data-theme` stamp — no flash of either.
  **Chrome only** — never wraps requirement content, source text, or export output,
  which follow `analysis_runs.output_lang`, a separate axis by design (CLAUDE.md).
- **Icons** — `lucide-react` added (the one approved dependency), behind
  `app/_components/icon.tsx`'s single `<Icon name="…">` mapping so a future swap stays a
  one-file change. Not yet rolled out past the mapping module itself — replacing the
  sidebar/toolbar unicode glyphs is Phase 7's job, per the plan's trap #11 (no
  mass-migration).
- **UI primitives** — `app/_components/ui/{tabs,select,chip,notice,button,empty-state}.tsx`,
  each extracted from an existing local definition (`requirements-panel.tsx`,
  `inspector.tsx`, `review-actions.tsx`, and the empty-state pattern repeated in
  `sources/page.tsx` / `projects/page.tsx`) rather than invented. Call sites are **not**
  migrated to them yet — same rule as icons, converted opportunistically as later phases
  touch those files.
- **Smoke-tested, not a translation pass:** the sidebar's nine labels and the toolbar
  breadcrumb wrapped in `<T>` as the mechanism's first live instance, with `LangToggle`
  placed next to the existing `ThemeToggle` in both the sidebar (desktop) and toolbar
  (the `md:hidden` mobile strip) — mirroring `ThemeToggle`'s exact placement and
  `compact` prop pattern. The real copy sweep is Phase 6.
- **Verified:** `npm run build`/`lint`/`typecheck`/`test` all clean (731/731) ·
  `grep -rn "dark:" app/` empty · browser-checked on `localhost:3000` signed in as the
  `slice3.demo@reqwise.dev` session already in the dev profile — toggling EN⇄TH is
  instant in both directions, persists across a reload with no flash, produces **zero**
  console errors/warnings and **zero** network requests (confirmed via
  `read_console_messages` and `read_network_requests` after the click, not just by eye).

### Phase 2 — shipped 2026-08-03: the public demo

**`/demo` is live, public, no login required.** Confirmed by the build itself: it
compiles as `○` (static, prerendered) alongside every other truly static route — no
per-request cost, because nothing on the page reads a database or a session.

- **`lib/demo/`** — headless, DB-free, exactly mirroring the real query shapes:
  - `scenario.ts` — a fresh TH/EN meeting-notes source, authored (not copied from the
    test fixture) and hand-tuned against the mock strategy's real trigger words
    (`lib/providers/mock/runtime/lexicon.ts`) so it genuinely exercises obligation,
    staff, customer, booking and an unresolved-cancellation line — not hoping the
    engine finds something to say.
  - `ports.ts` — `demoPorts()`, mirroring `lib/analysis/production-ports.ts` with a
    **fixed clock** (`2026-08-01T00:00:00.000Z`) so server and client agree byte-for-byte
    and nothing hydration-mismatches. Unlike the production port, this allocator's
    `displayIds` output *is* the real display id shown — nothing persists to overwrite it.
  - `build.ts` — `buildDemoRun(lang)`: `createMockProvider()` → `runAnalysis()`, throws
    if the result isn't `valid`, memoized per language.
  - `view.ts` — maps `NormalizedAnalysis` onto `AnalysisWorkspaceRun` / `SourceDetail` /
    `Record<string, ItemHistory>`, replicating `lib/analysis/queries.ts`'s own
    `relatedDisplayIds`/`changeRequestCandidateItemIds` derivation field-for-field.
    `workflowState` is `'open'` for `open_question`/`quality_finding` and `null`
    otherwise — the same CHECK constraint the database enforces, not a guess.
    `history` is honestly `{versions:[],activities:[]}` per item: nothing was ever
    reviewed, so there is nothing to show.
- **The architectural decision, verified before writing any UI:** `AnalysisWorkspace`
  (`.../analyses/[runId]/workspace.tsx`) is pure-props with no Supabase client, and
  every mutating `<form>` inside `Inspector`/`ReviewActions`/`WorkflowTab`/
  `ChangeRequestsTab`/`ItemEditForm` is conditionally rendered **only** when
  `canReview`/`canAct` is true — read line by line to confirm, not assumed. `/demo`
  passes `canReview={false}`, so zero mutating forms ever reach the DOM, and every
  server action in `actions.ts` re-derives auth via `createClient()` + RLS regardless.
  Demo item ids are sequential strings (`item-1`, …), not real UUIDs, so even a crafted
  submission resolves to nothing. No panel component contains a single `Link`/`href` —
  confirmed by grep — so there was nothing to neutralise.
- **`proxy.ts`** — `/demo` added to the matcher's negative lookahead alongside
  `_next/static` etc., so it is a genuinely static request, not one that calls
  `supabase.auth.getUser()` on every load for no reason.
- **`app/demo/`** — own `layout.tsx` (not `workspace/layout.tsx`, which calls
  `getUser()` and redirects) with a minimal `DemoHeader` (brand, theme + lang toggles,
  Sign in / Create account). `page.tsx` computes both language datasets server-side;
  `DemoWorkspace` (client) picks between them via `useLocale()` and remounts
  `AnalysisWorkspace` on locale change — a deliberate, documented exception to "UI
  language and output language are two separate controls," scoped to this one
  no-account demo page (see the file's own comment for why the real app keeps them
  separate but this page does not need to).
  A persistent, non-dismissible banner states plainly what the page is: read-only,
  engine-generated, no account, no database.
- **`app/demo/_components/tour.tsx`** — the guided-explanation layer. Deliberately
  **not** pixel-anchored markers glued to each panel (that would mean duplicating
  `workspace.tsx`'s three-breakpoint layout logic in a second file — exactly the "fork
  the shared component" risk the plan chose not to take). Instead: a floating button
  opening a rail of four real, keyboard-reachable buttons, each toggling its own
  explanation via `aria-expanded`/`aria-controls` — never a hover tooltip. Auto-opens
  once for a first-time visitor via `useSyncExternalStore` (the same technique
  `useLocale()` uses, not a `useEffect`+`setState` pair — the latter tripped
  `react-hooks/set-state-in-effect` and risked a hydration mismatch besides), stays
  closed on repeat visits once dismissed. Copy is about BA judgment ("nothing here
  fabricates a quotation to look more certain than it is"), not features.
- **Entry points** — `/` gained a primary "See the demo" button (ahead of Sign
  in/workspace), `/sign-in` and `/sign-up` gained a secondary "Just curious? See the
  demo" link. `/page.tsx` itself gets its full rewrite in Phase 3; this is the minimum
  to make the demo reachable today.
- **Verified:**
  - `tests/demo/build.test.ts` (14 tests, both languages): valid non-trivial analysis
    (8–20 items) · every citation an exact, offset-verified substring of the scenario
    text · every `inferred`/`assumed` item carries a rationale · every item `draft` ·
    deterministic across repeated calls · every item's history honestly empty · every
    `changeRequests` list honestly empty · `workflowState` matches the CHECK constraint
    exactly · `SourceDetail.rawText` matches the scenario byte for byte.
  - `npm run build`/`lint`/`typecheck`/`test` all clean (745/745) · `/demo` compiles `○`
    static.
  - Browser-checked on `localhost:3000`: all three panels render with real generated
    content (12 requirements, 3 open questions, 1 quality finding, 1 risk) · selecting a
    requirement correctly highlights its exact source excerpt · the inspector's
    read-only notice renders exactly as the `canReview={false}` code path predicts ·
    toggling EN⇄TH swaps the chrome, the banner, *and* the analysis content together,
    with zero console errors and zero hydration warnings after the remount · light and
    dark themes both correct · `read_network_requests` after full interaction showed
    **zero requests to any Supabase host** — only the dev server's own static assets —
    which is the one check that actually proves the architecture held · mobile width
    checked via the same same-origin-iframe technique HANDOFF has used before (the
    browser window itself is not resizable in this environment): 390px wide,
    `scrollWidth === clientWidth` on `<html>`, the responsive segmented control
    (Source · Requirements · Inspector) rendered correctly with no horizontal overflow.

### Phase 3 — shipped 2026-08-03: the landing page

**`/` is a real introduction now** — was a heading, three lines and one button.
Deliberately **static** (`○` in the build output): the previous version called
`getUser()` purely to choose one button's label; dropped, since a signed-in visitor
who clicks "Sign in" anyway lands on `/workspace` via `proxy.ts`'s existing redirect.
This is a deliberate behaviour change, not an oversight.

- **`app/_components/site-header.tsx`** — promoted out of `app/demo/_components/
  demo-header.tsx` (Phase 2) rather than duplicated: the landing page needed the
  identical header (brand, theme/lang toggles, sign in/create account), so Phase 2's
  component became the shared one. `app/demo/layout.tsx` updated to import from the
  new location; the old file deleted, not left behind as dead code.
- **Sections, all TH/EN via `<T>`:** hero (one-sentence problem statement, primary "See
  the demo" / secondary "Sign in") → two real screenshots from `/demo` (see below) →
  three-step "How it works" (paste/analyse/review, icon + text, no screenshot needed)
  → four "not a chatbot" claims, each a card linking to `/demo?item=<display id>` →
  a short, honest stack note (no invented capability) → footer CTA repeating the
  primary action.
- **`?item=` deep-linking added to `/demo`** (`app/demo/page.tsx`,
  `demo-workspace.tsx`) so the landing page's claims can link to the exact item that
  proves them. Takes a **display id** (`Q-001`), not a database uuid — resolved
  client-side against whichever language dataset is active, because display-id
  allocation order is identical between the TH and EN runs (the mock strategy pushes
  items in a fixed order regardless of language) but the underlying item ids are not
  shared between them. Confirmed the exact ids by a throwaway test run before writing
  any landing-page copy, rather than guessing: `BR-001` (cited business requirement),
  `Q-001` (stated, cited open question — the cancellation line), `Q-002` (assumed,
  no-citation open question), `QF-001` (the one quality finding).
  **Side effect, confirmed in the build output:** `/demo` changed from `○` static to
  `ƒ` dynamic, because reading `searchParams` in an App Router page forces per-request
  rendering. Still zero database and zero auth calls — `buildDemoRun()` is memoized at
  module scope, so the per-request cost is the same pure computation, just no longer
  prerendered at build time. A deliberate, small trade for the deep-link feature.
- **Two real screenshots**, captured from `/demo` itself (guaranteed no real user's
  data by construction) via `claude-in-chrome`, saved to `public/screenshots/`:
  `demo-requirement.jpg` (`?item=BR-001`, showing a cited requirement) and
  `demo-open-question.jpg` (`?item=Q-001`, showing the cancellation question with its
  source highlight). **Both dark theme, not a light/dark pair** — the plan named that
  as an acceptable fallback ("ship dark only and drop the swap") if the pair added
  cost without matching value, and it did: this environment's screen-capture pipeline
  renders dark regardless of the page's actual theme (confirmed via
  `getComputedStyle`/`data-theme` — the DOM was genuinely `light`, background
  genuinely `rgb(255,255,255)` — the capture itself is the artifact, an OS/browser
  display-filter quirk unrelated to the app's code). Chasing a correct light-mode
  capture further wasn't worth it for a feature the plan already said could be
  dropped.
- **Two new icon names** added to `app/_components/icon.tsx`'s map: `paste`
  (`ClipboardList`), `analyze` (`Sparkles`), `review` (`UserCheck`), `quote` (`Quote`)
  — for the three-step section and the evidence claim card. Same one mapping module,
  no new import site anywhere else.
- **Verified:** `npm run build`/`lint`/`typecheck`/`test` all clean (745/745) · `/`
  compiles `○` static, `/demo` now `ƒ` dynamic (expected, see above). Browser-checked:
  hero, screenshots, three-step section and all four claim cards render correctly ·
  clicking a claim card lands on `/demo?item=…` with the right item selected and its
  evidence highlighted (confirmed for `Q-001`) · EN⇄TH toggle swaps the entire page,
  including every section below the fold, with no console errors · mobile width
  (390px, same-origin-iframe technique) has zero horizontal overflow, single-column
  stacking reads correctly in both languages.

### Phase 4 — shipped 2026-08-04: remove the friction

**The path from nothing to analysed requirements is now one screen and one click.** It
was 3 typed values and zero decisions spread across 3 full-page forms, 3 redirects and
12 visible controls. Plan for this phase:
`C:\Users\User\.claude\plans\reqwiseai-resume-phase-robust-flurry.md`.

Two owner decisions were taken before any code was written, and both narrow what the
master plan's Phase 4 text said:

1. **Provider selection stays on `/analyze`.** The master plan said it "disappears from
   the UI entirely" and moves to Settings — but Settings is Phase 5 work, so removing it
   now would make Gemini unreachable except by editing `env` for a whole phase.
   `provider-controls.tsx` and `tests/providers/selection.test.ts` are untouched.
2. **The combined screen requires pasted text.** "Create an empty project, add a source
   later" is gone as a path. Adding a *second* source to an existing project still works
   through `/sources/new`, unchanged.

- **`/workspace/projects/new` rewritten in place** (`start-form.tsx`;
  `project-form.tsx` deleted, not left as dead code). Reusing the route meant zero link
  edits anywhere. Above the fold: project name and a large paste area — the only two
  things genuinely required. Everything that used to be spread across three screens and
  was *already pre-answered* — domain, output language, source title/type/date/
  stakeholder/notes, project description/objective/stakeholders — sits in **one**
  collapsed `<details>`, reusing the exact pattern the old form already had (stays
  mounted so a typed value survives an accidental collapse; opens itself when the server
  returned an error against anything inside).
- **`startProjectAction`** (`app/workspace/projects/actions.ts`) runs
  `createProject` → `createSource` → `buildAnalysisInput` → `runAnalysis` →
  `persistAnalysisResult` → redirect to the run. Not one new schema, service or query
  was written for it: it composes the same three existing paths, on the same
  user-scoped client, so the combined screen cannot accept anything the three separate
  screens would have refused.
- **The one rule this action adds: once the project row exists, never return to the
  form.** A returned error invites a resubmit and a resubmit creates a *second* project.
  Every failure past that point redirects to the furthest thing that does exist, with an
  `?error=` the destination explains in words — `?error=source` on the project page,
  `?error=analysis` on the source page (which already carries the "Analyze requirements"
  link to retry), following the `?error=archive` convention `archiveProjectAction`
  already used. An `invalid`/`provider_error` run is **not** one of these paths: it is
  persisted with a run id and shown honestly, which is existing designed behaviour.
- **`deriveSourceTitle()`** (`lib/contracts/source.ts`) — first non-blank line, internal
  whitespace collapsed, sliced to `SOURCE_TITLE_MAX` so a derived title can never be the
  thing that fails validation. `sourceContentSchema.title` stays `min(1)`; derivation
  happens *before* parsing. **It reads `rawText` and returns a separate string — it
  never replaces it**, which is the whole point, and there is a test asserting exactly
  that. The same pure function drives the field's live placeholder in the browser.
- **`lib/contracts/start.ts`** — `readStartForm()` composes the two existing readers and
  schemas and reports both halves' field errors at once (fixing one field only to be
  shown the next is the friction this screen exists to remove). Extracted so the logic is
  testable rather than buried in a `"use server"` file. The two field sets are disjoint,
  and a test now enforces that they cannot bleed into each other.
- **`startExampleAction`** — the zero-typing path, on the projects-list empty state and
  the intake screen. Creates a project named `ตัวอย่าง: …` with a description saying it
  was generated and can be deleted (**the marking, with no migration** — `projects` has
  no column for this and one would not be worth a schema change), attaches the booking
  fixture, and **forces `createProvider("mock", …)` rather than
  `availableDefaultProvider()`** — the master plan's explicit trap: a repeatable button
  on a metered model is an unmetered spend endpoint.
- **`/analyze` kept, reframed.** No file deleted. Its copy now reads as what it actually
  is — a re-run of an existing source — and it is the one place the provider choice
  still lives.
- **Verified:**
  - `npm run lint` clean (the one pre-existing `legacy-verifier.ts` warning) ·
    `typecheck` clean · `npm test` **762/762** (was 745; +17, none removed) ·
    `npm run build` clean, **no new route** — `/workspace/projects/new` was reused.
  - New tests: 8 on `deriveSourceTitle` (first line, leading blank lines, CRLF, Thai,
    whitespace-collapse, length ceiling, fallback, and that the raw text it was handed is
    byte-for-byte unchanged) and 9 on `readStartForm` (both halves valid, derivation,
    typed title wins, both halves' errors at once, blames the text not the title,
    server-owned fields ignored, project/source fields do not bleed).
  - `verify:projects` 10/10 · `verify:sources` 18/18. `verify:analysis` **failed for a
    pre-existing reason unrelated to this work** — see the next section.
  - **In the browser** (`localhost:3000`, signed in as `slice3.demo@reqwise.dev`):
    - **Example flow: 7.1s** click → rendered analysis (target <10s), *including* dev-mode
      first compile of the route. Run header reads `Deterministic Mock`, confirming the
      forced provider. 12 requirements, 5 open questions, 1 risk, 1 quality finding.
    - **Real flow: 8.9s** (target <60s) — a fresh Thai source pasted, name typed, source
      title left blank, submit, landing on the finished analysis without ever seeing
      `/analyze`.
    - The derived title updated **live** in both the placeholder and the hint as text was
      pasted, and the run used it.
    - **Raw text stored byte-identically**: all 5 newlines the browser submitted as CRLF
      came back as CRLF, nothing trimmed or normalised — checked by string equality
      against the submitted value, not by eye.
    - Every produced item `Draft`; no `Approved`/`Implemented` anywhere.
    - Zero console errors and zero hydration warnings (the one `scroll-behavior: smooth`
      advisory is pre-existing and unrelated).
    - 390px via the same-origin-iframe technique: `scrollWidth === clientWidth`, no
      horizontal overflow.
    - `/analyze` still reachable and still renders both provider options.
  - **Residue left behind, by design:** two real projects in the linked database from
    this verification — `Phase 4 friction check` and `ตัวอย่าง: ระบบจองพื้นที่ Smart Space`.
    They are owned by the protected demo account, so `verify-db-cleanup.sql` will treat
    them as `preserved`, not `would_delete`. Delete or archive them by hand if unwanted.

### ⚠️ `verify:analysis` manifest drift — pre-existing, NOT from Phase 4

`npm run verify:analysis` fails with
`Safe fingerprint mismatch or downstream drift for legacy row 08edaef7-…`.

**This is not caused by Phase 4 and was deliberately not "fixed" in passing.** Evidence:

- The script reads `scripts/verify-analysis.mts`, `lib/analysis/legacy-verifier.ts`,
  `scripts/forensics/legacy-analysis-runs-readonly.sql` and
  `scripts/analysis-verification/legacy-analysis-runs.json`. **None of the four appears
  in Phase 4's diff.**
- Reading the forensics SQL directly (read-only) shows exactly **one** drifting number:
  `projectDependencies.runs` is **11**, the manifest expects **7**. Every other field
  matches byte for byte — `items: 99`, `sourceReferences: 71`, `relations: 40`,
  `versions: 4`, `reviews: 15`, `sources: 4`, and the whole `downstreamCounts` block.
- `projectDependencies` counts activity in the *project that owns* the legacy row
  (`Smart Space intake — slice 3`), not the row itself. Four analysis runs were added to
  that project after the manifest was last refreshed on 2026-08-02 — this file already
  records live Gemini runs on 2026-08-02 and prompt-tuning verification on 2026-08-03.

**The decision is the owner's, not a mechanical fix.** The manifest is a deliberate
fail-closed structural gate; refreshing `runs: 7 → 11` would make it pass, but that is
choosing to trust that those four runs are the expected ones, and the whole point of the
gate is that nobody edits it casually. Note also that this number will drift again on
every future analysis run in that project — worth considering whether
`projectDependencies.runs` belongs in a fingerprint at all, or whether that project
should stop being used for ad-hoc runs.

### Phase 7 — shipped 2026-08-05: Visual polish and i18n completion

**Goal, per the plan:** close out the two things that span every file — finish the
icon rollout and the i18n sweep — plus motion, a spacing scale, empty states and the
accessibility gaps the audit named. Five slices, five commits (`2dbf929`, `5df86c3`,
`653a7be`, `d3d2743`, `d0446b9`).

1. **Icons** — every remaining unicode glyph used *as an icon* now renders through
   `app/_components/icon.tsx`'s single `<Icon name="…">` mapping, which stayed the only
   file importing `lucide-react` directly. Covered: the sidebar's collapse (`»`/`«`) and
   mobile-menu (`☰`/`✕`) controls plus its five nav icons (previously raw glyph
   characters, now the same `Icon` names the mapping already exposed for `dashboard`/
   `projects`/`requirements`/`reviews`/`settings`); the theme toggle (`☀`/`☾`); the
   inspector's close button and its evidence "◆ Verified"/"◇ Unverified" marks;
   requirement-row's cited/related/change-pending/follow-up marks; `badges.tsx`'s
   domain and lock badges; `item-chips.tsx`'s cited and project chips; the toolbar's
   disabled search button; the source and requirements panels' search glyph, citation
   prev/next buttons (now real up/down chevrons, not `↑`/`↓` text) and group expand/
   collapse chevrons; the traceability map's citation mark; `coverage-row.tsx`'s
   attention dot (switched to the same small `rounded-full` div `StatusBadge` already
   uses for its dot — not a unicode glyph, so it didn't need an `Icon` at all);
   `confirm-form.tsx`'s confirmation bullets; and all **15** "← Back"/"← {name}" links
   plus the **2** "↗ external" marks scattered across the export/source/project detail
   screens (new `arrow-left` and reused `external` names in the icon map; new
   `chevron-up`/`chevron-down` for the citation nav buttons).
   **Left alone, correctly:** the toolbar's `⌘K` kbd hint (a textual keyboard-shortcut
   convention, not a UI icon) and every remaining non-ASCII character in the codebase,
   which is inside a JSDoc comment — verified by grepping the rendered glyph ranges
   after the slice, not just by eye.
2. **Accessibility** — the three gaps the audit named:
   - **Skip link + `#main-content`**, neither of which existed. New
     `app/_components/skip-link.tsx`, wired into the two shells that put nav chrome
     ahead of content: `app/workspace/layout.tsx` (before the sidebar) and
     `app/_components/site-header.tsx` (shared by `/` and `/demo`). Every page under
     `app/workspace/` already renders its own `<main>`, so the layout's own wrapper
     stayed a plain `<div id="main-content">` rather than nesting a second `<main>`
     landmark inside it — `app/page.tsx`'s pre-existing `<main id="main">` and
     `app/demo/layout.tsx`'s content wrapper (promoted to a real `<main
     id="main-content">`, since nothing else in `/demo` declares one) both carry the
     id the shared skip link targets.
   - **The `lg`-breakpoint inspector drawer** gets `role="dialog"`, `aria-modal="true"`
     and an Escape handler — but *only* in the 1024–1279px band where it actually
     renders as the absolutely-positioned overlay (§9's shadow exception). Below `lg`
     it's one pane of the segmented control (normal flow); at `xl` it's a static grid
     column. Neither of those is a dialog, so the ARIA attributes are conditioned on a
     `matchMedia` query read through `useSyncExternalStore` — the same technique
     `useLocale()` uses — rather than `useEffect`+`setState`, which trips
     `react-hooks/set-state-in-effect` (hit and fixed during this slice). Opening the
     drawer moves focus to its close button and remembers what was focused before;
     Escape closes it and restores that focus instead of dropping it to `<body>`.
   - **Tab-pattern decision**, recorded inline at `workspace.tsx`'s `Segment`
     component: kept `aria-pressed`, did **not** adopt `role="tablist"` for the
     Source/Requirements/Inspector switcher, even though it was the plan's strongest
     candidate. A tablist's roving-tabindex/arrow-key contract would only be true
     below `lg` — at `lg` and up the same three views become simultaneously-visible
     panels, so "the one active tab" stops being an honest description exactly where
     the control still renders, and making the ARIA role itself track a breakpoint
     (as the inspector drawer's `role`/`aria-modal` now legitimately does) would buy a
     second such listener for a control that already meets INTERFACE.md §12/§15
     without it. Matches the codebase's pre-existing position on the projects-list
     filter control ("Segmented control rather than tabs — a filter is a view of one
     list"). The other `aria-pressed` groups audited (summary-bar's Inspector toggle,
     scope-panel's presets, traceability's view/tab switches, coverage/matrix
     selection, and the inspector's own Details/Evidence/… strip, which uses
     `aria-current`) are single-toggle or filter controls, not tab-panel ownership,
     and were left as they are.
3. **Spacing scale** — `app/globals.css`'s `--space-shell-*` tokens, the same plain
   `:root` custom-property convention `--radius-card`/`--radius-panel` already use
   (not a Tailwind `@theme` scale). The audit found "no spacing scale token — density
   varies by page": ~19 page wrappers already shared the identical shape (`px-4 py-6
   sm:px-8 sm:py-8`), but the `gap-*` between header/subnav/content ranged from 3 to 8
   with nothing to check it against. Two named tiers matching shapes the app already
   had (not invented): the wide list/dashboard shell (14 pages, gap unified to the
   1.5rem the majority already used) and the narrower single-column detail shell (5
   pages: the analysis-run redirect, export scope, both analyze-source screens,
   traceability — `--space-shell-y-tight` does not step up at `sm`, and each keeps its
   own content-driven inner `gap-*`). **Deliberately not migrated:** anything *inside*
   a page (header rows, `dl` grids, card padding), the not-found/error full-page
   pattern's `px-6 py-16`, sign-in/up's `p-6`, and the printable export document's own
   `px-6 py-8`/`py-10` — either already internally consistent for their own page type
   or a deliberately different shape (a centered error state, a printable document);
   folding them in would have been the "excuse to touch every px value" the plan's
   scope note warned against.
4. **Empty states** — the Phase 1 `EmptyState` primitive (`app/_components/ui/
   empty-state.tsx`) had existed since Phase 1 with zero consumers until this slice.
   Migrated: `sources/page.tsx`'s dashed "Nothing to analyse yet" panel; `projects/
   page.tsx`'s local `EmptyState()` (split into its two branches — archived-filter and
   no-projects-at-all — both now the shared primitive; the old "notes → requirements →
   review" mono line and centered layout were dropped for the primitive's own
   left-aligned shape, a deliberate simplification); `exports/page.tsx` and
   `traceability/page.tsx`'s near-identical "no analysed requirements yet" blocks; and
   `requirements-view.tsx`'s single empty `<p>`, which was collapsing two different
   states into one string — split into "no requirements exist anywhere yet" and
   "filters matched nothing," each with its own title, body and next action. Every
   migrated instance now leads with the next action (Add the first source / Create
   your first project / Go to source documents / Clear filters / Start a project), not
   a restated absence. **Left alone:** `workflow-actions.tsx`'s disabled-button
   caption ("No approved or rejected requirement exists yet…") — a compact inline hint
   next to a button inside the inspector, not a page-level empty state; the dashed-box
   primitive doesn't fit that context.
5. **i18n sweep** — a bounded pass, not the full-application sweep the plan's text
   gestures at. `toolbar.tsx`'s `contextLabel()` (five hardcoded English route labels)
   now `pick()`s an EN/TH pair per route; the account-menu "Sign out" button and the
   new skip link's own text now use `<T>`. **Honestly: 14 of 83 `.tsx` files under
   `app/` use `<T>`/`useLocale()` after this slice (was 8 of 82 before Phase 1's own
   count).** A complete sweep — every inspector tab, badge, chip, filter label,
   dashboard tile, empty-state string this phase just wrote in English, etc. — is a
   materially larger effort than one slice among five in one phase, and CLAUDE.md's
   own rule (`<T>` is chrome-only, never requirement content) means most of what's
   left genuinely is in scope for a future i18n phase, not a "this doesn't count"
   exclusion. This slice targeted the highest-traffic shared surfaces that render on
   every screen (breadcrumb, account menu, skip link) — the same "smoke-tested, not a
   translation pass" scoping Phase 1 recorded for its own first slice.

**Motion** was audited, not changed: every `duration-*` class in the app is 150 or
200ms (`grep -rnoE "duration-[0-9]+" app` — one `duration-200` on the workspace grid,
everything else `duration-150`), inside the plan's 120–220ms budget; no
`animate-*`/`@keyframes` decoration exists anywhere. `prefers-reduced-motion` was
already neutralised globally in Phase 1. Nothing to fix, so nothing was touched.

`INTERFACE.md`'s Implementation notes table gained four new rows (Icons, Spacing
scale, Tab-pattern decision, Accessibility), all under "(Phase 7)".

- **Verified:**
  - `npm run build`/`lint`/`typecheck`/`test` clean after **every** slice — `test`
    stayed **800/800** throughout (this phase changed markup, tokens and a handful of
    client-side hooks, not analysis logic). One real lint error was hit and fixed
    mid-slice: the inspector drawer's first `matchMedia` implementation used
    `useEffect`+`setState`, which `react-hooks/set-state-in-effect` correctly flagged;
    rewritten with `useSyncExternalStore` before the slice's commit.
  - **Icon grep sweep:** `grep -rnoP "[\x{2190}-\x{2BFF}\x{25A0}-\x{25FF}\x{2600}-\x{27BF}]" app --include=*.tsx` after the icons
    slice returns only JSDoc-comment characters and the toolbar's `⌘` — zero remaining
    glyph-as-icon usages in rendered JSX.
  - **i18n grep:** `grep -rl "<T \|useLocale" app --include=*.tsx | wc -l` → **14** (of
    83 `.tsx` files), up from 8 before this phase. The exact remaining-English count
    depends on how narrowly "chrome, not content" is drawn per file; a follow-up i18n
    phase should start by running the full `grep -rniE` sweep this phase's own
    instructions specified and triaging file by file, since a blanket regex over this
    codebase's comments/type labels/test fixtures produces too much noise to report a
    single meaningful number here.
  - **What this session could not do:** a real keyboard-only browser walkthrough and
    light/dark × EN/TH screenshot pass via `claude-in-chrome`, and the sandbox's
    `resize_window` limitation recorded in Phase 6 was not re-tested — Phase 7 does not
    require breakpoint verification the way Phase 6 did, and no breakpoint-affecting
    change was made here (the spacing-token slice is numerically identical output on
    14 of the pages it touched, and the inspector drawer's `matchMedia` query mirrors
    the same `lg`/`xl` breakpoints already proven correct in Phase 6 from the compiled
    stylesheet). Verification for this phase was `build`/`lint`/`typecheck`/`test` plus
    direct reading of the compiled markup and the grep sweeps above, not a live
    browser session — flagged here rather than fabricated.

### Phase 6 — shipped 2026-08-05: Mobile

**Goal, per the plan:** the whole app usable on a phone, not just the demo — the analysis
workspace already degraded correctly (`<lg` segmented control, panes hidden not
unmounted), so this phase was everything *else*: the projects list, the combined create
screen, the new dashboard and global views, traceability's wide `<table>`, exports, and
every touch target below 44px.

A prior session had already started this exact phase and left the sidebar/toolbar/toggle
rework uncommitted in the working tree — verified clean and committed first, as slice 1,
rather than redone. Six slices followed it, each its own commit:

1. **Sidebar becomes a stacked mobile nav** (the prior session's work, committed as-is):
   below `md` (768px) the sidebar is a Menu button (`id="workspace-nav-items"`) opening a
   stacked list, replacing a horizontal-scroll strip that showed three of five entries at
   390px and hid the rest behind a scrollbar nobody would find. Theme/lang toggles moved
   into the mobile menu's footer at full size — `compact` was built for the *collapsed
   desktop column*, not a horizontal strip, and rendering it in one produced four
   sub-44px targets stacked two-over-two. This slice also established the pattern every
   later slice repeats: **`min-h-11 lg:min-h-9`** (or `size-11 lg:size-9`) on every
   interactive control — 44px until `lg` (1024px), not `md`, because a 768px tablet is
   touch-operated exactly like a phone; density waits for the width a mouse is likely.
2. **Projects list + create screen** — the "New project" link and filter segmented
   control were `min-h-9`/`sm:` with no mobile-width variant at all; switched to the
   pattern. `start-form.tsx` was already compliant end to end and needed nothing.
3. **Project sub-nav + source screens** — `project-nav.tsx`'s tabs (already scrolling in
   their own `overflow-x-auto` container) went from `min-h-9` to the pattern. Every
   project-scoped "← back" link across overview/sources list/source detail/source
   create/source edit was a bare text anchor with no tap area at all — all eight fixed.
   The two `error.tsx` "Try again" retry buttons (projects, sources) got the same fix.
4. **Traceability** — only the page-level "back to project" link needed fixing.
   Everything else audited clean: the matrix `<table>` already scrolls horizontally
   inside its own `overflow-auto` box with an accessible list fallback below it, every
   cell/button/toolbar control was already `min-h-11` (constant, not dense-until-`lg` —
   over-compliant, left alone rather than "fixed" into a narrower desktop density that
   wasn't asked for), and the map view's SVG nodes are 64px tall.
5. **Exports** — fixed the back/navigation links on the scope screen, the full-width
   preview, and the printable route's `screen-only` toolbar (never inside the printed
   output). `scope-panel.tsx` and `download-actions.tsx` were already compliant;
   `document.tsx`'s tables were already wrapped in their own `overflow-x-auto`. No
   sidebar/toolbar chrome logic was added near these routes — exports stayed documents,
   not app views, per the plan.
6. **Inside the analysis workspace** — the `<lg` segmented control itself (Source /
   Requirements / Inspector) was audited and confirmed still correct: panes hidden via
   CSS not unmounted, segment buttons already `min-h-11`. What still needed the pass,
   because it renders inside a pane visible below `lg`: the inspector's close button and
   related-item chips, the source panel's search input and citation prev/next buttons,
   all five change-request approve/reject/withdraw/confirm/cancel buttons, and the
   discard/keep-editing pair in the unsaved-edit warning banner. Left deliberately alone:
   the summary bar's "Inspector" toggle (`hidden` below `lg` entirely, so a mouse-only
   density there is correct) and the group-header strip, whose `min-h-10` carries its own
   comment citing the WCAG full-width-target exception.

**`INTERFACE.md` §13 row added** to the Implementation notes table, same format as every
other §-row.

- **Verified:**
  - `npm run build`/`lint`/`typecheck`/`test` clean after **every** slice, not just at
    the end — `lint` has the one pre-existing `legacy-verifier.ts` warning throughout,
    `test` stayed **800/800** the whole way (this phase changed only `className` strings
    and touch-target wiring, no logic).
  - **Breakpoint correctness was proven from the compiled stylesheet actually served to
    the browser, not just by reading the source.** The sandbox's `resize_window` tool
    turned out to be non-functional here: `window.innerWidth`/`outerWidth`/
    `screen.availWidth` stayed pinned at 1920×1080 across a fresh tab, a fresh window, an
    OS-level unmaximize shortcut (`win+Down`), and a `Ctrl+Shift+M` devtools-emulation
    attempt — none of it moved the number. Rather than fabricate a 390px screenshot that
    wasn't real, the actual Tailwind output was fetched
    (`/_next/static/chunks/[root-of-the-server]*.css`) and inspected directly:
    `.min-h-11 { min-height: calc(var(--spacing) * 11) }` (44px) is **unconditional** —
    no enclosing `@media` — while `.lg\:min-h-9 { min-height: calc(var(--spacing) * 9) }`
    (36px) sits inside `@media (min-width: 64rem)` (1024px), and `.md\:hidden` sits
    inside `@media (min-width: 48rem)` (768px). That is the CSS the browser evaluates
    against real viewport width regardless of what `resize_window` did — it settles the
    question mobile-first-cascade would already predict, from the actual artifact rather
    than an assumption about it.
  - **What genuine real-device-mode verification could not confirm this session, and
    should be the first thing re-checked once `resize_window` (or a working alternative)
    is available:** live touch/UA/DPR-accurate rendering at 390/414/768/1024px, and
    `getBoundingClientRect()` measurements of the fixed controls at those widths. This is
    the same caveat prior sessions recorded about the iframe technique, now true of
    `resize_window` too in this particular sandbox — it is an environment limitation, not
    a decision to skip the check.
  - **What was verified live in the browser** (`localhost:3000`, signed in as
    `slice3.demo@reqwise.dev`, at the sandbox's fixed 1920×1080): zero console errors on
    Dashboard, Projects, a project's Traceability and Export screens; dark theme toggled
    via the real UI control (not a `localStorage` hack) and checked visually on the
    Export and Traceability screens — hairline borders, no shadow on a resting panel,
    correct token swap, no layout break; `document.documentElement.scrollWidth ===
    clientWidth` on the traceability matrix page (no horizontal page-body overflow even
    with the 900px-wide table present, confirming its `overflow-auto` container is doing
    the job at the width tested).
  - **`Preview2.png`** at the repo root is untracked debug residue from a prior session,
    unrelated to this phase — left alone, as instructed.

### Phase 5 — shipped 2026-08-05: Navigation and Dashboard

**Every sidebar entry works.** It was nine entries of which seven did nothing. It is now
five, all real: **Dashboard · Projects · Requirements · Reviews · Settings**.

Three owner-level decisions were taken during the build; each narrows or redirects what
the master plan's Phase 5 text said, and each is recorded in the code it affects:

1. **Settings discloses the provider; it does not choose one.** The plan said Settings
   "holds the provider choice removed in Phase 4" — but Phase 4 deliberately never
   removed it, and storing a preference needs a table this schema does not have. Adding
   a migration to a live database to persist a dropdown is a schema change bought for a
   convenience. So Settings reports what the server is configured with
   (`AI_PROVIDER`, plus whether a Gemini key and model chain exist) and the per-run
   choice stays on `/analyze`. The trap "hide the *choice*, keep the *disclosure*" is
   honoured from the other direction: the disclosure is now a page of its own, and the
   run header still names the provider that actually ran.
2. **The project sub-nav is rendered by pages, not by a `layout.tsx`.** The plan said
   "in the project layout". A layout under `[projectId]` would also wrap the full-height
   three-panel analysis workspace and the export print/preview routes — one is an
   application view, the other is a document. Four pages opt in with one line each
   (Overview, Sources, Traceability, Export) and neither of those two can be broken by
   it. **Verified in the browser: the analysis workspace has no sub-nav above it.**
3. **`app/.../analyses/[runId]/_components/labels.ts` was promoted** to
   `app/workspace/_components/item-labels.ts` and its 11 importers rewritten to
   `@/app/workspace/_components/item-labels`. Not a drive-by refactor: the traceability
   tree already reached across route trees to import it, and three new workspace-scope
   views were about to be a fourth consumer. Promoted rather than copied — a second
   definition of "Functional requirement" is exactly the drift the table prevents.

- **`lib/workspace/` — the new layer, four files, no new table or policy:**
  - `types.ts` — `WorkspaceItemRow` etc., deliberately **lighter** than
    `AnalysisItemView`: no excerpts, no relations, no change requests per row. A
    cross-project list says *which* item and *where it lives*; the run says the rest.
    `hasSourceEvidence` is a boolean, like `lib/traceability/types.ts`.
  - `queries.ts` — `listWorkspaceItems` / `listPendingChangeRequests` /
    `listRecentActivity` / `getWorkspaceTotals`. **New query shape, same authorization
    story:** user-scoped client, RLS is the filter, nothing checks ownership itself.
    Two facts read out of the migrations rather than assumed: only `analysis_items` has
    a direct FK to `projects` (`change_requests` and `review_activities` carry a
    `project_id` only as half of a composite key into `analysis_items`), so those two
    reach the project *through* the item; and `change_requests` has **two** FKs into
    `analysis_items`, so a PostgREST embed would need a constraint-name hint that rots
    on rename — a second explicit RLS-scoped query is used instead.
  - `outstanding.ts` — the four predicates, pure and tested. **Archived projects are
    excluded from every bucket**: an archived project is read-only, so listing its
    drafts would be listing work nobody may do.
  - `filters.ts` / `nav.ts` — client-side narrowing, and the active-state rule.
- **The dashboard invents nothing.** Every figure is a real `count` or the length of a
  real list. No quality score, no coverage percentage, no trend — none exists in the
  schema (`ARCHITECTURE.md` §A.4, rewritten this commit to say so explicitly). The four
  "outstanding work" tiles and the four Reviews sections read the **same** predicates,
  so a count and the list it links to cannot drift apart.
- **The activity feed never names a person.** `profiles` is RLS-scoped so one member
  cannot read another's row; widening that policy to decorate a caption would trade a
  real privacy boundary for a nicety (the plan recorded this as a trap). `actor_id` is
  still in the audit trail — this is a display decision, not a gap in the record.
- **Active-state bug fixed** (`lib/workspace/nav.ts` → `isActiveNav`). The old rule,
  `pathname.startsWith(item.href)`, lit **Projects** up on every page below
  `/workspace/projects` — every analysis workspace, source and export screen — while the
  entry the reader was under looked inactive. Exact match is the default now; an entry
  that owns a subtree declares `ownsSubtree`, and the prefix test appends `/` so
  `/workspace/projects` cannot claim `/workspace/projects-archive`. `/workspace` is a
  Dashboard **alias** (exact), never a prefix — as a prefix it would own the whole app.
- **Cut, not deferred:** *Workspace* (a redirect wearing a menu entry — `/workspace` now
  redirects to `/workspace/dashboard`, which is also the post-sign-in destination),
  *Analysis Runs* (a run is reached through its project and source; Requirements answers
  the cross-project question it stood in for) and global *Traceability* (per-project by
  design). *Domain Profiles* was absorbed into Settings.
- **`?project=` on `/workspace/requirements`** — where the project sub-nav's
  Requirements tab lands, pre-filtered. A **starting** value, not a bound one, and it
  turns `includeArchived` on so an archived project's own tab is not silently empty.
- **`WORKSPACE_ITEM_LIMIT = 500`, with a visible notice when hit.** A ceiling rather
  than pagination, because filtering is client-side: a filter that silently searched only
  page one would report an honest-looking zero. The page says it stopped counting.
- **Verified:**
  - `npm run lint` clean (the one pre-existing `legacy-verifier.ts` warning) ·
    `typecheck` clean · `npm test` **800/800** (was 762; +38, none removed) ·
    `npm run build` clean, **4 new routes**, all `ƒ`.
  - New tests: 22 on `outstanding.ts` (each predicate, archived exclusion on all four
    buckets, `needs_clarification` still counts, `acknowledged` findings still count, a
    deferred question does not, anchors distinct), 9 on `filters.ts`, 7 on `nav.ts`
    (including the exact regression the old `startsWith` produced).
  - **In the browser** (`localhost:3000`, signed in as `slice3.demo@reqwise.dev`):
    - Dashboard renders real data — **94 awaiting review · 27 unanswered questions ·
      7 open findings · 0 pending change requests = 128**, and the Reviews page's four
      section counts match exactly.
    - **Independent count cross-check, two different query paths:** Requirements reads
      "134 of 151 shown" — 151 is `getWorkspaceTotals`' head count of `analysis_items`;
      134 is the non-archived subset, and the projects list's *embedded* per-project
      counts are 17 + 18 + 99 = **134**, with the archived slice-6B project holding the
      remaining 17. The two paths agree without either being derived from the other.
    - Sub-nav renders on Overview/Sources/Traceability/Export with the right tab lit,
      and **not** above the analysis workspace.
    - Clicking a Requirements row lands on the analysis workspace with the item selected
      and its source excerpt highlighted (`FR-006`, confirmed live).
    - `#pending-change-requests` anchor navigation from the dashboard tile lands on the
      right section, past the sticky toolbar.
    - Sidebar active state correct on every page walked: Projects stays lit inside a
      run, Requirements lights up when `?project=` leaves the project subtree.
    - **Zero console errors and zero hydration warnings** (only the pre-existing
      `scroll-behavior: smooth` advisory and dev-mode HMR/DevTools notices).
    - 390px via the same-origin-iframe technique: `scrollWidth === clientWidth` on
      `/workspace/dashboard`, `/requirements`, `/reviews`, `/settings` and a project
      overview — no horizontal overflow on any of the five.

### ✅ RLS re-proof for the workspace-wide queries — done, 12/12

The plan's risk note for this phase read *"cross-project queries are new query shapes.
RLS must be re-proven, not assumed."* It has been. **`npm run verify:workspace`**
(`scripts/verify-workspace.mts`) — 12/12 against the live project.

Every per-project query in this app is scoped by an id in the URL *as well as* by
policy; these four are scoped by policy alone, which is exactly why they needed their
own script. It builds a full fixture for user **A** (an active project, an archived one,
items in every state the four buckets care about, a pending change request, ten review
activities), then runs the **real, shipped** functions from `lib/workspace/queries.ts`
twice — once on A's client and once on **B**'s.

- **A's side:** the four bucket counts are exactly 2 / 1 / 2 / 1; the soft-deleted item
  appears in no list and in no count; the archived project's draft is *visible* in the
  item list but counted as work by nothing; `listPendingChangeRequests` resolves its
  target's display id and project through RLS; the activity feed carries no actor field
  at all; `getWorkspaceTotals` reports 1 active / 1 archived / 2 sources / 2 runs / 11
  items.
- **B's side — the check the script exists for:** `listWorkspaceItems`,
  `listPendingChangeRequests`, `listRecentActivity` and `getWorkspaceTotals` all return
  **zero** of A's rows, while B still sees their own — so "sees nothing" cannot pass
  trivially.

**Two things the first run caught, both worth keeping:**

1. The fixture could not be inserted with a non-`draft` status — *the database refused
   the service role*. "AI-generated requirements always start as Draft" is a rule, not a
   convention. The script now reaches every state through `review_item`,
   `resolve_open_question` and `update_quality_finding`, which is both more honest and
   the reason the activity feed has real rows to be tested against.
2. `UPDATE projects SET status='archived'` was a **silent no-op** — archiving is a
   lifecycle transition with its own audit and goes through `archive_project`. The first
   run therefore reported the archived project as active and three checks failed
   *correctly*: the archived-exclusion logic was right and the fixture was wrong. The
   script now calls the RPC, checks its error, **and** re-reads the row.

**Cleanup patterns registered** in both `scripts/verify-db-cleanup.sql` and its dry-run:
`reqwise-ws-%@example.com` plus `Workspace verification %`, `Archived workspace
project %`, `Outsider workspace project %` — literal prefixes read from the script's own
`emailA`/`emailB` and its three `newProject()` call sites. Dry-run re-run afterwards and
they classify as `would_delete`, not `preserved`.

### ⚠️ The cleanup dry-run's `unknown` bucket is no longer empty

This file recorded on 2026-08-02 that the bucket was **0 accounts, 0 projects** — every
row accounted for. Today's dry-run reports:

| Section | Rows |
|---|---|
| `unknown` / `auth.users` | 1 — `tanawittam@gmail.com` |
| `unknown` / `projects` | 1 — `Smart Booking Web` |

**Nothing is at risk.** Both already appear under `preserved`, so neither is in
`would_delete`; `unknown` means only "not a recognised fixture pattern *and* not one of
the two named demo accounts". This is the bucket doing its job: a real account signed up
and created a real project since the manifest was last reviewed.

**Not fixed in passing, on purpose.** The cleanup file's own comment says not to make the
bucket empty by widening a pattern before finding out what the row is — and the right fix
here is the opposite of widening: `tanawittam@gmail.com` is the owner's own account, so
if it is meant to be permanent it should join `slice1-demo@example.com` and
`slice3.demo@reqwise.dev` in the **protected** list that the destructive file's pre-flight
`DO` block checks by name. That is an owner decision about their own account, not a
mechanical edit.

### Up next: Phase 6 — Mobile

The whole app usable on a phone, not just the demo. The analysis workspace already
degrades correctly (`<lg` segmented control, panes hidden not unmounted so edits survive
switching) — audit and keep it. Everything else needs the pass: the projects list, the
combined create screen, the four new Phase 5 views, traceability (a wide `<table>`),
exports. **Verify on real device emulation, not the iframe technique** — the iframe
proves CSS breakpoints fire but not touch, UA or DPR (a caveat this file has recorded
before, and one that applies to Phase 5's own 390px checks above). Check 390px, 414px,
768px, 1024px.

### Why

The engine works; everything around it does not communicate that. Three findings from a
code audit this date, each verified:

1. **7 of 9 sidebar items are dead.** `app/workspace/_components/sidebar.tsx:35-49` marks
   them `ready: false` and renders a `<span aria-disabled="true" title="Coming in a later
   slice">` — the `href` is never attached, and those route directories do not exist. Only
   *Workspace* (a redirect) and *Projects* work.
2. **The forms feel heavy but demand almost nothing.** The true minimum path is 3 typed
   values and **zero** decisions, spread across 3 full-page forms, 3 redirects and 12
   visible controls. `/analyze` is a whole screen whose only control is pre-checked.
3. **No way in for anyone without an account.** Zero demo/sample/prefill affordances exist
   (`grep` for sample|demo|example|try across `app/` returns one code comment). Sign-up
   with email confirmation returns no session, so a recruiter must leave, open email, and
   come back.

**Goal:** a BA can do real work in it, and a recruiter understands within a minute —
without signing up — that it works and is easy to use.

### Phases

| # | Phase | Core deliverable |
|---|---|---|
| 1 | Foundation kit | i18n primitives (`<T>`, `useLocale`, `LangToggle`, CSS swap) ported from `../Portfolio/site` · `lucide-react` behind one `icon.tsx` mapping · UI primitives extracted from existing local copies |
| 2 | **Public demo** (top priority) | `/demo` — the real three-panel workspace, no login, rendered from a **live `runAnalysis()` call, zero database access** · guided annotation layer · TH/EN |
| 3 | Landing page | Rewrite `app/page.tsx` into a real introduction with screenshots captured from `/demo` |
| 4 | Remove friction | Merge create-project + paste-text into one screen · derive the source title · delete `/analyze` as a required step · one-click "try an example" |
| 5 | Navigation + Dashboard | ✅ shipped 2026-08-05 — five real menu items (Dashboard · Projects · Requirements · Reviews · Settings) · `startsWith` active-state bug fixed · project sub-nav · Dashboard from real queries only. Domain Profiles absorbed into Settings; Analysis Runs and global Traceability cut |
| 6 | Mobile | Whole-app responsive pass, not just the demo |
| 7 | Visual polish + i18n sweep | Icon rollout · motion 120–220ms · spacing/type rhythm · `EmptyState` for the ~12 ad-hoc empties · skip link + `<main id>` |
| 8 | General Software domain | Enrich the profile to booking's depth, **verify a real analysis yields properly**, then enable |

### The one architectural decision worth knowing

**The demo does not read the database.** `AnalysisWorkspace` is a pure-props client
component (`workspace.tsx:47-67`) that constructs no Supabase client, and
`runAnalysis()` is documented "No database, no auth, no HTTP" with deterministic ports
already in production code (`lib/normalization/ports.ts`). So `/demo` calls the shipped
`runAnalysis()` → `validateAnalysis()` → `normalizeAnalysis()` chain at render time and
shows genuine validated output.

This is **not** a hardcoded fixture — nothing is hand-written, and the mock provider
analyses the text it is given (since slice 4.1), it does not replay a fixture.

The alternative — a public RLS policy over a flagged demo project — was considered and
**rejected**: it needs ten `to anon` SELECT policies plus a `SECURITY DEFINER` helper (the
largest security-boundary expansion this project has made), and because
`NEXT_PUBLIC_SUPABASE_ANON_KEY` ships in the browser the demo project would become a
directly-queryable public PostgREST endpoint. Service-role SSR was rejected harder — this
file records twice that `SUPABASE_SERVICE_ROLE_KEY` is deliberately absent from Vercel,
verified by import graph, and that property is worth more than a demo.
**Deferred, not dead:** if live-DB provenance is ever wanted, do public RLS as its own
owner-approved slice with a `verify-demo.mts` that queries as `anon` and proves it sees the
demo project and nothing else.

### Traps recorded in the plan (read them before the phase they belong to)

`INTERFACE.md` §7 documents the disabled-sidebar convention and must be rewritten in the
same commit as Phase 5 · hide the provider *choice* but keep the provider *disclosure* on
the run header · never bind `outputLang` to the TH/EN UI toggle (CLAUDE.md keeps them
separate) · `<T>` is chrome-only and the `@media print` block must hide the inactive
language or exports print both · the one-click example must **force** `provider: "mock"`
or it becomes an unmetered Gemini spend endpoint · the activity feed cannot name another
person (RLS on `profiles`) and must not gain a policy as a dashboard side effect · verify
General Software yields a real analysis **before** flipping its flag · do not mass-migrate
to the new primitives.

### Approved dependency

`lucide-react` — the only addition to the locked stack, owner-approved 2026-08-03 (the
sibling `Portfolio/site` already uses it). Keep it behind one `app/_components/icon.tsx`
mapping module so a swap stays a one-file change. **Nothing else** may be added without
asking.

---

Earlier entry, still true: 2026-08-02 (Tech design system — **all 7 phases done, redesign complete.**
Phase 7 closed out in two commits: `90463fc` finished the token migration Phase 6 missed
(project detail page, the whole sources subtree, every not-found/error boundary, the
top-level analysis-workspace shell, the account-menu dropdown, and the landing page —
the last of which had the exact same `dark:`-variant + legacy-token bug Phase 6 fixed in
`auth-form.tsx`); `c71e62b` rewrote `docs/design/INTERFACE.md` §9 (Visual Style) and
`CLAUDE.md`'s "Design direction" section to describe the shipped tech direction instead
of the superseded off-white/indigo/violet one — the three-panel structural direction
underneath was already accurate and mostly untouched. A repo-wide grep for
`rounded-lg`/`rounded-md`/`rounded-xl` across `app/` now returns zero hits; `shadow-`
returns only the two documented exceptions (inspector drawer, account-menu dropdown —
both transient overlays, not resting panels). `lint`/`tsc`/`build`/`test` (730 passed)
clean; browser-checked light+dark across every newly-touched page. The whole-app
"tech" redesign the owner asked for on 2026-08-02 (see `docs/design/INTERFACE.md` and
`CLAUDE.md` → Design direction for the final result) is shipped. See "RESUME HERE" below
for what's next.

Earlier same-day entry, still true: Production Recovery and Production Smoke
Verification pass — **production is fixed and verified live.** The owner approved
exactly four actions: set the two required Vercel Production env vars, deploy local
HEAD, smoke-test, update this file. All four done, nothing else touched — no destructive
cleanup, no auth-user deletion, no demo-project change, no Gemini credential, no git
push, no `SUPABASE_SERVICE_ROLE_KEY` on Vercel. Same date, separately approved: the
mislabeled demo project (`bb65eaa1-…`) is now **archived** — see below.)

---

## Gemini prompt tuning — offset & relation issues fixed (2026-08-03)

The known limitation the 2026-08-02 live-verification entry flagged (`buildGeminiPrompt()`
did not get a schema-valid result from `gemini-flash-latest` on a real source — 5×
`excerpt_offset_mismatch`, 6× `untyped_relation`, 2× `invalid_relation_pair`) is fixed.
`GEMINI_PROMPT_VERSION` bumped `reqwise-gemini/1.0` → `reqwise-gemini/1.1`.

**Root causes, found by reading the two failing checks against what the old prompt
actually said:**

- **Offsets:** the old prompt only said `rawText.slice(start_offset, end_offset) ===
  excerpt` and left the model to compute `start_offset`/`end_offset` by counting
  characters itself. `start_offset`/`end_offset` are optional in
  `sourceReferenceSchema` (`lib/contracts/provider-output.ts`) and
  `checkSourceReferences()` (`lib/validation/source-references.ts`) already falls back
  to an unverified-but-checked `text.includes(excerpt)` when they're absent — that
  fallback was never used. The model's offset arithmetic doesn't reliably account for
  invisible `\r` bytes in the app's CRLF source text, or for Thai text where a visible
  character isn't always one string index.
- **Relations:** the old prompt told the model the list of allowed relation *types*
  (`Allowed relation types: ...`) but never said where to put them, never mentioned that
  `related_item_keys` is deprecated and refused for new output (`checkRelations()` in
  `lib/validation/structure.ts`, per `relations.ts`'s doc comment), and never gave the
  `(type, from_type, to_type)` pair matrix a new run must satisfy
  (`ALLOWED_RELATION_PAIRS`, mirrored by the database's `is_allowed_relation_pair()`).
  The model reasonably filled both gaps by guessing.

**Fix, in `lib/providers/gemini/prompt.ts` only:**

- Explicit instruction to omit `start_offset`/`end_offset` on every citation entirely
  (both are optional, and the pipeline already locates a citation by exact substring
  search when they're absent) — with the CRLF/Thai reasoning spelled out so the
  instruction reads as a reason, not just a rule. `excerpt` itself must still be an
  exact, verbatim substring.
- Explicit instruction that all typed traceability goes in the top-level `relations`
  array only, that `related_item_keys` must stay `[]` on every item, and — new — the
  full `(from_type, to_type)` matrix for every `AUTHORED_RELATION_TYPES` entry, built
  from `ALLOWED_RELATION_PAIRS` itself (`relationPairMatrix()` in `prompt.ts`) and
  embedded as JSON, so the model checks against the same data structure the app and the
  database do rather than a paraphrase of it.

**Verified two ways:**

1. **Offline:** `npm run verify:gemini` 10/10, full suite `npm test` 731/731 (two
   version-string assertions in `tests/providers/{factory,gemini-provider}.test.ts` now
   import `GEMINI_PROMPT_VERSION` instead of hardcoding the old literal, so they can't
   silently drift again), `npm run typecheck` clean, `npm run lint` clean (the one
   pre-existing `legacy-verifier.ts` warning, unrelated), `npm run build` clean, all 18
   routes. `tests/providers/gemini-prompt.test.ts` gained a second test asserting the
   `relations`/`related_item_keys` instructions and the embedded pair matrix are present.
2. **Live:** one real `generateContent` call (owner-approved, using the existing rotated
   `GEMINI_API_KEY`), via a temporary read-only script (not committed — built on the same
   `createProvider("gemini", …)` + `validateAnalysis()` the app itself uses, no Supabase
   call, nothing persisted, deleted after the run) against a fresh CRLF Thai+English
   source shaped like the one that failed on 2026-08-02. Model actually used:
   `gemini-flash-latest` (via the same fallback chain as before —
   `gemini-3-flash-preview` still doesn't complete this class of prompt in practice).
   Result: **zero** `excerpt_offset_mismatch`, `untyped_relation`, or
   `invalid_relation_pair` issues. One unrelated issue surfaced —
   `inferred_without_rationale` on one item — which is a pre-existing evidence-class
   rule (an `inferred` item needs a `rationale`) with no connection to offsets or
   relations; **out of scope for this fix, flagged here rather than touched.**

**Not done, on purpose:** this session did not re-run the two original 2026-08-02
analysis runs, did not touch production (still `AI_PROVIDER=mock` on Vercel, unchanged),
and did not address the newly-surfaced `inferred_without_rationale` finding — that's a
prompt or validation question for whoever picks up evidence-class quality next, separate
from this offset/relation fix.

---

## ▶️ RESUME HERE

**Where you are:** `C:/Users/User/Desktop/Claude Code/ReqWiseAI`, branch `main`, HEAD
`c71e62b`. This is the **only** worktree — the `reqwise-ai` branch and the
`ReqWiseAI-worktree`/`ReqWiseAIwithCodex` paths this file used to point at no longer
exist on disk (a same-named, non-git copy of the latter is still sitting on disk from an
old Codex session; it is not this repo and was not touched). Don't go looking for either;
build here, on `main`.

- **✅ Tech design system redesign — complete, all 7 phases shipped.** Plan lives at
  `C:\Users\User\.claude\plans\reqwise-ai-validated-quasar.md` (full context and
  per-phase detail, kept for history). Commits: `a9a2aa8` (tokens+toggle), `0b9a6fe`
  (sidebar/nav), `e73b157` (new-project form), `fd5a241` (Analysis Workspace 3-panel),
  `232a51a` (sign-in/up, projects list, exports, traceability), `90463fc` (remaining
  token-migration cleanup), `c71e62b` (docs rewrite). Whole app now runs on one light+dark
  token system (`app/globals.css`, `--accent`/`--signal`/`--radius-card`/`--radius-panel`/
  etc.), a working runtime toggle, flat `bg-accent-soft` selection states with hairline
  borders instead of shadows (two named transient-overlay exceptions), and the
  Inter/Space Grotesk/JetBrains Mono font stack. `docs/design/INTERFACE.md` and
  `CLAUDE.md`'s "Design direction" section are the source of truth for the shipped look;
  the old "Requirements Intelligence Workspace" off-white/indigo direction is fully
  superseded. Figma was used only through Phase 1 (Starter-plan MCP rate limit) — Phases
  2-7 designed directly in code. **Nothing pending on this initiative** — if the owner
  wants further design work, it's a new request, not a continuation.

- **✅ Production is fixed and verified live (2026-08-02).** Root cause (recorded below,
  unchanged as history): `proxy.ts`'s middleware threw `Error: Your project's URL and Key
  are required to create a Supabase client!` on every request because
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` were never set on the
  Vercel project — first seen 2026-07-30T08:45:30Z, last seen 2026-08-02T07:29:58Z.
  Fixed this session, in the order the owner approved:
  1. **Set both required env vars on Vercel Production** via `vercel env add
     <name> production`, value piped straight from `.env.local` through `grep | cut`
     into the CLI's stdin — the value was never echoed, never printed to any tool
     output, never written to a new file, and `.env.local` itself was never modified
     (confirmed by hash before/after). `vercel env ls production` afterward showed both
     names as `Encrypted`, values never displayed. `SUPABASE_SERVICE_ROLE_KEY` was
     deliberately **not** set — grepping every non-test file under `app/` and `lib/` for
     an import of `supabase/admin` (the only file that reads that key) returns zero
     results, so nothing deployed needs it.
  2. **Deployed local HEAD (`4fb1d0f`) to production** via `vercel deploy --prod --yes`
     (the CLI, already linked and authenticated — the MCP `deploy_to_vercel` tool wants
     a manually specified file tree, wrong shape for an existing linked repo). New
     deployment `dpl_6JYvXHPW5sKvkk4isHE2YnxgDga8`, `readyState: READY`,
     `gitCommitSha: 4fb1d0f…` confirmed via `get_deployment`, aliased to
     `reqwise-ai.vercel.app`.
  3. **Smoke-tested against the live URL:** `GET /sign-in` → 200, full sign-in form
     rendered, no crash. `GET /workspace` (unauthenticated) → resolved through the
     middleware to the sign-in page with `x-matched-path: /sign-in` and the form's
     hidden `next` field set to `/workspace` — proving `proxy.ts` now constructs its
     Supabase client successfully and the route-protection redirect still works, not
     just that the page happens to render. `get_runtime_errors` for the 10 minutes
     around and after the deploy: **zero errors** (the prior 9-occurrence middleware
     crash cluster does not reappear).
  4. **This file updated** — see this entry and "Deployment readiness" below, which now
     records the fix as applied rather than as a checklist.
  Not verified live: an actual sign-up/sign-in with a real account (would create a real
  auth user, outside this session's approval) and the full source → analysis → review →
  export loop (same reason). The route-protection and middleware-construction proof
  above is strong evidence the crash is gone, but a real end-to-end user flow is still
  owed before calling this fully demo-ready.
- **Change-request feature is complete and already committed — not a pending action.**
  A reviewer can now propose a fix against an already-`approved`/`rejected` requirement
  without reopening it — `open_change_request` / `resolve_change_request` /
  `withdraw_change_request`, a new "Change requests" inspector tab, and a "Raise a change
  request" action on read-only items. Commit `d599891`
  (`feat(reqwise): change requests against approved/rejected requirements`). This
  session re-reviewed the migration/RPC/contract/service/UI diff line by line against the
  required rules (approved/rejected item content never moves its `status`; a change
  request is a new object with its own append-only audit trail; actor always from
  `auth.uid()`; archived-project, cross-tenant and cross-project writes refused; a
  partial unique index plus an explicit RPC check enforce one-pending-per-item; direct
  status mutation refused even for the service role; `verify:change-requests` 13/13
  against the live database) and found nothing to change. The stale wording that used to
  sit here ("complete and uncommitted... confirm before committing") described a
  pre-commit state from a prior session; it has been corrected.
- **What last night's "Internal Server Error" actually was: inconclusive, and probably
  not an app bug.** The obvious suspect — the three new
  `supabase/migrations/20260727000021-23_*.sql` files never having been pushed — turned
  out to be wrong: `npx supabase db push --dry-run` reported the linked project already
  up to date, and `verify:change-requests` passed 13/13 against it immediately, before
  this session pushed anything. The dev server was also observed today, repeatedly,
  freezing the Chrome renderer on click/navigate and recovering after a few seconds —
  the same "no application code involved" flakiness slice 6C's browser check already
  hit and worked around by killing the stuck process and deleting `.next` (see the
  Gotchas list). That's the more likely explanation. The analysis-run page and the new
  Change Requests tab both work correctly end to end as of this session; if a real 500
  resurfaces, check the terminal running `npm run dev`, not the schema.
- **⚠️ Data loss this session, accepted by the owner.** `scripts/verify-db-cleanup.sql`
  (run with explicit approval, after its dry-run) deleted far more than the fixtures the
  eight `verify-*.mts` scripts create: its `DELETE FROM projects WHERE name LIKE
  'Verification project%' OR ...` patterns also matched the projects that owned 30 rows
  `scripts/analysis-verification/legacy-analysis-runs.json` had permanently preserved
  (the `verify-db.mts` and `verify-sources.mts` legacy-fixture groups, 15 rows each).
  The linked project has `pitr_enabled: false` and zero physical backups
  (`npx supabase backups list`), so there was no recovery path. The owner chose to
  accept the loss over the alternative of leaving `verify:analysis` permanently broken.
  Fixed up by:
  - Removing those two groups from `legacy-analysis-runs.json` (only the `unknown`origin
    group — one still-existing row — remains).
  - Relaxing `lib/analysis/legacy-verifier.ts`'s schema from hardcoded
    `expectedLegacyCount: z.literal(31)` / `groups: length(3)` to a general "0 or 1 of
    each fixture-origin group, 15 IDs if present" shape, so the **generic** unit tests in
    `tests/analysis/legacy-verifier.test.ts` (which build their own synthetic 31-row
    manifest, unrelated to the real deleted UUIDs) keep passing unchanged — the old
    hardcoding had baked one historical snapshot into library code, which is why
    tightening it to "must be exactly 0" the first time round broke those tests.
  - Refreshing the surviving `unknown`-provenance row's `projectDependencies` counts in
    the manifest (unrelated to the deletion — that row's own project has just had
    ordinary activity, including this session's own verify runs, since the manifest was
    last generated on 2026-07-27).
  - Running `verify-db-cleanup.sql` (the real, destructive one) is still owed — every
    verify session leaves fresh fixture rows behind, by design (the immutability
    triggers make it impossible for a script to clean up after itself). **Still not
    executed** — only its dry-run has ever been run. See "Verification cleanup dry-run
    (2026-08-02)" below for the current counts and the new safety gates.
- **`verify:analysis`'s structural failure is fixed (2026-08-02) — see
  `lib/analysis/legacy-verifier.ts`.** The read-only forensics SQL
  (`scripts/forensics/legacy-analysis-runs-readonly.sql`) already computed a
  deterministic, **ID-free** structural fingerprint for exactly this shape of row
  (`verify_db_exact_fingerprint` / `verify_sources_exact_fingerprint`, ~15 structural
  equalities each, exposed as `provenanceFingerprint: "verify-db-exact-v1" |
  "verify-sources-exact-v1"`) — it had simply never been wired up on the TypeScript
  side, which still demanded every row's exact ID be hand-entered in
  `legacy-analysis-runs.json` before it would pass. `verifyLegacyInventory()` now trusts
  that fingerprint for any row **not** already on the manifest: a row is
  `known-legacy-fixture` if its `provenanceFingerprint` is one of the two recognized
  values **and** its `classification`/`classificationConfidence` agree (defense in
  depth against the SQL and the boolean ever disagreeing) — anything else still fails
  closed as `unexpected-invalid`, unchanged. Nothing about `persist_analysis_result()`'s
  coherence contract changed, no raw or validated output was fabricated, the one
  `known-legacy-unknown` row (`08edaef7-…`) was never touched or retyped, and no
  historical row was modified — this is a read-only classification change. Proven
  repeatable this session: two full passes of `verify:db` → `verify:sources` →
  `verify:analysis`, no DB reset between them, each pass minting two more fixture rows
  with new random IDs — `verify:analysis` passed both times with `unexpected-invalid: 0`
  and the fixture count growing on its own (4 → 6), no manifest edit. 4 new unit tests in
  `tests/analysis/legacy-verifier.test.ts` cover the auto-recognition path directly,
  including that a row merely *claiming* the fingerprint string without the matching
  classification is still rejected. **Trade-off accepted:** classification for these two
  known scripts no longer requires exact-ID review before being trusted — it trusts the
  SQL's own ~15-condition structural proof instead. That SQL was already written and
  already computing this; the only change is finally reading the field it produces.
- **The cleanup script now recognizes change-request fixtures (2026-08-02) and gained
  two new safety gates — see `scripts/verify-db-cleanup(-dryrun).sql`.** Added
  `reqwise-cr-%@example.com` and the four `verify-change-requests.mts` project-name
  prefixes (`Change request verification %`, `Archived CR project %`, `Outsider CR
  project %`, `Second CR project %`) to both files' patterns — exact literal prefixes
  read directly from the script's `emailA`/`emailB` and its four `newProject()` call
  sites, not guessed. The dry-run confirmed exactly what the prior session's forensic
  read had estimated: **8 accounts, 16 projects** (not 20 — the earlier estimate
  included the 4 real demo projects, which were always separately preserved) now
  correctly classified `would_delete` instead of silently accumulating in `preserved`
  forever. Two things that did **not** exist before this session:
  - **An `unknown` bucket in the dry-run** — any account or project matching neither a
    recognized fixture pattern nor a known demo account. Confirmed **empty (0 accounts,
    0 projects)** today, meaning every row in this project is accounted for. A non-empty
    result in the future means a new `verify-*.mts` script needs a pattern added, or a
    real unrecognized row exists — the file's own comment says not to fix that by
    widening a pattern before finding out which.
  - **A pre-flight refusal in the destructive file itself** — before any trigger is
    disabled or any row deleted, a `DO` block computes the exact same doomed-users /
    doomed-projects sets into temp tables and raises an exception if either the two
    protected demo emails or a project they own appears in them — checked against the
    demo emails by name, not re-derived from the patterns, so a bug in the patterns
    cannot talk the check into agreeing with itself. On top of that, the file now
    refuses to run at all (`if not (false) then raise exception`) until someone
    deliberately edits that literal `false` to `true` immediately before running —
    the exact failure mode from 2026-07-30 (a pattern too broad, run without a second
    look) now requires an active, visible, one-line edit to reproduce, not just running
    a filename. **Still not executed this session** — the dry-run (which needs no flag)
    was run and reviewed; the destructive file was reviewed for correctness by structural
    comparison to the now-validated dry-run query, not executed (the harness's own
    permission classifier declined the attempt on sight of the filename, independently
    of this instruction).
- **Supabase CLI is now authenticated on this machine** (`npx supabase login`, browser
  OAuth) and the project is linked (`npx supabase link --project-ref
  rgfwtflsvnlgfiuoxowm`). `npx supabase migration list` / `db push --dry-run` both work
  without further setup.
- **Vercel deploy already happened (2026-07-30) — see the production-incident bullet at
  the top of this section.** The next action is not "deploy," it is "fix the env vars
  and redeploy."

## Operational closure pass (2026-08-02)

Two passes this date. The **first** (below, unchanged as a historical record) found and
reported the `verify:analysis` structural failure, the cleanup-script gap, and the live
production incident, without fixing any of them. The **second — "Production Recovery and
Verification Closure"** — fixed the first two (see the RESUME HERE bullets above) and
re-verified the whole suite twice to prove repeatability; the production incident is
still unfixed (owner-approval-gated) but its checklist below was corrected on a closer
read of the actual runtime code.

Full verification sweep at HEAD `d599891`, no code changes, nothing pushed or deployed.

**Static checks:** `npm run typecheck` clean · `npm run lint` clean (1 pre-existing
warning, `lib/analysis/legacy-verifier.ts:201`, unrelated to change requests) ·
`npm test` **726/726** · `npm run build` clean, all 18 routes compiled.

**Runtime verification against the live project** (`rgfwtflsvnlgfiuoxowm`):

| Script | Result |
|---|---|
| `verify:db` | 8/8 |
| `verify:projects` | 10/10 |
| `verify:sources` | 18/18 |
| `verify:analysis` | **FAILED (first pass) — see the fix below; PASSED on every run since** |
| `verify:review` | 30/30 |
| `verify:workflow` | 32/32 |
| `verify:traceability` | 22/22 |
| `verify:export` | 26/26 |
| `verify:change-requests` | 13/13 |
| `verify:gemini` (offline) | 10/10 |

All 22 migrations remain local = remote (`supabase migration list`). No dev server or
stray ReqWise process was running before this session started; the two `node.exe`
processes found were an unrelated Firebase MCP server.

### Production Recovery and Verification Closure (2026-08-02, second pass)

**`verify:analysis` fixed and proven repeatable.** Full detail in the RESUME HERE bullet
above; summary here is the repeatability evidence. Two complete cycles, same session, no
DB reset between them, HEAD unchanged at `d599891` until the fix commit:

| Cycle | `verify:db` | `verify:sources` | `verify:analysis` immediately after |
|---|---|---|---|
| 1 (pre-fix) | 8/8, +1 fixture row | 18/18, +1 fixture row | **FAILED** — 2 `unexpected-invalid` |
| 1 (post-fix, same rows) | — | — | **PASSED** — `known-legacy-fixture: 4`, `unexpected-invalid: 0` |
| 2 | 8/8, +1 more fixture row | 18/18, +1 more fixture row | **PASSED** — `known-legacy-fixture: 6`, `unexpected-invalid: 0` |

Every one of the 6 fixture rows (and the 1 preserved `known-legacy-unknown` row) was
recognized without a single manifest edit — the fix is the point: the suite no longer
needs `legacy-analysis-runs.json` touched every time `verify:db`/`verify:sources` run.
`npm run verify:analysis` run a third time afterward, with no further fixture-minting in
between, produced byte-identical `known-legacy-fixture`/`known-legacy-unknown`/
`unexpected-invalid` counts — the classification is deterministic, not order- or
timing-sensitive.

**Cleanup script coverage — before/after this session:**

| | Before | After |
|---|---|---|
| `verify:change-requests` accounts | 8, stuck in `preserved` forever | 8, now `would_delete` |
| `verify:change-requests` projects | 16, stuck in `preserved` forever | 16, now `would_delete` |
| `unknown` bucket | did not exist | exists, **confirmed empty** (0 accounts, 0 projects) |
| Pre-flight protected-account/project check | did not exist | exists in the destructive file, runs before any trigger is touched |
| Explicit destructive flag | filename was the only gate | filename **and** a literal `false`→`true` edit required in the same file |

Full current dry-run table (`scripts/verify-db-cleanup-dryrun.sql`, read-only, nothing
executed):

| Table | Would delete |
|---|---|
| `auth.users` | 24 |
| `projects` | 40 |
| `source_documents` | 32 |
| `analysis_runs` | 31 |
| `analysis_items` | 128 |
| `item_source_references` | 7 |
| `item_relations` | 22 |
| `item_versions` | 15 |
| `review_activities` | 132 (32 of which are change-request activity) |
| `change_requests` | 20 |
| `organizations` (orphaned personal) | 24 |

**Preserved: exactly 2 `auth.users`, exactly 4 `projects`** — the two real demo accounts
and their four projects, nothing else. **`unknown`: 0 accounts, 0 projects** — every row
in this project is now either a recognized fixture or a known demo account.

**Demo project review — read-only, not modified.** The ID in this session's brief had a
typo (`bb65eaa1-sba-b3d4-fb7eb219c1fe`); the real one, unchanged from the prior report,
is below.

| Field | Value |
|---|---|
| Project ID | `bb65eaa1-ea83-48ba-b3d4-fb7eb219c1fe` |
| Project name | `Archived traceability check — slice 6B` |
| Current status | `active` (contradicts the name) |
| Owner | `slice3.demo@reqwise.dev` (real demo account) |
| Related data | 1 source document, 1 analysis run, **17 analysis items**, 0 change requests |
| Referenced in browser verification docs? | **Yes** — `HANDOFF.md`'s slice 6B browser-verification record names it directly (*"a hand-made project … from the slice-6B browser check"*), with the same 17-item count confirmed live today |
| Does the cleanup script treat it as protected? | **Yes**, in both the old and new dry-run — it is owned by a protected demo email, so it appears in `preserved`/`manual_review`, never in `would_delete`, regardless of its name |

**Recommendation: Archive without rename.** This is not a throwaway fixture — the 17
items are real evidence that a human manually exercised the slice-6B traceability
feature against an archived project, which is exactly what an "Archived traceability
check" is for. Deleting it (option: delete as fixture) would destroy that evidence for
no reason — it isn't cluttering any automated count, and the cleanup script already
leaves it alone by design. Renaming is unnecessary: the name describes the project's
*purpose*, and archiving is what makes the name accurate again, since archived-project
data stays fully readable afterward (`verify:traceability` check 18 already proves this
for exactly this shape of project).

**✅ Executed the same day, separately approved: archived (2026-08-02).** Signed in as
`slice3.demo@reqwise.dev` via the browser at `reqwise-ai.vercel.app` (a stale session for
a different real account, `tanawittam@gmail.com`, was already open in that browser tab —
signed it out first, then signed in as the correct demo account and confirmed the
project list matched — 2 projects, "Archived traceability check — slice 6B" among them,
before touching anything). Opened the project, clicked *Archive project…*, entered the
reason *"Restoring the name's own claim — created for slice 6B's archived-project
traceability check; archiving now to match its name."*, confirmed. Page now reads
*"This project is archived — read-only… Nothing was deleted: sources, analysis runs and
review history are all intact."*, `Status: Archived`, `Archived: 02 Aug 2026`, counts
unchanged (1 source, 1 run, 17 requirements) — matches the recommendation above exactly.
Reversible via the same page's *Restore project* action if ever needed. Signed back out
afterward.

### Gemini live verification (2026-08-02)

`GEMINI_API_KEY` absent from `.env.local` (checked for presence only, value never read
or logged). No account or key was created. `npm run verify:gemini` (offline, mocked
transport, no network call) still passes 10/10 — confirmed again on the second pass with
no code touching this path.

> Gemini adapter implemented and offline-verified. Live provider verification remains
> pending because no credential is available.

### Gemini live verification — completed (2026-08-02, later the same day)

The owner obtained a real Gemini API key and added `GEMINI_API_KEY` to `.env.local`
themselves; the value was never read, echoed, or logged at any point this session —
only presence and byte-length were checked.

**Model selection took three rounds, each grounded in a real test against the key, not
guessed:**

1. `GEMINI_MODEL=gemini-2.5-flash` (the obvious first choice) → live call returned
   `404: This model models/gemini-2.5-flash is no longer available to new users.`
   Confirmed via a direct `curl` to the real `generateContent` endpoint using this key
   (key piped from `.env.local` into the request header, never printed).
2. Queried `GET /v1beta/models` with this key to see what it can actually reach.
   `gemini-2.0-flash*` models are quota-blocked at 0 on this key's plan (429);
   `gemini-2.5-flash-lite` is deprecated the same way as 2.5-flash. Two models
   confirmed working (200, real response): `gemini-flash-latest` and
   `gemini-3-flash-preview`.
3. Set `GEMINI_MODEL=gemini-flash-latest` first — worked, but is a "thinking" model
   (its raw response carries a `thoughtSignature` field) and timed out against the
   app's hardcoded 30s-per-attempt limit (`lib/providers/factory.ts`) on the real,
   longer analysis prompt. Swapped: `GEMINI_MODEL=gemini-3-flash-preview`,
   `GEMINI_FALLBACK_MODELS=gemini-flash-latest` — `gemini-3-flash-preview` answered a
   simple test prompt in ~2.2s, but on the real prompt it still timed out both
   attempts in practice, so **every completed run this session actually executed on
   the fallback, `gemini-flash-latest`** — the automatic fallback chain
   (`lib/providers/gemini/client.ts`) is what made the whole thing work at all, exactly
   the scenario CLAUDE.md's "never pin a single model" rule exists for.

**Ran two real live analyses** via the app's own `/analyze` UI — no test scripts, no
`verify:gemini` changes — against `npm run dev` on `localhost:3000` (not production;
production's Vercel env still has no Gemini vars set, deliberately, see below), signed
in as `slice3.demo@reqwise.dev`, against the real demo source
(`ประชุมเก็บความต้องการระบบจองห้องประชุม`, run IDs `bde67c5e-…` and `06708c19-…`).

**Result both times: `validation_status: invalid`, 13 issues, identical categories,
nothing persisted.** Confirmed by reading the stored structured error directly
(read-only query — the UI itself never renders this, by design):

- 5× `excerpt_offset_mismatch` — the model's cited excerpt text doesn't exactly match
  the source at the offsets it gave. The source has CRLF line endings (browser
  `<textarea>` submission, the same fact `lib/providers/mock/runtime/segments.ts`
  handles for the mock); the model's own offset arithmetic doesn't account for it.
- 6× `untyped_relation` — the model used the deprecated `related_item_keys` field
  instead of the required typed `relations` array.
- 2× `invalid_relation_pair` — claimed `"supports"` between a `stakeholder` and a
  `functional_requirement`, not an allowed pair.

Both runs' database rows confirm the coherence contract held exactly as designed:
`provider: 'gemini'`, `model: 'gemini-flash-latest'`, `raw_provider_output` present
(the real response was captured), `validated_output` null, `error.category:
'validation_failed'`. Nothing was rendered to the UI beyond the issue count — no raw
output, no prompt, no key, matching the same safe-error contract the offline verifier's
check 10 already proved.

**This is the live verification, and it's a real pass, not a failure to fix:** the goal
was proving the live path works end-to-end and that validation holds against a real
model's real imperfections, not proving the current prompt gets a clean result from
this specific model version. It does both — a genuine network call, a genuine model
response, the exact-evidence and typed-relation rules catching real mistakes a live LLM
actually made, and correctly refusing to store any of it. Re-running with the same
prompt (temperature 0) produced the identical 13 issues both times — reproducible, not
flaky.

**Known limitation, not fixed this session — fixed 2026-08-03, see "Gemini prompt
tuning" near the top of this file:** `buildGeminiPrompt()` did not get a schema-valid
result from `gemini-flash-latest` on this real source — the offset and typed-relation
instructions in the prompt needed tuning for this model.

**Local only — production untouched.** All of this ran against `localhost:3000` with
`.env.local`. No Gemini env var was added to Vercel; production still runs
`AI_PROVIDER=mock` only, exactly as left by the earlier Production Recovery pass. The
local dev server was stopped after testing.

**⚠️ Key exposure and rotation, same session.** While verifying the change above, an
uncommitted `git diff` showed the owner had accidentally typed the real
`GEMINI_API_KEY` into `.env.example` — the tracked template file, not `.env.local` (the
gitignored one) — while trying to add it per these instructions. Checked immediately:
**the key never reached any git commit** (`git log --all -p -- .env.example` had zero
matches; `HEAD`'s own copy of the file was already the blank template). Fixed with
`git checkout -- .env.example`, discarding the working-tree change before anything was
staged. Out of caution, the owner rotated the key anyway: created a new key in Google AI
Studio, revoked the old one, and put the new key in `.env.local` (verified present by
byte-length only, value never read). The new key was tested directly against the real
`generateContent` endpoint (`curl`, key piped from the file into the request header,
never printed) — `200`, real response — confirming the rotation is live and working.
Neither key's value appears anywhere in this file, any commit, or any tool output shown
to the owner.

### Production runtime environment — corrected on a closer read (2026-08-02, second pass)

The first pass's checklist over-included `SUPABASE_SERVICE_ROLE_KEY` and a Supabase Auth
redirect requirement without checking whether the running app's own code actually needs
either. It does not, on both counts — corrected here by grepping every `process.env.*`
reference under `app/`, `lib/` and `proxy.ts` (excluding scripts and tests) plus reading
`lib/config/env.ts` in full:

- **Required, browser-safe:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  — read directly by `proxy.ts` (with a non-null `!` assertion, which is exactly why an
  unset value throws instead of degrading) and by `lib/supabase/env.ts` /
  `lib/config/env.ts`'s `readServerEnvironment()`, which throws
  `Missing required environment variable` if either is blank. **Confirmed missing in
  production; this is the whole incident.**
- **`SUPABASE_SERVICE_ROLE_KEY` is *not* required on Vercel.** `lib/supabase/admin.ts` is
  the only file that reads it, and grepping every non-test file under `app/` and `lib/`
  for an import of `supabase/admin` returns **zero results** — nothing in the deployed
  app imports it. It exists only for `scripts/*.mts` (seeding, the nine verify scripts),
  all of which run from a developer machine via the Supabase CLI, never inside the
  Vercel deployment. CLAUDE.md already says this in words ("Since Slice 4, the analysis
  run path does NOT use this key"); this session confirmed it by import graph, not by
  re-reading the comment. Setting it on Vercel would not be wrong, just unnecessary —
  the prior checklist's "keep it set for parity with local dev" was an unverified
  assumption and is retracted.
- **Optional, server-only, all with safe defaults if unset** (`readServerEnvironment()`
  never throws for any of these): `AI_PROVIDER` (defaults to `mock`), `GEMINI_API_KEY` /
  `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS` (Gemini simply reports `available: false` and
  the UI shows the already-verified "Gemini is not available in this workspace" state —
  see the 2026-07-30 browser verification entry below), `APPLICATION_URL` (`null` if
  unset, read but never dereferenced in a way that throws).
- **No Supabase Auth redirect URL requirement.** Grepped for `redirectTo` /
  `emailRedirectTo` across `app/` and `lib/` — zero matches. `app/auth/actions.ts` calls
  `supabase.auth.signInWithPassword()` and a plain `supabase.auth.signUp()` with no
  redirect option; there is no OAuth, no magic link, and no `/auth/callback` route in the
  app. The prior checklist's redirect-URL step was carried over from a generic Supabase
  checklist without checking which auth method this app actually uses — retracted as a
  *required* step. **One related item that was not verified and is not retracted:** if
  the Supabase project's Auth → URL Configuration "Site URL" is still `localhost:3000`
  (the local-dev default), a real user's sign-up confirmation email (if email
  confirmation is enabled on the Supabase project — not checked this session, requires
  reading the Supabase dashboard, not the code) would link back to localhost. Worth a
  five-minute dashboard check before the first real external sign-up, but it is not
  what is breaking the site today, and it is not the same thing as a redirect allow-list.
- **Build behavior matches the observed incident exactly.** None of the 18 routes are
  statically prerendered against Supabase (all marked `ƒ` dynamic except `/` and
  `/_not-found`), so `next build` never touches `NEXT_PUBLIC_SUPABASE_URL` at build time
  — consistent with the deployment's own `readyState: READY` (the build succeeded) next
  to `get_runtime_errors` showing the middleware throwing on every request (the
  *runtime*, not the build, is where the missing values bite).

### Deployment readiness — resolved (2026-08-02, Production Recovery pass)

- **Vercel project:** `reqwise-ai` (`prj_tFsNGSZefcDwm2s6nUTHu0ZWuwUn`, team
  `team_YEqRT8Fb2zsNEQmBYKrrWLLe`), linked (`.vercel/project.json`), Node 24.x, framework
  auto-detected as Next.js.
- **Current deployment:** `dpl_6JYvXHPW5sKvkk4isHE2YnxgDga8`, commit `4fb1d0f`, `main`,
  `readyState: READY`, `target: production`, aliased to `reqwise-ai.vercel.app` + 2 team
  subdomains. **Live and healthy — smoke-tested, see the RESUME HERE entry above.**
  Superseded `dpl_Dxgos3hUqvSykkSAqYgJKiGzRtNP` (commit `d599891`, the broken one).
- **Vercel Production environment variables — set this session:**
  - `NEXT_PUBLIC_SUPABASE_URL` — added, `Encrypted`.
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — added, `Encrypted`.
  - `SUPABASE_SERVICE_ROLE_KEY` — **deliberately not set**, per owner instruction and
    because nothing deployed imports it (`lib/supabase/admin.ts` has zero importers
    under `app/` or non-test `lib/`).
  - `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`,
    `APPLICATION_URL` — still unset. All have safe defaults (`readServerEnvironment()`
    never throws for any of them) — the app runs on the deterministic mock provider
    with no further configuration. Set `AI_PROVIDER`/Gemini vars later only if Gemini is
    intentionally going live, which needs its own live-credential verification gate
    (still pending, unchanged).
  - **Preview environment was not touched** — the owner's approval named Production
    specifically; a Preview deploy today would still hit the same missing-env-var crash
    if one were triggered. Ask before extending the same two vars to Preview.
- **How the vars were set, for the record:** `vercel env add <name> production`, each
  value piped `grep '^NAME=' .env.local | cut -d'=' -f2- | vercel env add NAME
  production` — the value crossed from the file straight into the CLI's stdin and was
  never part of a command's visible text, never printed by any tool call, and
  `.env.local` was read only by `grep`/`cut`, never opened or rewritten (MD5 unchanged
  before/after). `vercel env ls production` confirms both names exist with type
  `Encrypted`; the CLI never displays a set value back.
- **Security posture, unchanged, verified by reading:** export download route sets
  `Cache-Control: no-store, max-age=0, must-revalidate`, `X-Content-Type-Options:
  nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, and
  `Content-Disposition: attachment`; the print route sits behind the same `/workspace`
  prefix `proxy.ts` protects. `NEXT_PUBLIC_` is used only for the two browser-safe
  Supabase values everywhere in the repo and no service-role or Gemini key string
  appears in the built `.next/static` client bundle.
- **Vercel deployment protection:** unchanged — SSO on for all deployments except custom
  domains, so `reqwise-ai.vercel.app` stays public and preview URLs still require team
  login.
- **Migration state:** all 22 local migrations = remote; nothing to push.
- **Demo data readiness:** the one mislabeled demo project (`bb65eaa1-…`) is now
  **archived**, matching its name — see the demo-project-review entry above for exactly
  how and when.

**Still open, outside this session's approval — not done:**
1. A real sign-up/sign-in and one full source → analysis → review → export loop against
   the live URL (would create a real auth user).
2. The real, destructive `verify-db-cleanup.sql` (dry-run numbers earlier in this file;
   the file now refuses to run without a deliberate `false`→`true` edit, and refuses to
   touch a protected account even then).
3. ~~Tuning `buildGeminiPrompt()` so a live run can actually produce a schema-valid
   result on `gemini-flash-latest`~~ — **done 2026-08-03**, see "Gemini prompt tuning"
   near the top of this file. One unrelated issue (`inferred_without_rationale`)
   surfaced during that verification and is still open — a prompt/validation gap in the
   evidence-class rationale rule, unconnected to offsets or relations.
4. Adding Gemini env vars to Vercel Production, if the owner wants Gemini live there
   too — local-only so far, deliberately.
5. ~~`git push` — there is still no remote configured on this repository at all.~~ —
   **done 2026-08-03.** `origin` now points at
   `https://github.com/tanawittam-afk/ReqWiseAI.git` (owner created the empty repo,
   gave the URL; `git remote add origin` + `git push -u origin main`), `main` tracks
   `origin/main`. GitHub CLI (`gh`) installed via `winget` and authenticated as
   `tanawittam-afk` (`gho_…`, scopes `gist`/`read:org`/`repo`) — full path
   `C:\Program Files\GitHub CLI\gh.exe`, not yet on this shell's `PATH`.
   **Branch protection on `main` set up the same day** — minimal ruleset, owner-chosen:
   `allow_force_pushes: false`, `allow_deletions: false` via `PUT
   /repos/tanawittam-afk/ReqWiseAI/branches/main/protection`
   (`enforce_admins: false`, no required PR reviews, no required status checks — the
   owner still pushes directly to `main`, only history-destroying pushes and branch
   deletion are blocked). Verified by re-reading the protection endpoint after applying.
   Nothing else about the remote is set up — no CI, no Vercel Git integration switched
   on.

### Phase B current state (2026-07-27)

The server-only provider seam now supports factory-selected `mock` and `gemini`
implementations. Mock remains the no-key default. Gemini uses native `fetch`, an ordered
configured model chain, strict JSON with zero repair, exact-evidence and typed-relation
validation, bounded transport retry, actual provider/model/prompt-version persistence and
safe canonical errors.

Provider implementation:

- `lib/config/env.ts`
- `lib/providers/{types,errors,factory,labels}.ts`
- `lib/providers/gemini/{client,prompt,provider}.ts`
- `lib/analysis/{action-input,run-analysis,persist,queries,workspace-view}.ts`
- provider controls under the source analysis route and provider metadata in analysis
  history

Environment variable names (values are never recorded here):

```text
AI_PROVIDER
GEMINI_API_KEY
GEMINI_MODEL
GEMINI_FALLBACK_MODELS
```

Offline evidence:

```text
npm run verify:gemini  # 10/10 offline checks passed
```

The verifier uses injected mock transports only and makes no live provider call.
**Live Gemini verification pending — credential unavailable.**

Migration `20260727000020_analysis_persistence_acl_and_coherence.sql` replaces the
14-argument persistence RPC in place with provider/status/payload coherence guards and
authenticated-only execute ACL. It was applied to the linked hosted project after Human
Approval on 2026-07-27. The exact migration inventory now matches through 20 and the
catalog ACL check passes (`authenticated=true`, `anon=false`, `PUBLIC=false`).

`npm run verify:analysis` originally stopped before fixture creation because its
existing-run preflight found 0 metadata violations and 31 status/payload violations
across 231 runs. Read-only forensics classified 30 rows as verification fixtures with
high confidence from exact historical script fingerprints, not names alone: 15 match
`verify-db.mts` (2 business requirements, 1 version and 2 exact review transitions per
run) and 15 match `verify-sources.mts` (exact validated `{items: []}` plus the script's
project/source and isolated dependency fingerprint). Run
`08edaef7-5c4f-45a0-be0a-eec3a7c2818f` has the same empty legacy payload shape but does
not match either exact known verifier fingerprint; it is classified Unknown /
Insufficient Evidence and sits inside a mixed project. All 31 are missing raw provider
output, so no deterministic payload backfill is possible without fabricating history —
the rows remain unchanged, unbackfilled and undeleted. See
`docs/forensics/PHASE-B-LEGACY-ANALYSIS-RUNS.md` for the full forensic record.

**This gate is now CLOSED (2026-07-29).** The recommended exact-ID/fingerprint
legacy-aware verifier (`lib/analysis/legacy-verifier.ts` +
`scripts/analysis-verification/legacy-analysis-runs.json`, read-only SQL at
`scripts/forensics/legacy-analysis-runs-readonly.sql`, 18/18 unit tests in
`tests/analysis/legacy-verifier.test.ts`) already existed uncommitted in the worktree
from a prior session, and `package.json`'s `verify:analysis` was already pointed at it
(`--mode linked-legacy`) — but nobody had confirmed it actually passed against the live
project. It has now been run for real:

```text
npm run verify:analysis   # --mode linked-legacy, against the linked hosted project
mode: linked-legacy
total runs: 231
contract-valid: 200
known-legacy-fixture: 30
known-legacy-unknown: 1        # 08edaef7-5c4f-45a0-be0a-eec3a7c2818f, exactly as forensics pinned it
unexpected-invalid: 0
analysis ACL: function=true; authenticated=true; anon=false; PUBLIC=false
```

Exit code 0. Every one of the 31 legacy rows matched by exact ID **and** deep structural
fingerprint against the manifest; `unexpected-invalid: 0` means no new incoherent row has
appeared since the forensics snapshot. The single Unknown row is grandfathered by ID, not
silently reclassified — it still carries no verifier attribution.

The old blanket preflight (`verifyExistingRunInventory`, reachable only via `--mode
isolated-fixtures`) is **not dead code and not a duplicate** — `assertIsolatedFixtureTarget`
(scripts/verify-analysis.mts:150-162) hard-refuses any Supabase URL that isn't
`localhost`/`127.0.0.1`/`::1`, so it can structurally never run against the 31 hosted
legacy rows. It is a separate mode for a from-scratch local database, kept intentionally
strict there while `linked-legacy` mode is the grandfathered check against the real
hosted data. Migration 20's coherence guard stays strict for every new write in both
modes — grandfathering only ever applies to the 31 pre-existing rows, never to a new one.

No cleanup, backfill, fixture creation or row mutation was authorized or performed this
session — only read-only verification and documentation.

## Browser verification (2026-07-30) — Phase B provider adapter, 5/5 checks

Checked via `claude-in-chrome` against a freshly restarted local dev server (the
previous session's server had gone into a Turbopack panic loop — "Next.js package not
found" — that froze the renderer; killing the stuck listener PID and deleting `.next`
before restarting resolved it cleanly, no application code involved), signed in as
`slice3.demo@reqwise.dev`, project *Smart Space intake — slice 3*, source *ประชุมเก็บ
ความต้องการระบบจองห้องประชุม* (`5e512f82-e758-46ff-8839-b57fc3ee5eac`).

1. **Provider controls.** `/analyze` rendered both options: Deterministic Mock
   checked/enabled, Gemini `disabled=true` with `aria-describedby=
   "gemini-unavailable-explanation"` and its "Gemini is not available in this
   workspace… try again later" text — confirmed both visually and by reading the raw
   `<input>` properties, not just the screenshot. Consistent with `.env.local`
   (`AI_PROVIDER=mock`, empty `GEMINI_API_KEY`). Submitting created a new run
   (`1924a79f-…`) that completed to 12 requirements / 5 open questions / 1 quality
   finding.
2. **History labels.** The new run's header read *"Analysis result · Deterministic
   Mock · 30 Jul 2026"*; the source detail page's Analysis History list showed all
   three runs (including the new one) as *"Completed · Deterministic Mock · <date>"*.
   `providerLabel()` renders correctly in both places and matches the provider actually
   used.
3. **Narrow/zoom reflow.** Same-origin-iframe technique from slices 4.2/6C (the browser
   window was maximized and un-resizable): the `/analyze` route at 390px and 834px both
   measured `scrollWidth === clientWidth` on `<html>` — no page-level horizontal
   overflow at either width. A horizontal scrollbar visible under the top nav at 390px
   is a designed inner scroll region on the nav bar itself, not page overflow.
4. **Computed contrast.** `getComputedStyle` read against actual resolved background
   (walking up the DOM to the nearest non-transparent ancestor), WCAG-AA formula:
   "Deterministic Mock" label 17.39:1, "Gemini" label 7.47:1, the disabled-Gemini
   explanation text 7.47:1 — all comfortably clear of the 4.5:1 text threshold.
5. **Secrets absence.** Rendered DOM (`outerHTML`) tested against an API-key-shaped
   pattern, a `GEMINI_API_KEY=` pattern and a bare `gemini_api_key` mention — zero
   matches. `read_network_requests` across the whole flow (load → submit → run page →
   history) showed only same-origin Next.js requests (the form POST, static chunks,
   fonts) — no client-originated Gemini call, ever. `read_console_messages` showed zero
   errors/warnings and no accidental logging of env or provider config the entire
   session.

**Not verified:** an actual live Gemini API call (no credential — separate protected
gate, unchanged from before) and real device emulation (iframe technique proves the
CSS breakpoints fire, not touch/UA/DPR — same caveat prior slices carried).

**Both Phase B gates are now closed.** What remains before Phase B can be called
complete: live Gemini credential verification (separate protected step) and committing
this uncommitted work (confirm with the owner first — see "Where you are" above).

**After the Phase B gates: change requests against an approved requirement.** Slice 6C
shipped export and Phase B implements the Gemini adapter, so the loop runs source →
analysis → review → traceability → document. The next product gap is:

1. **Change requests against an approved requirement.** An answered question routinely
   implies a requirement should change, and the Answer tab says so — *"This answer may
   require a requirement change."* next to a **disabled** *Create change request — Coming
   next*. `approved` and `rejected` are terminal (C.5), so reopening one must be a **new
   object with its own audit trail**, not a status flip that erases the record of what was
   approved. Start from: what does a change request reference (the approved item, the
   answer that motivated it), who approves it, and does approving it supersede the
   original or amend it?

Both workflows follow one shape, and a further one should too: a **narrow RPC** whose signature
omits everything a client must not choose, a **contract** that refuses forged fields
outright, a **service** that turns refusals into sentences, and a **runtime script** that
proves the database refuses at all. Slice 5 lives in `lib/contracts/review.ts` +
`lib/review/{service,history}.ts`; slice 6A in `lib/contracts/workflow.ts` +
`lib/review/workflow-service.ts`, with the UI in
`_components/{workflow-actions,workflow-tab}.tsx`; slice 6B in
`lib/contracts/relations.ts` + `lib/traceability/*`, with the UI at
`app/workspace/projects/[projectId]/traceability/`.

**Notes tab: still deliberately absent.** There is no note that is not either a change
reason (on a version) or a review comment (on an activity), so a Notes tab would either
duplicate History or promise a data model that does not exist.

**Slice 6C shipped the export and the printable handoff.** **No migration** — export derives
everything from existing tables and writes nothing, which is also why repeating it is free.
**Self-contained slice handoff:
[`docs/handoff/SLICE-6C-EXPORT.md`](docs/handoff/SLICE-6C-EXPORT.md)** — read that to pick up
export work without reading this whole file; architecture in
[`docs/architecture/EXPORT.md`](docs/architecture/EXPORT.md). The parts worth knowing before
touching it:

- **Routes:** `/workspace/projects/:id/exports` (scope · readiness · preview),
  `…/exports/preview` (full width), `…/exports/print` (browser print / Save as PDF), and
  `…/exports/download/:format` for six files — `markdown`, `json`, `requirements-csv`,
  `questions-csv`, `findings-csv`, `traceability-csv`.
- **Contract `reqwise-export/1.0`** in `lib/contracts/export.ts`, `strictObject` throughout.
  Items are referenced by **display id**, never row UUID; the only UUIDs that appear are the
  project, the cited source revision and the analysis run. `actor_id`, `created_by`,
  `resolved_by`, `organization_id`, `provider_key`, `raw_provider_output` and
  `validated_output` are absent, and a runtime check greps all six formats to prove it.
- **The scope lives in the URL** (`lib/export/url.ts`), so refresh, links, the printable page
  and every download share one scope with no table and no migration. Five presets
  (`portfolio_demo` is the demo one) resolve to an explicit scope *before* the builder runs —
  no rule anywhere reads a preset name.
- **Status scope applies to requirements only.** A question's status is always `draft`, so
  filtering questions by status would empty an approved-only export of every question.
- **Coverage is project-wide, never scope-wide**, and the document says so. The
  archived-project notice is **not** optional.
- **A citation whose offsets no longer match the excerpt blocks the export** (409 on the
  download route), and the error names display ids, never text. Unanswered questions are a
  **warning** — an export exists for the handoff conversation, so it must not be withheld
  until that conversation has happened.
- **CSV formula injection** is neutralised with a leading apostrophe (visible, reversible)
  rather than by stripping characters out of a requirement's words.
- **Printing** is CSS, not a second layout: `.screen-only` hides the shell, the shell's
  viewport height clamp is released, A4 with 16/14 mm margins, `break-inside: avoid` per
  requirement block, page break per section, black on white.
- **Ordering is a feature:** display-id prefix → number (so `FR-2` before `FR-10`) →
  `created_at` → row id. Markdown, JSON and CSV list the same items in the same order, and a
  test shuffles the input to prove the output does not move.
- **Golden fixtures** live at `tests/export/__golden__/` as vitest file snapshots.
  Regenerate deliberately with `npx vitest run tests/export -u` **after reading the diff**.
- One repo-wide mechanical change came with this slice: value imports on the export chain
  (16 files, including `lib/contracts/{review,workflow}.ts`, `lib/review/history.ts` and
  `lib/traceability/*`) now carry an explicit `.ts` extension, which is what lets
  `scripts/verify-export.mts` run the real export code under Node's native type stripping —
  the convention `tsconfig.json` already documents.

**Slice 6B shipped typed relations and the traceability graph.** Every edge used to be
`derives_from` — not a claim about the relationship but the absence of one. Two migrations
(`…18` labels, `…19` everything that uses them), both applied; they are split because
Postgres refuses to use a new enum label in the transaction that added it.

- **Nine authored types**, each with one direction only: `supports`, `implemented_by`,
  `expressed_as`, `validated_by` (the spine), `constrained_by`, `raises_question`,
  `flags_quality_issue`, `mitigates` (observations about it) and `related_to` (the
  any→any fallback). `derives_from` is **legacy-only** — it still loads and still says
  what it says, and a new run may not write it.
- **The pair matrix is a function**, `is_allowed_relation_pair()`, not a thirteenth table
  — mirrored by `ALLOWED_RELATION_PAIRS` in `lib/contracts/relations.ts`. When one
  changes, the other must. Reasoning in DATA-MODEL §C.13.
- **The database refuses**, not just the UI: an illegal pair, a self-relation, a
  duplicate, a cross-project edge, a write into an archived project, and a **cycle over
  the spine** (deferred, so a multi-edge insert is judged on its finished shape). One bad
  relation rolls the whole run back.
- **The 192 legacy rows are untouched.** Direction is *recorded*
  (`HIERARCHY_DIRECTION`) rather than assumed, so both conventions coexist and
  `canonicalHierarchyEdge()` normalises them before any matrix row or cycle is read. A
  pre-existing cycle shows up as a coverage indicator for a human, never a silent repair.
- **The page** is `/workspace/projects/<id>/traceability`: Coverage · Matrix · Map ·
  Inspector, with search, type/status/priority/run filters and *only rows with a gap*.
  Coverage is **derived, never stored**, and carries *"Coverage indicators assist review
  and do not replace human judgment."* The Inspector reads each edge as a sentence — *"is
  implemented by FR-005"*, *"has a quality issue flagged by QF-005"* — in TH and EN.
- `npm run verify:traceability` → 22/22, including that RLS (not an application filter)
  hides another user's relations and that the boundary holds against the service role.

**Slice 6A shipped the two deferred workflows.** Open questions and quality findings are
no longer read-only. Three migrations (`…15`, `…16`, `…17`), all applied.

- **A question** moves `open → answered / deferred / not_applicable`, and back to `open`
  with a reason. **A finding** moves `open → acknowledged / resolved / dismissed`, and
  back. `acknowledged` explicitly means *seen, not fixed*.
- **No thirteenth table.** Five columns on `analysis_items` (`workflow_state`,
  `resolution_text`, `resolved_at`, `resolved_by`, `follow_up_on`) plus two on
  `review_activities`. The reasoning is written out in DATA-MODEL §C.12 — read it before
  proposing a side table.
- **A CHECK keyed on `item_type`** makes the impossible states unrepresentable: a
  requirement's `workflow_state` must be NULL, a question can never be `resolved`, a
  finding can never be `answered`.
- **Every decision carries words**, `acknowledged` excepted. Blankness is `blank_to_null()`.
- **No silent requirement mutation.** Answering or resolving touches no requirement, no
  source reference and no analysis run. Where an answer implies a change, the UI says so
  and offers a **disabled** *Create change request — Coming next*.
- **Domain-profile questions get no highlight** and say *"Generated from domain guidance;
  no direct source evidence."* — never a plausible-looking sentence.
- The centre panel is now **three tabs**: Requirements · Open questions · Quality findings.

**Slice 5 shipped the human-in-the-loop workflow.** Open a run → select an item → edit it
→ save a new version → mark reviewed / needs clarification → approve or reject → read the
version history and the review timeline. Two migrations (`20260725000013`, `…14`), both
applied. The rules that matter, all enforced in the database rather than only in the UI:

- **A review does not survive a material edit.** Editing a `reviewed` or
  `needs_clarification` item resets it to `draft` and appends an `edit` activity — in the
  same transaction as the content write and the version snapshot, inside
  `guard_item_update()`, so it holds on every path and not just the app's.
- **`approved` and `rejected` are terminal.** Three edges the Phase 3A table allowed were
  withdrawn (`approved → implemented`, `approved → needs_clarification`,
  `rejected → draft`). The `implemented` enum label survives but is unreachable.
- **Identity and evidence are pinned.** `item_type`, `display_id`, `provider_key`,
  `analysis_run_id`, `evidence_class`, `origin`, `confidence`, `rationale` and
  `created_at` cannot change at all, for any role, on any path.
- **Optimistic concurrency** on both operations (`expectedVersion` / `expectedStatus`).
- **`open_question` and `quality_finding` are excluded** from this workflow in the UI, the
  service *and* the RPC boundary — they have their own, added in slice 6A above.

**Slice 4.2 shipped the interface direction.** The owner supplied a *Final Interface
Direction — Three-Panel Requirements Workspace* plus a rendered reference; both are now
tracked at `docs/design/INTERFACE.md` and `docs/design/preview-2.png`. That direction
**contradicted `CLAUDE.md`'s old "dark graphite or deep navy foundation"** wording, so
`CLAUDE.md` → "Design direction" was rewritten to the light Apple-inspired productivity
foundation and explicitly marked as superseding the dark one. Do not revive it.

Three scoping decisions the owner made, worth not re-litigating:
1. **Layout only.** No review actions, no server action, no migration in 4.2.
2. **Real data only.** The reference image shows a Quality Score, a coverage %, sparklines
   and a ⌘K palette. None of them have backing data, so **none were built** — inventing a
   metric to fill a mockup violates `CLAUDE.md`. Everything in the summary bar and the
   group headers is derived from real rows: item counts, average confidence, cited share,
   open questions, risks, quality findings.
3. **Full-height app frame.** The workspace route fills the viewport with independently
   scrolling panels; every other page keeps its centred layout.

Slice 4 shipped: the "Analyze requirements" confirmation flow on the source detail page,
`persist_analysis_result()` (a SECURITY DEFINER RPC — no service role in the request
path), the read-only Analysis Result split-view workspace, and idempotent submission.
Slice 4.1 then made the mock **input-aware** and replaced the implicit display-id
allocation with reserved ranges. `lib/analysis/{input,persist,queries,highlight,
production-ports}.ts` plus `lib/analysis/run-analysis.ts` are the layer to build review
actions against; `getAnalysisRun` in `lib/analysis/queries.ts` already loads everything a
review screen would need per item.

**How the mock behaves now (slice 4.1):** it analyses whatever text it is given.
Generation rules live in `lib/providers/mock/runtime/` — `segments.ts` (offsets),
`lexicon.ts` (bilingual TH/EN concepts + profile-derived vocabulary), `strategy.ts`
(item shaping). Ordinary meeting notes typed into the browser produce a valid run with
exact citations. The 14-type fixture in `lib/providers/mock/fixtures/` is now **test-only**
— schema, evidence, relation and normalization suites — and is unreachable at runtime.

**Known limitations to know about before touching this area:**
- The runtime mock is **rule-based, not a model**. It recognises a fixed concept list
  (booking, staff, customer, payment, cancellation, refund, notification, check-in,
  reporting, plus "unresolved" and "obligation" markers) in Thai and English, and takes
  the rest of its guidance from the domain profile row. Text in another language, or
  about a concept outside that list, still produces a valid analysis, but the
  requirements it extracts will be generic — it falls back to "first stated obligation"
  rather than understanding the sentence.
- `related_item_keys` carries no relation kind in the AI output contract, so every edge
  it produces is persisted as `item_relations.relation_type = 'derives_from'`, regardless
  of the real relationship (e.g. an acceptance criterion "verifying" a user story is also
  recorded as `derives_from`). Fine for traceability navigation today; would need either
  a provider-supplied relation kind or a lookup table if the UI ever needs to *say* what
  kind of link it is.
- Several Phase 2 pure-core files (`lib/analysis/run-analysis.ts`,
  `lib/validation/*.ts`, `lib/normalization/*.ts`, `lib/providers/mock/**`,
  `lib/contracts/{provider-output,item-types,normalized}.ts`) now have explicit `.ts`
  extensions on their relative value-imports, extending the pattern
  `lib/domain/load-profile.ts` started — required so `scripts/verify-analysis.mts` can
  run the real pipeline under Node's native TypeScript stripping. Purely mechanical;
  Next's bundler resolves both forms identically, and `npm test`/`build` are unaffected.

**Display ids since 4.1:** `persist_analysis_result()` reserves a *range* per
`(project, prefix)` through `allocate_display_number_range()`, under a transaction-scoped
advisory lock, allocating prefixes in sorted order so concurrent runs cannot deadlock.
`next_display_id()` still exists for single-id callers but reserves nothing, which is why
the persistence path no longer uses it. Gaps are correct; the invariant is that no two
*committed* items in a project share a display id. See DATA-MODEL.md §C.10.

**The database is real.** A hosted Supabase project is linked (`rgfwtflsvnlgfiuoxowm`),
all 19 migrations are applied, and the seed is loaded. `.env.local` holds the keys and is
gitignored — never commit it.

```bash
npm run dev                  # http://localhost:3000
npm run verify:db            # 8/8 schema checks (slice 1, check 3 updated in slice 3)
npm run verify:projects      # 10/10 project lifecycle checks (slice 2)
npm run verify:sources       # 18/18 source, lock and revision checks (slice 3)
npm run verify:analysis      # 25/25 analysis, allocation and idempotency checks (4 + 4.1)
npm run verify:review        # 30/30 editing, review, versioning and concurrency (slice 5)
npm run verify:workflow      # 32/32 question resolution and quality workflow (slice 6A)
npm run verify:traceability  # 22/22 typed relations, pair matrix, cycles, coverage (6B)
npm run verify:export        # 26/26 export scope, evidence, formats and leakage (6C)
npm run seed:profiles        # regenerate supabase/seed.sql from the TS profiles
npx supabase db push         # apply new migrations (needs SUPABASE_ACCESS_TOKEN)
```

## Auth — development notes

- Supabase **rejects reserved domains such as `@example.com` on public sign-up**
  ("Email address is invalid"). Use a real address when testing the UI. Do **not** relax
  the validation to accommodate a fake one — the rule is the provider's, and weakening
  anything on our side to work around it would ship to production.
- The **admin API accepts them**, which is how the verification scripts create their
  throwaway users. That path is service-role and stays server-side.
- The **service-role key must never reach the browser** — no `NEXT_PUBLIC_` prefix, no
  client component import. `lib/supabase/admin.ts` throws if it is constructed in a
  browser, and it does not appear anywhere in the project request path.
- A dev account exists: `slice1-demo@example.com` (password not recorded here — reset it
  in the Supabase dashboard if needed), owning one demo project.
- Slice 3 added a second: `slice3.demo@reqwise.dev` / `Slice3Demo!2026`, owning the
  project *Smart Space intake — slice 3* with two revisions of one document (revision 1
  locked by an analysis run, revision 2 editable). Slice 4.1 added the source
  *ประชุมเก็บความต้องการระบบจองห้องประชุม* to it, **typed into the browser form**, with two
  analysis runs over it. That is the demo to open: any ordinary notes now analyse, so the
  earlier "matches mock fixture" source is no longer special.
- The stray account `tanawittam@gmail.com`, created accidentally during slice-3 browser
  verification, was identified, audited and removed on 2026-07-24. No longer present.

### Browser demo input, and what it should produce

```text
ลูกค้าต้องการจองห้องประชุมผ่านเว็บไซต์ โดยเลือกสาขา ห้อง วันที่ และเวลาได้
พนักงานต้องเห็นรายการจองและตรวจสอบลูกค้าที่มาเช็กอิน
ยังไม่ได้ข้อสรุปเรื่องการยกเลิก การคืนเงิน และช่องทางแจ้งเตือน
```

18 items: a booking business requirement citing line 1, a staff functional requirement
citing line 2, both customer and staff stakeholders, and — the part that matters —
cancellation, refund and notification appearing as **open questions citing line 3**,
never as requirements. Payment and customer identity arrive as profile-raised questions
with no citation at all.

### Housekeeping — verification rows have accumulated

As of 2026-07-26 the linked project holds **152 accounts (150 throwaway + 2 real)**, 227
projects, 185 analysis runs, 1,423 analysis items and 357 relations — slice 6B's 22 checks
run a full user/project pair each. Almost all of it is residue from
`verify:*` runs, which create a fresh user pair and project set every time and cannot
clean up after themselves — the immutability triggers refuse DELETE even for the service
role, which is the schema working as designed.

Harmless, but worth clearing before a demo so the dashboards read honestly. **Dry run
first** — slice 6C added one, and it is not optional courtesy: the cleanup script disables
immutability triggers and cascades across seven tables, and until now the only way to see
what it matched was to run it.

```bash
npx supabase db query --linked -f scripts/verify-db-cleanup-dryrun.sql   # reports, deletes nothing
npx supabase db query --linked -f scripts/verify-db-cleanup.sql          # the real thing
```

**Dry run as of 2026-07-26** (nothing was executed): would delete 184 accounts, 276
projects, 232 source documents, 221 analysis runs, 1,628 items, 825 source references, 451
relations, 65 versions, 311 activities and 184 orphaned personal organizations. `preserved`
is exactly the two demo accounts and their four projects — which is the line to check every
time. Slice 6C also fixed the patterns: slices 5, 6A, 6B and 6C named fixtures the cleanup
script had never heard of, which is most of why the residue grew this far.

It matches only the verification naming patterns (`reqwise-verify-*`, `reqwise-src-*`,
`reqwise-analysis-*`, and the `Slice N …` project names) and leaves the two real demo
accounts and their projects untouched.

**One leftover it will not catch:** `slice3.demo@reqwise.dev` owns a hand-made project
*"Archived traceability check — slice 6B"* (17 requirements, `status = active` despite the
name) from the slice-6B browser check. It is inside a real demo account, so the cleanup
script deliberately leaves it alone — archive or remove it by hand before a demo, and do
not widen the script's patterns to reach into demo accounts.

## Verbatim text — one caveat worth knowing

Browsers submit `<textarea>` newlines as **CRLF**, per the HTML spec. Text typed with LF
therefore arrives at the server as CRLF and is stored that way. The server never rewrites
it in either direction, and every offset is measured against the *stored* text, so
`rawText.substring(start, end)` holds. Do not "fix" this by normalising on write — that
would be an intentional edit of evidence, and it would move every offset after the first
newline.

The definition that keeps this coherent, in one line:

> **server-received text = database-stored text = the text offsets are validated against**

Since slice 4.1 the provider is on the same side of that equality: it segments the text
handed to it on the analysis input — which `buildAnalysisInput` read from the database —
and every citation offset it emits indexes into that exact string. Three lines typed in
the browser arrive as 192 characters, not 190, and both the citation and the highlight
agree with the 192. `lib/providers/mock/runtime/segments.ts` handles CRLF, LF and lone
CR without rewriting any of them, and never locates an excerpt with `indexOf` — each
segment carries its own offsets, so a document containing the same sentence twice cites
the occurrence that was actually chosen.

---

## What this is

An AI-assisted requirements analysis **platform**. Unstructured business input →
validated, traceable, human-reviewable software requirements. Multi-domain, with Booking
and Smart Space as the demonstration domain.

Built as a Business Analyst / System Analyst portfolio piece.

Full product spec: `CLAUDE.md` — read it first, it is the source of truth.

## ⚠️ Scope changed on 2026-07-24

The owner supplied a full product specification, now merged into `CLAUDE.md`. It is
**materially larger** than the originally approved plan
(`C:\Users\User\.claude\plans\reqwise-ai-magical-micali.md`), which is now **stale** —
do not execute it as written.

| | Original plan | Current spec |
|---|---|---|
| Outputs | 8 artifacts | 15 artifacts |
| Entities | 3 tables | 17 entities |
| Domains | single | domain-profile layer, 3 profiles |
| Review | none — read-only output | full human review, approval workflow, versioning |
| Traceability | IDs only | goal → BR → FR → US → AC → test relations |
| Multi-tenancy | none | Organization entity |
| AI provider | Gemini, direct | provider adapter + deterministic mock |
| Testing | build + lint | unit + integration + e2e |
| Validation | none | Zod on all model output |
| Export | Markdown | Markdown, JSON, CSV, printable |

**Consequences to accept before building:** the Architecture Gate (Phase 1) must be
re-run against the new spec; `Zod` is now an approved dependency (the spec names it) plus
a test runner and an e2e runner; `Organization` implies multi-tenant RLS from day one,
which is much harder to retrofit than to design in.

**Recommendation:** re-plan Phase 1–4 against the new spec, and build the demonstration
domain (Booking and Smart Space) as the *first and only* domain profile until the
end-to-end slice works. The domain-profile layer earns its keep at profile #2, not #1 —
but the seam must exist from the start so the engine never learns domain facts.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Shape | Standalone Next.js app at `ReqWiseAI/` | Not a page inside the Portfolio site — keeps the Portfolio deploy untouched |
| LLM | Server-side **provider adapter**; Gemini is configurable, plus a deterministic mock for local/tests | The adapter is implemented without exposing credentials to components; live-provider verification remains a separate protected gate |
| Auth + DB | Supabase (Postgres + RLS) | Relational schema (project → source → analysis) shows BA data modelling; `SUPABASE_SETUP.md` at repo root has the RLS pattern |
| Language | TH/EN toggle on both UI and model output | Thai input → English requirements is the real BA skill being demonstrated |
| Team | Existing roster — no new role card | ArchitectTam → Noey + DataTam → DevBAmooTam → Meejai |

## Status

- [x] **Phase 0 — Scaffold.** `create-next-app` (Next 16.2.11, React 19.2.4, Tailwind 4,
      TS, App Router, Turbopack, ESLint) + `@supabase/supabase-js` and `@supabase/ssr`.
      `CLAUDE.md` and this file written. App is still the stock Next.js starter page.
- [x] **Spec merged (2026-07-24).** Owner's full product specification folded into
      `CLAUDE.md`. Scope grew — see the table above. No code written against it yet.
- [x] **Phase 1 — Architecture Gate. Package written 2026-07-24, awaiting approval.**
      `docs/architecture/ARCHITECTURE.md` (scope · layers · slice sequence) ·
      `DATA-MODEL.md` (12 tables · immutability · versioning · RLS) ·
      `AI-OUTPUT-CONTRACT.md` (validated output · evidence · mock provider).
      Documentation only — no feature code, no migration, no dependency, no Supabase
      connection. **3 open decisions listed at the end of ARCHITECTURE.md need a yes
      before Phase 2.**
- [x] **Phase 2 — Analysis contracts + deterministic mock (2026-07-24).** Pure,
      DB-free foundation: provider output → strict Zod validation → evidence/citation/
      relation checks → normalization → deterministic mock. `lib/contracts`,
      `lib/validation`, `lib/normalization`, `lib/providers`, `lib/domain`,
      `lib/analysis`, plus `tests/`. **57 tests pass · typecheck · lint · build all
      clean.** Added deps: `zod` (runtime), `vitest` + `@vitest/coverage-v8` (dev).
      No DB, no Supabase, no auth, no UI, no API route, no commit.
- [x] **Phase 3A — Database schema, constraints, RLS, workspace bootstrap
      (2026-07-24). COMMITTED `595a62f` · APPLIED · VERIFIED AT RUNTIME.**
      `supabase/migrations/` (6 ordered files) + generated `seed.sql` + `config.toml` +
      `README.md` + `.env.example`. 12 tables, immutability triggers, auto-versioning,
      `review_item()`, DB-backed display-id allocator, membership-based RLS,
      `handle_new_user` bootstrap. Applied to the hosted project with
      `supabase db push`; seed applied with `supabase db query -f`.
      **`npm run verify:db` → 8/8 PASS** (see "Runtime verification" below).
- [x] **Domain-profile source of truth — RESOLVED (2026-07-24).** Authored in
      `lib/domain/profiles/*.ts` → `supabase/seed.sql` **generated** by
      `npm run seed:profiles` (`scripts/generate-profile-seed.mts`, Node native TS
      stripping, no new dependency) → the app loads content **from the database** via
      `lib/domain/load-profile.ts`, validated by `domainProfileSchema`
      (`lib/domain/profile-schema.ts`). `tests/domain/seed-sync.test.ts` fails the build
      if the seed drifts from the TypeScript. Never hand-edit `seed.sql`.
- [x] **Phase 3B — Supabase clients + auth slice (2026-07-24). COMMITTED `bf148b3` ·
      VERIFIED IN THE BROWSER.** `lib/supabase/{env,client,server,admin}.ts`, `proxy.ts`
      (session refresh + route protection — Next 16 deprecated `middleware.ts`), auth
      Server Actions, sign-in / sign-up pages, and a `/workspace` shell that renders the
      organization the bootstrap trigger created. 61 tests · typecheck · lint · build
      clean.
- [x] **Slice 2 — Project creation, list and archive lifecycle (2026-07-24). VERIFIED
      AT RUNTIME (10/10) AND IN THE BROWSER.** Migration
      `20260724000007_project_lifecycle.sql` adds the project intake fields
      (`output_lang`, `business_objective`, `known_stakeholders`) and the archive
      lifecycle (`status`, `archived_at`, `archived_by`, `archive_reason`), a
      `guard_project_update` trigger that pins organization / creator / domain profile /
      created_at and makes an archived project read-only, and
      `archive_project()` / `restore_project()` as the only status path.
      `/workspace/projects`, `/new` and `/[projectId]` are the UI;
      `lib/contracts/project.ts` + `lib/projects/` are the logic.
- [x] **Slice 3 — Source documents, editing, locking and revisions (2026-07-24). VERIFIED
      AT RUNTIME (18/18) AND IN THE BROWSER.** Migration
      `20260724000008_source_revisions.sql` turns `source_documents` into revisioned
      evidence (`document_key`, `revision_number`, `supersedes_source_document_id`,
      `metadata`, `updated_at`), replaces the blanket no-UPDATE trigger with
      `guard_source_document_update` (frozen once cited, identity columns pinned,
      archived project refused), adds `guard_source_document_insert` (chain integrity +
      archived project), the derived `source_document_is_locked()` /
      `project_is_active()` helpers, and a source UPDATE policy;
      `20260724000009` adds the `operational_notes` enum value.
      `/…/sources`, `/sources/new`, `/sources/[sourceId]` and `/edit` are the UI;
      `lib/contracts/source.ts` + `lib/sources/` + `lib/projects/guards.ts` are the logic.
- [x] **Slice 4.2 — Three-panel Analysis Workspace (2026-07-25). VERIFIED IN THE BROWSER
      AT 1920 / 1180 / 834 / 390 px.** No migration, no query change, no new dependency —
      presentation and pure view logic only. New pure module `lib/analysis/workspace-view.ts`
      (partition · group · filter · stats, DB-free and React-free, 19 tests) and an
      extended `lib/analysis/highlight.ts` (`findMatchRanges` + `buildSourceSegments`, where
      a citation always wins over a search match and the concatenated runs still reproduce
      the source byte for byte). The 243-line `workspace.tsx` became a client shell plus
      `_components/{summary-bar,source-panel,requirements-panel,requirement-row,inspector,
      panel,labels}`. Shell: `app/workspace/layout.tsx` claims full height, the sidebar
      carries the direction's 9 navigation entries (only Workspace and Projects `ready`),
      the toolbar gained *Analysis* and *Source* breadcrumbs. **233 tests · typecheck ·
      lint · build · `verify:analysis` 25/25 all clean.**
- [x] **Slice 5 — Requirement editing, human review, approval, version history
      (2026-07-25). VERIFIED AT RUNTIME (30/30) AND IN THE BROWSER.** Migrations
      `20260725000013_item_editing_and_review.sql` (reviewable types, tightened
      transitions, rewritten `guard_item_update()`, `edit_analysis_item()`, replaced
      `review_item()`) and `20260725000014_conflict_error_code.sql` (`PT409` instead of
      `serialization_failure`). `lib/contracts/review.ts` + `lib/review/{service,history}.ts`
      are the logic; the run route's `actions.ts` / `form-state.ts` and the inspector's
      `_components/{item-edit-form,review-actions,history-panel}.tsx` are the UI.
      **297 tests · typecheck · lint · build clean; all five runtime scripts green
      (8/8 · 10/10 · 18/18 · 25/25 · 30/30).**
- [x] **Slice 6A — Open-question resolution and quality-finding workflow (2026-07-25).
      VERIFIED AT RUNTIME (32/32) AND IN THE BROWSER.** Migrations `…15` (activity-type
      enum labels, alone by necessity), `…16` (`item_workflow_state`, five workflow
      columns with type-keyed CHECKs, two columns on `review_activities`, the transition
      functions, `resolve_open_question()` and `update_quality_finding()`) and `…17`
      (`blank_to_null()`). `lib/contracts/workflow.ts` +
      `lib/review/workflow-service.ts` are the logic; the centre panel gained a third
      tab and the inspector an Answer / Resolution tab.
      **351 tests · typecheck · lint · build clean; all six runtime scripts green
      (8/8 · 10/10 · 18/18 · 25/25 · 30/30 · 32/32).** No thirteenth table — see
      DATA-MODEL §C.12 for why.
- [x] **Slice 6B — Typed traceability relations and the traceability graph (2026-07-26).
      COMMITTED `f5b5bf7` · VERIFIED AT RUNTIME (22/22) AND IN THE BROWSER.** Migrations
      `20260726000018_relation_types.sql` (nine enum labels, alone by necessity — Postgres
      refuses to use a new label in the transaction that added it) and
      `…19_typed_traceability.sql` (`relation_is_hierarchical()`,
      `is_allowed_relation_pair()`, the pair / boundary / archived / deferred-cycle
      triggers, and `persist_analysis_result()` taking typed relations).
      `lib/contracts/relations.ts` + `lib/traceability/{graph,matrix,map,coverage,filters,
      queries,labels,types}.ts` are the logic; `/…/traceability` with Coverage · Matrix ·
      Map · Inspector is the UI. `derives_from` becomes legacy-only and the 192 existing
      rows keep it. **439 tests · typecheck · lint · build clean; all seven runtime scripts
      green (8/8 · 10/10 · 18/18 · 25/25 · 30/30 · 32/32 · 22/22).** Pair matrix as a
      function, not a thirteenth table — see DATA-MODEL §C.13 for why.
- [x] **Slice 6C — Requirements export and printable handoff (2026-07-26). VERIFIED AT
      RUNTIME (26/26) AND IN THE BROWSER. No migration.** `lib/contracts/export.ts`
      (`reqwise-export/1.0`) + `lib/export/{load,build,readiness,markdown,json,csv,print,
      url,labels,filenames,types}.ts`; four routes under
      `app/workspace/projects/[projectId]/exports/` including a six-format download handler
      and a printable page; print rules in `app/globals.css`. Export reads and writes
      nothing, which is why no migration was needed. **637 tests · typecheck · lint · build
      clean; all eight runtime scripts green (8/8 · 10/10 · 18/18 · 25/25 · 30/30 · 32/32 ·
      22/22 · 26/26).** Architecture in `docs/architecture/EXPORT.md`.
- [ ] **Phase 3C+ — remaining vertical slices.** run mock analysis (persist run + items +
      refs in one transaction) → workspace split-pane → edit item → review/approve →
      export. Slice order in `docs/architecture/ARCHITECTURE.md` §E.
- [ ] **Phase 4 — Review & QA → deploy.** Vercel deploy is a protected action; needs
      explicit approval and env vars set in the dashboard, never committed.

## Environment

`.env.example` is tracked (`.gitignore` has `!.env.example`); the real `.env.local`
exists on this machine, is gitignored, and holds live keys:

```
NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY   # browser-safe, RLS applies
SUPABASE_SERVICE_ROLE_KEY              # server only — never NEXT_PUBLIC_
SUPABASE_ACCESS_TOKEN / _PROJECT_REF   # supabase CLI only, not read by the app
AI_PROVIDER=mock                       # mock | gemini
GEMINI_API_KEY=                        # server only
GEMINI_MODEL=                          # first configured model
GEMINI_FALLBACK_MODELS=                # optional ordered comma-separated fallbacks
```

The hosted Supabase project is **live and linked** (ref `rgfwtflsvnlgfiuoxowm`). No
Docker is needed: `supabase link` + `supabase db push` work against the remote, and
`supabase db query --linked -f <file>` runs a SQL file. The CLI reads
`SUPABASE_ACCESS_TOKEN` from the environment, which npm scripts do **not** load from
`.env.local` — export it first (`set -a; . ./.env.local; set +a`).

## Runtime verification (2026-07-24) — 8/8 PASS

`npm run verify:db` (`scripts/verify-db.mts`) creates two real users through the admin
API and asserts, against the live database:

| # | Check | Result |
|---|---|---|
| 0 | Seeded profile loads through `loadDomainProfileByKey` and validates | 4 terms, 8 workflows |
| 1 | Sign-up bootstraps exactly one personal org + owner membership + profile | PASS |
| 2 | Tenant isolation — user B sees 0 rows, cross-tenant insert refused | PASS |
| 3 | `source_documents` / `analysis_runs` reject UPDATE, **service role included** | PASS |
| 4 | Insert with `status='approved'` refused; direct status UPDATE refused | PASS |
| 5 | Editing an item snapshots the OLD state and bumps `version_no` | PASS |
| 6 | `review_item()` audits every transition; `approved → draft` refused | PASS |
| 7 | Display ids allocate per project and per type (BR-002 → BR-003, US-001) | PASS |

Slice-1 UI, verified in the browser against the same database: signed-out `/workspace`
→ `307 /sign-in?next=%2Fworkspace`; sign-in → workspace showing
"Tanawit's workspace · owner · personal"; sign-out → back to `/sign-in`, route protected
again.

## Runtime verification (2026-07-24) — slice 2, 10/10 PASS

`npm run verify:projects` (`scripts/verify-projects.mts`), same shape, two fresh users:

| # | Check | Result |
|---|---|---|
| 1 | A user creates a project in their own personal workspace | PASS |
| 2 | Creating in another user's organization is refused by RLS | PASS |
| 3 | User B sees user A's project neither by list nor by direct id | PASS |
| 4 | A project is born `active`; a direct status UPDATE is refused | PASS |
| 5 | `archive_project()` records `archived_at` + `archived_by` from the JWT | PASS |
| 6 | An archived project keeps every field and refuses edits | PASS |
| 7 | Only an owner restores; restore clears all archive metadata | PASS |
| 8 | A project cannot be hard-deleted (no DELETE policy exists) | PASS |
| 9 | A built-in domain profile is readable, not writable | PASS |
| 10 | organization / creator / domain profile are immutable; rename still works | PASS |

Slice-2 UI, verified in the browser against the same database: sign in → empty state →
create (name trimmed, 3 stakeholders parsed from a textarea, blank line dropped) →
redirect to the overview → archive with a reason → project leaves the Active list
(`0 active · 1 archived`) → Archived filter shows it → read-only banner with the reason →
restore → banner gone and the next-step block returns → sign out → `/workspace`,
`/workspace/projects` and `/workspace/projects/new` all `307` to `/sign-in` with `next`
preserved. A whitespace-only name was rejected with a field-level message and created no
row (`select count(*) from projects` stayed 0).

Cleanup: verification rows **cannot** be deleted through the API — the immutability
triggers refuse DELETE for the service role too, and a `projects` cascade hits them. Use
`npx supabase db query --linked -f scripts/verify-db-cleanup.sql`, which disables the
user triggers for the duration of the delete. That is a maintenance operation the
application can never perform.

## Runtime verification (2026-07-24) — slice 3, 18/18 PASS

`npm run verify:sources` (`scripts/verify-sources.mts`), same shape, two fresh users. The
analysis run that locks a revision is created by the script itself, through the ordinary
user-scoped RLS path — no application backdoor was added to make locking testable.

| # | Check | Result |
|---|---|---|
| 1 | A user adds a source to their own active project | PASS |
| 2 | A first source is revision 1; a forged `revision_number` is refused | PASS |
| 3 | Raw text round-trips character for character; offsets survive | PASS |
| 4 | User B sees user A's source neither by list nor by direct id | PASS |
| 5 | User B cannot add a source to user A's project | PASS |
| 6 | An unanalysed source is edited in place and stays revision 1 | PASS |
| 7 | An archived project refuses a new source | PASS |
| 8 | An archived project refuses an edit to an existing source | PASS |
| 9 | An analysis run locks the revision it references | PASS |
| 10 | A locked revision refuses every edit — text, title and metadata | PASS |
| 11 | No source can be hard-deleted; the trigger refuses the service role too | PASS |
| 12 | Revision 2 can be created from a locked revision 1 | PASS |
| 13 | Revision 2 cites revision 1, keeps `document_key`; skipping numbers is refused | PASS |
| 14 | A revision cannot cross projects | PASS |
| 15 | A duplicate revision number is refused | PASS |
| 16 | The original run still cites revision 1; revision 1 is unchanged | PASS |
| 17 | User B cannot create a revision of user A's source | PASS |
| 18 | Cross-organization insert and a forged `created_by` are both refused | PASS |

`verify:db` check 3 was **rewritten**, not relaxed: it used to assert that
`source_documents` refuses every UPDATE, which slice 3 deliberately changed. It now
asserts the narrower rule — an unanalysed source accepts a legitimate edit, and the same
row refuses one the moment a run cites it, for the owner and the service role alike.

Slice-3 UI, verified in the browser against the same database: sign in → create a project
→ add a source whose text carries leading spaces, a three-newline run, a tab, Thai and
English, and a trailing newline → redirect to the detail view → the text renders verbatim
under `white-space: pre-wrap` and `substring()` addressing still lands on the right words
→ the overview count moves to 1 and the Recent sources panel appears → edit in place (same
row, still revision 1) → lock the source with a run → the detail view switches to
"Analysed — locked", explains why, and offers *Create revision 2* → creating it writes a
new row (revision 2, editable, `Analysis runs 0`) while revision 1 keeps its text and
gains a "newer revision exists" link → archive the project → the banner appears with the
reason, Add source disappears, `/sources/new` refuses to render a form → **a form opened
while the project was still active and submitted after archiving was refused server-side
and wrote no row** → restore → actions return → sign out → all four source routes `307` to
`/sign-in` with `next` preserved.

## Runtime verification (2026-07-25) — slice 4.2 interface, 8/8 PASS

Checked in Chrome against the live database, signed in as the slice-3 demo user, on the
Thai meeting-notes run (`319805f1…`, 12 requirements + 3 issues, 13/15 cited).

1. **Three panels at 1920 px.** Source · Requirements · Inspector side by side, page
   scroll `[873, 873]` in both axes — the page itself never scrolls, each panel does.
2. **Selection drives the source.** Selecting a requirement highlights its exact excerpt,
   scrolls it into view, and the "Highlight n of m" counter with prev/next tracks it.
3. **Density.** Old card layout: 73–96 px per card, 1913 px of column for 18 items
   (≈106 px/item), 5 visible. New rows: **63 px**, group headers 36 px, **6–9 visible**
   depending on grouping. Measured by stashing only `workspace.tsx`, not estimated.
4. **Grouping.** Type / Source order / Review status / Priority all switch, groups collapse,
   headers carry count + `avg N%` + `n/m cited`. `scrollbar-gutter: stable` keeps the
   header stats off the scrollbar when the inspector collapses.
5. **Search, filters, tabs.** Both narrow the list and its count; the Issues tab holds
   exactly the open questions and quality findings — the three Thai notes (cancellation,
   refund, notification) are there and never appear as requirements. Slice 4.1 invariant
   intact.
6. **Inspector is non-modal.** Collapsing it widens the requirements panel; nothing is
   trapped behind an overlay.
7. **Responsive.** At **1180 px** the grid drops to two columns (298 / 634) and the
   inspector becomes a 380 px absolutely-positioned right drawer with a shadow, pinned to
   the viewport edge, no page scroll in either axis. At **834 px** and **390 px** a
   Source · Requirements · Inspector segmented control appears (44 px tall — the ≥44 px
   touch target), exactly one segment pressed at a time, the summary bar's inspector
   toggle correctly hides below `lg` so there is no duplicate control, and **the selected
   requirement (PS-002) survived every panel switch in both directions**. No horizontal
   scroll at any width.
8. **Keyboard only.** Tab to a row, activate with Enter/Space, step through highlights,
   toggle the inspector — focus visible throughout, no action needs a pointer.

⚠️ **Method note, so nobody is misled later:** the Chrome window was maximized and
`resize_window` was a no-op against it, so 1180 / 834 / 390 were tested by loading the
route into a **same-origin iframe** of that exact size. Media queries and `matchMedia`
resolve against the iframe viewport, so the breakpoints are genuinely exercised — but this
is not a device-emulation test: no touch input, no mobile UA, no device pixel ratio. If
mobile ever becomes a real target, re-test on a real device.

## Runtime verification (2026-07-26) — slice 6C export, 26/26 PASS

`npm run verify:export`, against the live database, on an authenticated user's own client.
Fixtures are named `Export verification …` / `reqwise-export-…@example.com` so the cleanup
script can find them, and every status in them arrived through `review_item()` and
`edit_analysis_item()` because `guard_item_update()` refuses a direct status write **even to
the service role** — so the fixture states are the states a reviewer would produce.

Building (1–4): user A exports their own project; user B gets `null`, indistinguishable from
a project that does not exist; an archived project exports read-only with its notice; and an
export changes **no row count in any of the seven tables it reads**.

Scope (5–8): approved-only admits no draft; reviewed-and-approved adds the reviewed item and
no draft; the active working set keeps drafts and excludes rejected; all-statuses includes
the rejected item, labelled *Rejected*.

Evidence (9–11): every citation's offsets still land exactly on the excerpt it quotes; a
domain-profile item carries the "no direct source evidence" sentence rather than a nearby
sentence; and a corrupted span turns the export into `cannot_export` with no source text in
the message.

Questions, findings, traceability (12–18): an answer exports with its date and is **not**
promoted into a requirement; a deferral carries its follow-up date; a resolved finding
carries its resolution and its own kind with **no severity anywhere**; typed relations read
as sentences in both directions; `derives_from` exports as legacy with its direction intact;
coverage matches the project under every scope; and no relation resolves outside the
document.

Formats (19–22): the JSON file satisfies the export schema; the Markdown carries all ten
required sections, includes the cited excerpt and does **not** reproduce the uncited source
line; CSV quoting survives Thai, quotes, commas and CRLF; a leading `=` or `-` is neutralised.

What must never leave (23–26): no raw or validated provider payload and no provider key in
any of the six formats; no auth user id, organization id or email — while the review summary
still reports *"Approved on …"*; three repeated exports write zero rows; and every item plus
the analysis run is byte-identical before and after.

## Browser verification (2026-07-26) — slice 6C

`slice3.demo@reqwise.dev`, project *Smart Space intake — slice 3*, at localhost:3000.

- **Export screen** rendered scope, readiness and the document preview together. The
  *Portfolio demo* preset resolved to *Reviewed and approved* with 1 requirement in scope and
  read **Ready with warnings**, listing the real ones: 15 unanswered questions, 4 unresolved
  findings, 35 orphans, 8 domain-guidance items — each with display ids.
- **Audit package** switched the same screen to *All statuses*: 60 requirements, 28
  relations, and warnings for the 59 drafts and the 16 legacy relations.
- **All six downloads answered 200** with the right content type
  (`text/markdown`, `application/json`, `text/csv` ×4), inspected through the page's own
  fetch: Markdown 11,343 bytes with 10 `##` sections, Thai intact, no provider payload; JSON
  `schemaVersion: reqwise-export/1.0` with sorted top-level keys; the requirements CSV's
  declared header, CRLF rows and quoted Thai. An unknown format (`/download/pdf`) and another
  tenant's project both answered **404**.
- **Printable route** rendered document-only content; the tab title became
  *"Smart Space intake — slice 3 — requirements"* (the filename Save-as-PDF proposes). Read
  live from the DOM: the sidebar and toolbar carry `screen-only`, the print footer is in the
  DOM and `display: none` on screen, 22 blocks carry `.export-block`, 9 sections carry
  `.export-section`, and the print rules resolved to `@page { size: a4; margin: 16mm 14mm }`,
  `.screen-only { display: none !important }` and
  `.export-section + .export-section { break-before: page }`.
- **Responsive:** no horizontal page overflow at 834 px or 390 px (same-origin iframe
  technique as slice 4.2). All 35 interactive targets on the export screen measured ≥ 44 px;
  the smallest is exactly 44.
- **Console:** no application errors. Two `EXCEPTION` entries are Next's dev-time source-map
  worker (`next/dist/compiled/jest-worker`) crashing under repeated iframe renders, plus the
  pre-existing `scroll-behavior: smooth` advisory. Neither comes from application code.
- **Not verified in the browser:** an actual file-on-disk download (the browser extension
  blocks downloads, so responses were inspected instead of saved files), the native print
  dialog, and an archived project's export screen — no demo project is archived. Archived
  export is covered by runtime check 3.

## Runtime verification (2026-07-26) — slice 6B typed traceability, 22/22 PASS

`npm run verify:traceability`, against the live database.

Typed relation contract (1–14): a new run persists `implemented_by` + `expressed_as`
through the RPC; a legacy `derives_from` row still loads with its own label and its own
child → parent direction; an unknown type dies at the enum; a local key not in the run is
refused and the run rolls back whole; self-relation, duplicate and cross-project edges are
refused — the last **also against the service role**, so it is a constraint and not an RLS
filter; an illegal pair (`implemented_by` BR → AC) is refused; the whole valid spine plus
`supports` persists; a hierarchical cycle is refused while `related_to` in both directions
is not; an invalid relation leaves no run, no items, no relations; and a new run may not
author `derives_from`.

Authorization (15–17): user B reads zero relations and zero items through the traceability
path — RLS, not a filter — and cannot write into user A's project.

Archived projects (18–19): traceability reads in full, writes are refused.

Coverage inputs and immutability (20–22): the data coverage reads is what a real reader
gets back (an orphan, an approved item linked to a rejected one); the analysis run is
byte-identical afterwards; review and workflow data are untouched by traceability reads.

**Browser check (2026-07-26).** `slice3.demo@reqwise.dev`, project *Smart Space intake —
slice 3* (81 items, 5 runs): Coverage read 81 total · 33 linked · 35 orphans · 15 open
questions · 4 unresolved findings with the disclaimer beneath it; Matrix rendered the
five spine columns with `MISSING — No business requirement` gap cells; Map rendered the
columns with edges; the Inspector on BR-005 read its four edges as sentences (*"is
implemented by FR-005"*, *"supports OBJ-005"*, *"has a quality issue flagged by QF-005"*)
and *Open in Analysis Workspace* deep-linked to the item with its relation count. No
console errors.

## Runtime verification (2026-07-25) — slice 6A question & quality workflow, 32/32 PASS

`npm run verify:workflow`, against the live database, on authenticated users' own
clients.

Questions (1–15): an AI-created question starts `open`, unresolved and unstamped; a
member answers it; the answer, actor and timestamp are stored; an append-only
`question_answered` activity records `open → answered` with the answer text; an empty
**and** a whitespace-only answer are both refused and write nothing; `open → deferred`
succeeds with a reason and carries a follow-up date, which is refused on any other
outcome; `open → not_applicable` succeeds; reopening requires a reason and clears the
decision while the original answer stays in the audit log; an outsider is refused by the
RPC and matches no row directly; an archived project refuses both paths while staying
readable; a cross-project id is a miss and a cross-organization action is refused; a
stale expected state is refused. **Answering changes no sibling item, no analysis run and
no source reference** — all three fingerprinted before and after.

Findings (16–26): a finding starts `open`; `acknowledged` succeeds with no note and
writes no resolution or stamp — *seen, not fixed*; resolving and dismissing each require
real words; reopening either requires a reason, clears the resolution and leaves the
original in history; an outsider and an archived project are refused; a stale state is
refused. **Resolving a finding leaves the requirement it points at byte-identical**, with
a real `item_relations` edge in place. Activities cannot be updated or deleted even by
the service role.

Integrity (27–32): neither a question nor a finding can be approved through
`review_item()`; a requirement can use neither workflow RPC and carries `workflow_state
NULL`; a refused action writes **neither** the state change nor the activity, and a
successful one writes both; two concurrent actions produce one write, one activity and
one `workflow conflict` refusal; the run and every excerpt are unchanged overall.

## Browser verification (2026-07-25) — slice 6A, all 19 steps

Signed in as the slice-3 demo user, on the Thai meeting-notes run, at 1920 px.

The centre panel shows **Requirements 12 · Open questions 2 · Quality findings 1**, and
the summary bar reads *2 unanswered* / *1 unresolved* — real sub-counts, not a score.

**Q-003** (source-analysis origin) highlighted its exact excerpt on selection, *Highlight
1 of 1*. Its Answer tab offered Mark answered / Defer / Not applicable, the note was
labelled *Stakeholder answer (required)*, and the answered form carried the change-request
notice with a **disabled** *Create change request — Coming next*. After saving: the row
read **Answered** with the answer as its preview, the summary moved to *1 unanswered*, and
History showed *Answered stakeholder question* with the text.

**Q-004** (domain-profile origin) produced **zero `<mark>` elements**; the source footer
and the Evidence tab both read *"Generated from domain guidance; no direct source
evidence."* Deferring it with a reason and a follow-up date put **Deferred · ⏱ 2026-08-15**
on the row.

**QF-002** opened a *Finding inspector* with a **Resolution** tab. Open offered
Acknowledge / Resolve / Dismiss; acknowledging (note optional) left it *still unresolved*
and the actions became Resolve / Dismiss / Reopen; resolving (note required) left only
Reopen and moved the summary to *all handled*. **FR-002 stayed `Critical · Approved · v4`
and NFR-002 — named in the resolution note — stayed `Unassigned · Draft · v1`.**

Archived: a Reopen form opened while active and submitted after archiving in a second tab
was refused server-side — *"This project is archived and read-only."* — with the finding
still Resolved and nothing internal leaked. Reloading showed **no workflow actions at
all**, the archived notice, and the answer still readable. The project was then restored.

Route protection: the analysis route redirects to `/sign-in?next=…` without credentials.

## Responsive verification (2026-07-25) — slice 6A at 834 px

Segmented control present; every workflow action measured exactly **44 px**; no
horizontal overflow (834/834). Cycling Source ⇄ Requirements ⇄ Inspector preserved the
**selected question, the inspector's Answer tab, and a half-written answer**. Selecting a
*different* question raised *"You have unsaved changes. Opening Q-003 will discard them."*
with Discard / Keep editing, and Q-004 stayed selected.

## Runtime verification (2026-07-25) — slice 5 review workflow, 30/30 PASS

`npm run verify:review`, against the live database, on authenticated users' own clients.
The service role appears only to build fixtures — and twice deliberately pointed *at* a
rule, to prove that even it is refused.

Editing (1–8): a member edits their own draft; title, description and priority are
written; one `item_versions` snapshot appears with its actor and change reason;
`version_no` goes 1 → 2; the snapshot holds the pre-edit title, priority **and** status;
the analysis run's raw output is unchanged character for character; the item's source
references are unchanged; a draft edit stays a draft and writes no activity.

Review reset (9–10): editing a `needs_clarification` item and editing a `reviewed` item
each return it to `draft` and append an `edit` activity carrying the real transition.

Refusals (11–16): an approved item cannot be edited through the RPC *or* directly; a
rejected item likewise; a stale `expectedVersion` is refused and does not advance the
version; a non-member is refused by the RPC and matches no row directly; an archived
project refuses both paths while staying fully readable; a direct status UPDATE is
refused for a member **and** for the service role.

Transitions (17–22): `draft → reviewed` succeeds and is audited; clarification and
rejection each require a real note (whitespace does not count) and the refused attempt
leaves the status alone; `reviewed → approved` succeeds while `draft → approved` is
refused; `approved → draft`, `approved → needs_clarification` and `rejected → draft` are
all refused.

Scope and concurrency (23–30): an open question and a quality finding can be neither
approved, reviewed nor edited; an archived project refuses review; **two concurrent edits
against the same version produce exactly one write, one snapshot and one refusal**;
review activities and item versions cannot be updated or deleted even by the service
role; a cross-project id is a miss under the route's project; a cross-organization edit,
review and read are all refused with nothing but "not found".

## Browser verification (2026-07-25) — slice 5, the full review flow

Signed in as the slice-3 demo user, on the Thai meeting-notes run, at 1920 px.

Edit → history: selected the draft **FR-002**, opened the inline inspector form (visible
labels, live character counts 24/300 · 59/4000 · 0/500, `expectedVersion` 1), changed the
statement and priority with a change reason, saved. The row became **Critical · Draft ·
v2**; History showed *v2 Current* over *v1* with the pre-edit title, "High", "Draft at the
time", *Changed next: Statement, Priority* and the reason.

Review loop: requested clarification with a required note → status **Needs clarification**
and the actions correctly narrowed to Edit / Mark reviewed / Reject. Edited it → back to
**Draft v3** with a *Returned to draft after edit* activity reading *Needs clarification →
Draft*. Marked reviewed → **Approve** appeared. Edited the reviewed item → back to
**Draft** again. Marked reviewed, then approved: the confirmation named the three
consequences (a human decision, read-only for the release, the analysis run unchanged) and
carried no note field. After approval the item is **Approved · read-only** with only
*View history* left. Evidence still cites characters 384–408, ◆ Verified, and the source
panel still highlights that exact span — four edits and an approval later.

Archived project (the real test, not the rendered one): opened a clarification form while
the project was active, archived the project in a second tab, then submitted the stale
form. The server refused it — *"This project is archived and read-only. Restore it to make
changes."*, item still Draft v1, and nothing in the message names a table, function,
policy or SQLSTATE. Reloading showed the inspector with **no write actions at all** and
the full four-version history plus review timeline still readable. The project was then
restored.

Route protection: `/workspace`, the project page and the analysis run each redirect to
`/sign-in?next=…` with the target preserved when requested without credentials.

⚠️ **Two honest caveats.** (1) Route protection was checked with same-origin
`fetch(..., { credentials: "omit" })` rather than by signing out, because signing out
would need the account password typed in — the session was left intact. (2) The tablet
checks used the same-origin iframe method described in the slice 4.2 section: real media
queries, but not device emulation.

## Responsive verification (2026-07-25) — slice 5 at 834 px

Segmented control present; **BR-002 stayed selected across every Source ⇄ Requirements ⇄
Inspector switch**; every review action measured exactly **44 px** tall; no horizontal
overflow (834/834). A pending edit **survives a panel switch** (the panes are shown and
hidden, not mounted and unmounted) and selecting a *different* requirement raises
*"You have unsaved changes. Opening OBJ-002 will discard them."* with *Discard and open* /
*Keep editing*, rather than discarding silently.

## Open decisions and known consequences

1. **`analysis_runs` is write-once** (no pending→complete row) → no streaming/long-run
   support. The synchronous Gemini adapter preserves this invariant; streaming or
   background runs remain deferred until the product requires them.
2. **`analysis_items` has no INSERT RLS policy** — items are written only server-side with
   the service-role client during a run (`lib/supabase/admin.ts`), never the anon client.
3. **Nothing under a project can be deleted — RESOLVED in slice 2 by archiving.** The
   immutability triggers make a `delete from projects` cascade fail, so the product
   decision is that projects are archived, never deleted: `status = 'archived'` with
   `archived_at` / `archived_by` / `archive_reason`, every child row untouched, and the
   `projects_delete_owner` RLS policy dropped so no delete path exists at all. Restore is
   owner-only. Hard purge remains out of scope (it would need the maintenance path in
   `scripts/verify-db-cleanup.sql`, which disables the immutability triggers).
4. **A source is frozen by citation, not by age — RESOLVED in slice 3.** `source_documents`
   was originally write-once, which made "fix a typo before running anything" impossible.
   The rule is now: editable until an `analysis_runs` row references the revision, frozen
   permanently after, and editing a frozen revision inserts revision N+1 chained to it.
   Deletion is still impossible in every state. Lock state is **derived**
   (`source_document_is_locked()`), never stored, so it cannot drift from the runs it
   describes. Consequence: a project accumulates one row per revision and the list shows
   all of them — a history view that groups by `document_key` is a later slice's job.
5. **`next_display_id()` is a high-water mark, not a sequence.** Calling it twice without
   inserting returns the same id. Correct for preserving gaps from rejected items;
   allocate → insert → allocate. Documented in `DATA-MODEL.md` §C.1 and
   `supabase/README.md`; do not "fix" the function to close gaps.
6. **Only Booking and Smart Space can be selected as a domain.** General Software and
   Custom Domain render as *Coming soon* and are disabled — `lib/domain/availability.ts`
   holds that list, and it is an application concern, never an engine branch
   (ARCHITECTURE §B.2). Custom Domain has no `domain_profiles` row at all.
7. **Archive/restore are RPCs, not updates.** `guard_project_update` rejects any direct
   write to `status` / `archived_*`; the functions set a transaction-local flag, exactly
   like `review_item()`. Both are `SECURITY INVOKER`, so RLS still applies and the actor
   always comes from `auth.uid()`.

## Gotchas already known

- **Postgres `trim()` / `btrim()` removes SPACES ONLY.** Not tabs, not newlines. Every
  "a note is required" rule in this schema was written as `nullif(btrim(x), '')` and
  therefore accepted a note of `E'
	'` as words. `blank_to_null()` (20260725000017) is
  now the single definition of blank; use it for any future required-text rule.
  `scripts/verify-workflow.mts` check 5 caught it, and only because that check used a
  newline — the slice-5 equivalent used spaces and passed while the same hole was open.
- **Adding an enum value and using it need two migrations.** `alter type … add value`
  cannot be *used* by the transaction that ran it, and `supabase db push` wraps each file
  in one. That is why 20260725000015 exists on its own.
- **A `"use server"` module may only export async functions — and breaking that rule
  compiles.** Exporting `EMPTY_REVIEW_STATE` from `actions.ts` passed typecheck, lint and
  `next build`, then arrived at the client as `undefined`, so the first
  `state.fieldErrors` read threw into an error boundary the moment somebody pressed Edit.
  Plain data for a form's initial state goes in a sibling module — `form-state.ts` next to
  the actions, the pattern `sources/form-state.ts` already established. **This is the case
  for browser verification**: nothing else in the toolchain catches it.
- **PostgREST retries `serialization_failure` (40001).** A version conflict raised with
  that code came back as "upstream request timeout" after a long wait instead of a
  refusal. Conflicts are permanent answers: raise `PT409`, PostgREST's convention for
  HTTP 409, which is never retried. Cost one extra migration (20260725000014) to fix,
  because an applied migration is never edited.
- **`md:flex-none` in `app/workspace/layout.tsx` is load-bearing — do not "simplify" it.**
  The root layout's `<body>` is `min-h-full flex flex-col`, so the workspace root is a flex
  item; `flex: 1 1 0%` resolves its height from the flex algorithm and **silently makes
  `h-dvh` inert**. Symptom when it was wrong: the whole page scrolled (1671 px against an
  873 px viewport), the source panel's highlight-navigation footer sat below the fold, and
  not one panel had its own scroller. There is a comment on the line saying so.
- **Setting a `<select>.value` from JavaScript does not drive React.** The DOM value
  changes and the component state does not, so a scripted browser check will "pass" while
  the UI never updated. Drive selects with real clicks or ArrowUp/ArrowDown + Enter.
  `element.click()` on a button *is* fine — React's root listener sees a real bubbling
  click.
- **`create-next-app` rejects capital letters** in the project name. Scaffolded as
  `reqwise-ai`, then the folder was renamed to `ReqWiseAI`. `package.json` keeps
  `"name": "reqwise-ai"` — that's correct, don't "fix" it.
- **Never pin one Gemini model.** `../Job Application Tracker Dashboard/api/match.js`
  died on a 503/404 when its pinned model was retired; it now carries an ordered
  fallback chain. Copy that, not a single model string.
- **Two worktrees now.** ReqWise AI lives in its own worktree/branch, isolated from the
  portfolio work:
  - `C:/Users/User/Desktop/Claude Code` → branch `portfolio-custom-lottie` (HEAD
    `5b78f36`) — the original repo with ~40 unrelated uncommitted files, unchanged
    since 2026-07-24 and none of them ours. **Do not build ReqWise here.**
  - `C:/Users/User/Desktop/ReqWiseAI-worktree` → branch `reqwise-ai` (HEAD = the latest
    slice; see the Git table below) — **build here.** Project root is the nested
    `ReqWiseAI/` folder.
- **Supabase rejects `@example.com` on public sign-up** ("Email address is invalid"). The
  admin API does not, which is why the verification script can use it. Use a real address
  in the UI.
- **`middleware.ts` is deprecated in Next 16** — the file is `proxy.ts` and exports
  `proxy`. Both files present is a build error, not a warning.
- **`"use server"` modules may only export async functions.** `AuthState` and
  `emptyAuthState` live in `app/auth/state.ts` for exactly that reason; moving them back
  into `actions.ts` breaks the build.
- **Node runs the `.mts` scripts directly** (native type stripping). Value imports they
  reach must carry an explicit `.ts` extension — that is why
  `lib/domain/profiles/index.ts` and `lib/domain/load-profile.ts` have them, and why
  `tsconfig.json` sets `allowImportingTsExtensions`.
- Stage paths explicitly — never `git add .` / `-A`.
- **Never pin one Gemini model.** `../Job Application Tracker Dashboard/api/match.js`
  died on a retired pinned model; keep an ordered fallback chain (also in `CLAUDE.md`).
- `create-next-app` rejected the capital-letter name → scaffolded `reqwise-ai`, folder
  renamed to `ReqWiseAI`; `package.json` name stays `reqwise-ai`. Don't "fix" it.

## Git — current state (2026-07-26)

Branch `reqwise-ai`, working tree clean:

| Commit | Phase |
|---|---|
| `b0c6e9c` | 6C — requirements export and printable handoff (HEAD) |
| `f5b5bf7` | 6B — typed traceability relations + graph views |
| `cc889b6` | docs — records 5 and 6A's own hashes |
| `9575ec6` | 6A — open-question resolution + quality-finding workflow |
| `89a1337` | 5 — requirement editing, human review, approval, version history |
| `c194adf` | docs — records 4.2's own hash (a commit cannot contain it) |
| `7df5455` | 4.2 — three-panel Analysis Workspace |
| `e668026` | 4.1 — input-aware mock, reserved display-id ranges |
| `bf148b3` | 3B — supabase clients, email auth, protected routes |
| `595a62f` | 3A — database schema, constraints, RLS, workspace bootstrap |
| `97f9e23` | 2 — analysis contracts and the deterministic mock provider |

- Nothing pushed. No remote git work done, and no Vercel deploy (Phase 4, and a
  protected action — it needs explicit approval plus env vars set in the dashboard).
- Stage paths explicitly on every commit.
