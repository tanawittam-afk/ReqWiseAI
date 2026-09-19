# ReqWise AI — "Usable Product" Master Plan

Agreed with the owner on 2026-09-17 in a grilling session; the owner replied "confirmed".
Goal: turn the shipped portfolio app into a tool the owner and invited teammates really
use, and add the missing "forecast" layer (an overall quality score plus a check for gaps
between meeting notes and requirements).

**Rule: at the end of every phase, update `HANDOFF.md` (the "Last updated" block + this
file's phase-status table) before starting the next phase or pausing.**

Timeline: 2–4 weeks. Each phase ends deployed and working.

---

## Phase status

| Phase | Name | Status |
|---|---|---|
| 0 | Real-notes test (owner) | Not started — skipped ahead to Phase 1; only Phase 5 depends on it |
| 1 | Protection | **Shipped, live, and verified (2026-09-19) — all 4 slices done. `ADMIN_EMAIL` on Vercel is the one outstanding step; see HANDOFF.md.** |
| 2 | Forecast — quality score | **Shipped, live, and verified (2026-09-21) — all 7 slices done: quality score + Quality tab + project-card badge, manual "add requirement", and editable output language (match-source detection, settings UI, export fix). Not yet committed.** See HANDOFF.md and the slice plan at `C:\Users\User\.claude\plans\rancandel-reqwise-ai-squishy-blanket.md`. |
| 3 | Gap check | **Shipped, live, and verified (2026-09-20) — all 6 slices done: weakly-supported list, excerpt-location/segmentation, `coverage_gap` schema + workflow, AI gap-filter capability, orchestration, and the Quality tab UI. Not yet committed.** See HANDOFF.md and the slice plan at `C:\Users\User\.claude\plans\rancandel-reqwise-ai-squishy-blanket.md`. |
| 4 | Sharing | Not started |
| 5 | Readability | Not started — design questions wait on Phase 0 findings |

---

## Settled decisions

### Users and access
- **Audience:** the owner + invited teammates + recruiters (the existing `/demo` stays).
- **Sign-up:** open to anyone (email confirmation, as today), plus an **admin switch**
  that turns sign-up off.
- **Admin:** the email listed in a Vercel env var (no admin role in the DB). Page
  `/admin`: sign-up on/off, today's usage per user, reset a user's daily limit.
- **Sharing:** shared projects with roles **Owner / Editor / Viewer**.
  - Owner: invite, remove, delete.
  - Editor: add sources, run analysis, edit, review. Owners and Editors can approve.
  - Viewer: read + export only.
  - The existing `organizations` / `organization_members` / `is_project_member`
    structure is the starting point. Today it has no insert policy, invite flow or UI.
- **Invites:** by email. If the invited email has no account yet, the invite is stored
  and applied when that email signs up.

### AI provider and cost
- **Provider:** Gemini free tier, through the existing `AiProvider` adapter
  (`lib/providers/`). Gemini is not hardcoded. Claude/OpenAI can be added later, about
  one folder each.
- **Daily limit:** 10 analyses per user per day, reset at midnight Asia/Bangkok. Show a
  "N of 10 left today" counter near the Analyze button. It applies only when the owner's
  key is used.
- **Own key:** users may save their own **Gemini** key, which removes the limit.
  - Stored encrypted in the DB (app-level encryption, e.g. AES-256-GCM). The secret lives
    only in a Vercel env var, never in the repo.
  - The key is never returned to the browser: the UI shows its last 4 characters, with
    Replace and Delete.
- **Shared projects:** an analysis counts against the limit (or own key) of **the person
  who runs it**, not the project owner.
- **Privacy:** a warning before each analysis. Gemini's free tier may use prompts to
  improve Google's products, so users should remove names and confidential details.
  Truly confidential notes should use a paid key.

### Forecast (score + gap check)
- **Pipeline:** notes → requirement extraction (improve quality) → quality score →
  notes-vs-requirements gap check.
- **Quality score:** a fixed formula (never AI-given). It starts at 100 and subtracts per
  **open** `quality_finding`:
  - conflicting −15
  - untestable −10
  - ambiguous −8
  - incomplete −8
  - duplicate −5

  The minimum is 0, with a breakdown by finding type. The score is **one per analysis
  run**, recomputed live: resolved or dismissed findings stop subtracting.
- **Gap check** runs automatically after every analysis. Its AI step counts as part of
  the same analysis (uses 1 of 10).
  1. Code locates each stored `excerpt` in the source `rawText`. Gemini runs store null
     offsets, so the code must find them. An excerpt found in several places counts as
     covering **all** of them.
  2. Code splits the notes into statements and marks the ones no requirement cites.
  3. The AI filters **only** those uncovered statements, dropping chit-chat and
     non-requirements.
  4. "Weakly supported" = a requirement with no source reference, or
     `evidence_strength` < 0.5.
- **Manual requirements:** allowed ("Add requirement from this" on a gap, or directly).
  - Marked as manual, and can link to a source excerpt.
  - They start as `draft`, like AI items.
  - This needs a new write path: `analysis_items` has no INSERT policy today.
- **Output language:** a per-project setting of **TH / EN / match source**, editable
  after creation. It affects new runs only.
  - "Match source" = TH if Thai characters are more than ~30% of the notes, else EN.
    Decided by code, not the AI.
  - Today `projects.output_lang` is only `th`/`en` and is set only at creation.

### UI
- A new **"Quality" tab** in the analysis workspace: score + breakdown, the gap lists
  ("discussed but not written", "weakly supported"), and "Add requirement from this".
- A small score badge on each project card.
- **CLAUDE.md's "Never invent a metric / quality-score panel is deferred" rule must be
  updated in the same commit that ships the score** (the owner approved the score here).
  Also update `ARCHITECTURE.md` §A.4 and `docs/design/INTERFACE.md`.
- Phase 5's readability design is decided after Phase 0.

### Process
The owner chose the lighter process (option b). Per phase:
1. ArchitectTam + DataTam: a short design + schema/RLS plan.
2. DevBAmooTam: build one vertical slice at a time, UI through DB.
3. Noey: screen review.
4. Meejai: QA of each handoff and phase gate.
5. Deploy.

- **New migrations are applied to the live Supabase project only after the owner says
  yes.** Applied migrations are never edited.
- Every phase meets `CLAUDE.md`'s Definition of Done, including the second-user RLS
  check.
- Optional: author Phase 2's requirements inside ReqWiseAI itself (dogfooding).

---

## Phases

### Phase 0 — Real-notes test (owner)
Run 2–3 real or realistic meeting notes through `reqwise-ai.vercel.app` and list
everything that feels wrong: result quality, readability, confusing steps, missing
features. Those notes become fixed test cases for later phases.
**Done when:** the owner hands over the pain-point list.

### Phase 1 — Protection
Build first, because sign-up is open and nothing limits usage today.
- Per-user daily analysis counter and limit (10/day, Bangkok midnight reset) + UI counter
- Privacy warning before analysis
- `/admin` page (admin email via env): sign-up switch, usage view, limit reset
- Encrypted own-Gemini-key storage + settings UI (last 4 characters, Replace, Delete);
  an own key bypasses the limit
- `.env.example` updated (admin email, encryption secret)

**Done when:**
- the 11th analysis in a day is blocked
- a user with their own key is not limited
- the admin switch stops new sign-ups
- the key never appears in any response body

### Phase 2 — Forecast: quality score
- Score computation (pure, unit-tested) + Quality tab + project-card badge
- Manual "add requirement" path (new write path, `draft` status, optional source link)
- Output-language setting: TH / EN / match source, editable; the Thai-ratio detector
- CLAUDE.md / ARCHITECTURE.md / INTERFACE.md rules updated in the same commit

**Done when:**
- resolving a finding raises the score live
- "match source" picks TH for a Thai note and EN for an English note

### Phase 3 — Gap check
- Excerpt-location step (null offsets → located spans; repeated excerpts cover all
  places)
- Statement segmentation + uncovered-statement detection
- AI filter over uncovered statements only (inside the same run's quota)
- Weakly supported requirements (no reference, or `evidence_strength` < 0.5)
- "Add requirement from this" wired to Phase 2's manual path

**Done when:** a topic deliberately planted in a test note, with no requirement for it,
shows up as a gap.

### Phase 4 — Sharing
- Membership insert/remove path + RLS for Owner / Editor / Viewer
- Email invites, including pending invites applied at sign-up
- Members screen

**Done when:**
- a Viewer cannot edit
- an Editor's analysis uses the Editor's own limit
- a non-member (second user) still sees nothing

### Phase 5 — Readability
- Fixes from the Phase 0 list, with a Noey review against `docs/design/INTERFACE.md`

**Done when:** every Phase 0 item is fixed or explicitly deferred.

---

## Deferred (not in this plan)
- Score trend chart across runs
- Claude / OpenAI own keys
- A separate Approver role
- PDF/DOCX upload
- Multi-source analysis runs
- Risk forecast view
- Command palette
