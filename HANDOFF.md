# ReqWise AI — Handoff

**Read `CLAUDE.md` first.** It holds the stack lock, the project rules, and the
definition of done. This file holds *state*: where the build actually is right now.

Last updated: 2026-07-25 (slice 4.2 — the three-panel Analysis Workspace — shipped and
verified in the browser at four viewport widths)

---

## ▶️ RESUME HERE

**Where you are:** in a dedicated git worktree, on branch `reqwise-ai`.

- **Work in:** `C:/Users/User/Desktop/ReqWiseAI-worktree/ReqWiseAI` — NOT the main repo
  at `C:/Users/User/Desktop/Claude Code` (that is `portfolio-custom-lottie`, unrelated).
- **Branch:** `reqwise-ai` · **HEAD:** slice 4.2. Working tree clean.
- Nothing is blocked.

**Next up: slice 5 — requirement editing / review workflow** — approve, reject, request
clarification, edit an item's content. The database side is already built and proven
(`review_item()`, versioning trigger, all in `20260724000005`, since Phase 3A) — this
slice is purely the UI plus the server actions that call it, symmetrical to how sources
were built in slice 3.

**It lands inside the Inspector that slice 4.2 just finished.**
`_components/inspector.tsx` today has exactly three tabs — Details · Evidence · Relations.
**History** and **Notes** were deliberately left out, not forgotten: `item_versions` and
`review_activities` hold nothing in a read-only build, and an empty tab that promises data
is worse than an absent one. Slice 5 adds them, plus the action row. The row list already
renders review status (`Draft` / `Unassigned` chips come from real columns), so a
successful review action only has to invalidate the run query for the whole screen to
update.

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
all 12 migrations are applied, and the seed is loaded. `.env.local` holds the keys and is
gitignored — never commit it.

```bash
npm run dev                  # http://localhost:3000
npm run verify:db            # 8/8 schema checks (slice 1, check 3 updated in slice 3)
npm run verify:projects      # 10/10 project lifecycle checks (slice 2)
npm run verify:sources       # 18/18 source, lock and revision checks (slice 3)
npm run verify:analysis      # 25/25 analysis, allocation and idempotency checks (4 + 4.1)
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

As of 2026-07-25 the linked project holds **66 accounts (64 throwaway + 2 real)**, 81
projects, 58 analysis runs and 426 analysis items. Almost all of it is residue from
`verify:*` runs, which create a fresh user pair and project set every time and cannot
clean up after themselves — the immutability triggers refuse DELETE even for the service
role, which is the schema working as designed.

Harmless, but worth clearing before a demo so the dashboards read honestly:

```bash
npx supabase db query --linked -f scripts/verify-db-cleanup.sql
```

It matches only the verification naming patterns (`reqwise-verify-*`, `reqwise-src-*`,
`reqwise-analysis-*`, and the `Slice N …` project names) and leaves the two real demo
accounts and their projects untouched.

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
| LLM | Server-side **provider adapter**; Gemini is the configured provider, plus a deterministic mock for local/tests | `GEMINI_API_KEY` already exists in Vercel; proven pattern in the Job Tracker. The adapter is required by the 2026-07-24 spec — no component calls a provider directly |
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
GEMINI_API_KEY=                        # server only, empty until the real provider
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

## Open decisions and known consequences

1. **`analysis_runs` is write-once** (no pending→complete row) → no streaming/long-run
   support. Accepted for MVP; revisit before the real Gemini provider ships.
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
    `5b78f36`) — the original repo with 36 unrelated uncommitted files. **Do not build
    ReqWise here.**
  - `C:/Users/User/Desktop/ReqWiseAI-worktree` → branch `reqwise-ai` (HEAD `bf148b3`) —
    **build here.** Project root is the nested `ReqWiseAI/` folder.
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

## Git — current state (2026-07-25 EOD)

Branch `reqwise-ai`, working tree clean:

| Commit | Phase |
|---|---|
| `7df5455` | 4.2 — three-panel Analysis Workspace (this slice) |
| `e668026` | 4.1 — input-aware mock, reserved display-id ranges |
| `bf148b3` | 3B — supabase clients, email auth, protected routes |
| `595a62f` | 3A — database schema, constraints, RLS, workspace bootstrap |
| `97f9e23` | 2 — analysis contracts and the deterministic mock provider |

- Nothing pushed. No remote git work done, and no Vercel deploy (Phase 4, and a
  protected action — it needs explicit approval plus env vars set in the dashboard).
- Stage paths explicitly on every commit.
