# Phase 4 (Sharing) — Design

Produced by a joint ArchitectTam + DataTam + Noey discussion (3 rounds), Meejai QA'd
(PASS, 2026-09-21, second pass — first pass found 4 gaps, all closed). This is the
"short design + schema/RLS plan" step the master plan's Process section calls for,
with Noey's screen spec folded in up front instead of only reviewing after build.

Master plan reference: `2026-09-17-usable-product-master-plan.md`, "Phase 4 — Sharing"
and "Users and access". Done-when: a Viewer cannot edit · an Editor's analysis uses
the Editor's own limit (already true today — `user_daily_usage` keys purely on
`auth.uid()`, untouched by this phase, confirmed by Meejai) · a non-member still sees
nothing.

## Core decision

Sharing is **project-scoped**, via a new `project_members` table — **not** a reuse of
`organization_members`/`org_role`. Every user's projects live in one personal
`organizations` row (`handle_new_user()`/`lib/projects/service.ts`, confirmed by
reading the code, not assumed); reusing org membership for project sharing would
silently hand an invited teammate every other project in that same org. All three
agents independently flagged this before it became a decision.

**Zero changes to the ~15 existing `is_project_member()`/`is_project_owner()` call
sites.** Their SQL bodies are redefined to query `project_members` instead of the
`projects ⋈ organization_members` join; every RLS policy and RPC guard that already
calls them keeps working unchanged.

## Schema

```sql
create type project_role as enum ('owner', 'editor', 'viewer'); -- order is load-bearing, see below

create table project_members (
  project_id  uuid not null references projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        project_role not null,
  invited_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index on project_members (user_id);
-- backfill: insert into project_members select id, created_by, 'owner' from projects;

create type invite_status as enum ('pending', 'accepted', 'revoked');

create table project_invites (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  email       text not null,
  role        project_role not null,
  status      invite_status not null default 'pending',
  invited_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index project_invites_pending_unique
  on project_invites (project_id, lower(email)) where status = 'pending';
```

No expiry column, no invite cap — explicit v1 decisions (DataTam), not omissions. An
invite is valid until revoked or accepted.

## RLS

- **`project_members` SELECT** — two OR'd policies: `user_id = auth.uid()` (see your own
  row) + `is_project_owner(project_id)` (Owner sees every row). Net effect: the member
  list is Owner-only by what the query returns — an Editor/Viewer literally cannot read
  anyone else's membership. No INSERT/UPDATE/DELETE policy — mutation is RPC-only.
- **`project_invites`** — no policies at all (superseding an earlier draft statement
  that said RLS-gated select/insert/delete — Meejai's re-verification confirmed
  RPC-only is correct and is in fact *stronger* than the `analysis_items` no-INSERT-
  policy precedent it mirrors, since RLS stays on with zero write policies rather than
  relying on a service-role bypass).

## Functions

```sql
-- redefined bodies, same signatures, all ~15 existing callers untouched:
is_project_member(p_project uuid) returns boolean   -- now queries project_members
is_project_owner(p_project uuid) returns boolean    -- now queries project_members, role='owner'

create or replace function project_role_of(p_project uuid)
returns project_role language sql stable security definer set search_path = public
as $$ select role from project_members where project_id = p_project and user_id = auth.uid(); $$;

create or replace function has_project_role(p_project uuid, p_min_role project_role)
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(project_role_of(p_project) <= p_min_role, false); $$;
-- relies on enum declaration order ('owner','editor','viewer') for <= to mean
-- "at least this privileged". Reordering the enum silently inverts every permission
-- check in the app — the migration that declares it must carry this warning inline.
```

**Write enforcement**: wherever `is_project_member()` currently gates a *write*,
replace it in place with `has_project_role(p_project, 'editor')` — in the RLS policy
if the table has one (source_documents, source_revisions, review_activities,
change_requests), in the RPC body if the write is RPC-only (`add_manual_requirement`,
`update_coverage_gap`, `review_item`, `edit_analysis_item`, `persist_analysis_result`'s
non-service-role path, the workflow RPCs). Same predicate, same location it already
lives — no new enforcement layer invented.

## Invites

One shared function drives both the sign-up case and the existing-account case:

