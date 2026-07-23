# ReqWise AI — Handoff

**Read `CLAUDE.md` first.** It holds the stack lock, the project rules, and the
definition of done. This file holds *state*: where the build actually is right now.

Last updated: 2026-07-24

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
- [ ] **Phase 3 (was Schema + UX) — parallel.** `supabase/schema.sql`, RLS
      across the 12 tables; the split-pane Requirements Intelligence Workspace. The
      display-ID allocator (`lib/normalization/ports.ts`) is built to be swapped for a
      DB-backed sequence here.
- [ ] **Phase 3 — Vertical slices (DevBAmooTam).** auth → analyze (mock provider first) →
      review/approve → traceability → export.
- [ ] **Phase 4 — Review & QA → deploy.** Vercel deploy is a protected action; needs
      explicit approval and env vars set in the dashboard, never committed.

## Environment (not yet configured)

Nothing is wired up yet. When Phase 3 starts, `.env.local` will need:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server only — never NEXT_PUBLIC_
AI_PROVIDER=mock             # mock | gemini — mock is the local default
GEMINI_API_KEY=              # server only
```

`.env.example` does not exist yet — `CLAUDE.md` requires it to be created and kept in
step as soon as the first variable is actually used.

The Supabase project itself has not been created yet.

## Gotchas already known

- **`create-next-app` rejects capital letters** in the project name. Scaffolded as
  `reqwise-ai`, then the folder was renamed to `ReqWiseAI`. `package.json` keeps
  `"name": "reqwise-ai"` — that's correct, don't "fix" it.
- **Never pin one Gemini model.** `../Job Application Tracker Dashboard/api/match.js`
  died on a 503/404 when its pinned model was retired; it now carries an ordered
  fallback chain. Copy that, not a single model string.
- Repo-wide: this work started on branch `portfolio-custom-lottie` with unrelated
  uncommitted changes present. Give ReqWise AI its own branch before the first commit,
  and stage paths explicitly — never `git add .`.

## Git

Nothing committed yet. `ReqWiseAI/` is entirely untracked.
