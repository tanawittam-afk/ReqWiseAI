# ReqWise AI — Handoff

**Read `CLAUDE.md` first.** It holds the stack lock, the project rules, and the
definition of done. This file holds *state*: where the build actually is right now.

Last updated: 2026-07-24 (slice 2 — project creation, list and the archive lifecycle —
shipped and verified against the live database)

---

## ▶️ RESUME HERE

**Where you are:** in a dedicated git worktree, on branch `reqwise-ai`.

- **Work in:** `C:/Users/User/Desktop/ReqWiseAI-worktree/ReqWiseAI` — NOT the main repo
  at `C:/Users/User/Desktop/Claude Code` (that is `portfolio-custom-lottie`, unrelated).
- **Branch:** `reqwise-ai` · **HEAD:** slice 2. Working tree clean.
- Nothing is blocked.

**Next up: vertical slice 3 — Add source document**
(`docs/architecture/ARCHITECTURE.md` §E, slice 3). Paste or type text, store it
**immutably**, render it back verbatim. The project overview already links to it as the
next step, and `projects.output_lang` is already stored per project. An archived project
must be refused: guard on `project.status` before any write, the same way the UI already
hides the action.

**The database is real.** A hosted Supabase project is linked (`rgfwtflsvnlgfiuoxowm`),
all 7 migrations are applied, and the seed is loaded. `.env.local` holds the keys and is
gitignored — never commit it.

```bash
npm run dev                  # http://localhost:3000
npm run verify:db            # 8/8 schema checks (slice 1)
npm run verify:projects      # 10/10 project lifecycle checks (slice 2)
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
- [ ] **Phase 3C+ — remaining vertical slices.** add source → run mock
      analysis (persist run + items + refs in one transaction) → workspace split-pane →
      edit item → review/approve → export. Slice order in
      `docs/architecture/ARCHITECTURE.md` §E.
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
4. **`next_display_id()` is a high-water mark, not a sequence.** Calling it twice without
   inserting returns the same id. Correct for preserving gaps from rejected items;
   allocate → insert → allocate. Documented in `DATA-MODEL.md` §C.1 and
   `supabase/README.md`; do not "fix" the function to close gaps.
5. **Only Booking and Smart Space can be selected as a domain.** General Software and
   Custom Domain render as *Coming soon* and are disabled — `lib/domain/availability.ts`
   holds that list, and it is an application concern, never an engine branch
   (ARCHITECTURE §B.2). Custom Domain has no `domain_profiles` row at all.
6. **Archive/restore are RPCs, not updates.** `guard_project_update` rejects any direct
   write to `status` / `archived_*`; the functions set a transaction-local flag, exactly
   like `review_item()`. Both are `SECURITY INVOKER`, so RLS still applies and the actor
   always comes from `auth.uid()`.

## Gotchas already known

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

## Git — current state (2026-07-24 EOD)

Branch `reqwise-ai`, working tree clean:

| Commit | Phase |
|---|---|
| `bf148b3` | 3B — supabase clients, email auth, protected routes |
| `595a62f` | 3A — database schema, constraints, RLS, workspace bootstrap |
| `97f9e23` | 2 — analysis contracts and the deterministic mock provider |

- Nothing pushed. No remote git work done, and no Vercel deploy (Phase 4, and a
  protected action — it needs explicit approval plus env vars set in the dashboard).
- Stage paths explicitly on every commit.