```sql
create or replace function apply_pending_invites_for_email(p_email text)
returns void ... -- inserts project_members + marks project_invites accepted for matching pending rows
```

Called from **two** places:
1. `handle_new_user()` (extended in place — it already bootstraps `profiles` + personal
   org in one transaction; this keeps invite-apply in the same transaction, no window
   where the account exists but membership hasn't landed).
2. The end of `invite_project_member()` itself, for an email that already has an
   account — **immediate grant**, not a pending wait.

Effect for the UI: after an Owner submits an invite, the response tells you which of
two outcomes happened — the row appears as **Pending** (no account yet), or
**immediately as a real accepted member** (existing account) — same form, no branching
in the interaction, branching only in what gets rendered after submit.

```sql
invite_project_member(p_project, p_email, p_role)   -- Owner-only, upserts pending, calls apply_pending_invites_for_email
revoke_project_invite(p_invite_id)                  -- Owner-only, status := 'revoked'

remove_project_member(p_project, p_user)             -- Owner-only
update_project_member_role(p_project, p_user, p_role) -- Owner-only
```

`remove_project_member`/`update_project_member_role` both call a shared, ungranted
internal helper first:

```sql
assert_removable_or_demotable_owner(p_project, p_user, p_new_role default null)
```

Blocks removing or demoting a project's **sole remaining Owner** (checks current owner
count = 1); a role-change call that sets the role *to* `'owner'` is exempted (no-op,
doesn't reduce the count). Escape hatch: promote a second Owner first (an ordinary
call, unaffected), then remove/downgrade the original — no service-role bypass.

## Migration sequence (9 files, one concept each)

1. `project_role` enum (declaration order comment)
2. `project_members` table + index + backfill, RLS enabled, no policies yet
3. `project_members` SELECT policies + `is_project_member`/`is_project_owner`
   redefinitions + `project_role_of`/`has_project_role`
4. `invite_status` enum
5. `project_invites` table + partial unique index
6. Invite RPCs + `apply_pending_invites_for_email`
7. `remove_project_member`/`update_project_member_role` + the shared lockout helper
8. `handle_new_user()` extension (depends on 6)
9. Write-guard swap across existing RPCs/policies (depends on 3) — **last**

Applied to the live Supabase project only after the owner says yes, per the project's
standing rule.

## Members screen (Noey)

- New "Members" tab in the existing `ProjectNav` (`app/workspace/projects/[projectId]/_components/project-nav.tsx`)
  at `${base}/members`, gated on Owner role — a non-Owner never sees the tab, backed by
  the RLS split above (defense in depth, not the only protection).
- Owner-only screen: member list (avatar/name/email, role badge, status), inline
  (no-modal) invite row (email + role picker, Owner/Editor/Viewer — Owner is never
  invite-able), inline role-change dropdown, full destructive-action pattern for
  Remove (inline confirm-in-place, no undo-after — warning-before is the safety net).
- Two invite-outcome renders: **Pending** badge + muted row (no account yet) vs. an
  immediately-accepted normal member row (existing account) — confirmation copy is
  outcome-aware ("Invite sent to…" vs "…already has an account — added as Editor").
- Error states: invalid email, already a member, already has a pending invite (+
  "Resend"). No cap/expiry error state — not in v1.
- States: default, loading/skeleton, empty (prompt to invite), error, permission-denied
  ("Only the project owner can manage members.").
- Full UX copy (button labels, role-picker one-line explainers, remove-confirmation,
  cancel-invite) specified in the discussion transcript; carry forward as-is into
  implementation.

## Known v1 limitations (stated, not silently absorbed)

- No invite expiry, no invite-send rate limit.
- No live-update — no realtime/websocket mechanism exists anywhere in this codebase
  (checked); the Members screen updates on navigation/refresh like every other screen.
- No ownership transfer as a first-class flow (out of scope; the promote-then-demote
  sequence covers the "I want out" case).

## Next step

DevBAmooTam builds vertical slices against this design. Noey does the screen review
pass on the implementation (per the established process, this design already carries
her spec, so the review is verification, not first-look). Meejai QAs each handoff.
Migrations apply to production only after the owner approves.
