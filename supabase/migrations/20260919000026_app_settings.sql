-- ReqWiseAI — Phase 1, Slice 4: the /admin page (app_settings, sign-up switch, usage
-- view and reset)
--
-- "No admin role in the database" is an explicit, already-agreed design decision (see
-- the master plan's "Settled decisions — Users and access"): the one admin is identified
-- by comparing the signed-in user's email to ADMIN_EMAIL, a server-only Vercel env var.
-- Postgres cannot read a Vercel env var, so nothing in this file can enforce "admin
-- only" on its own — that check happens once, in Node, in lib/admin/guard.ts, before any
-- of the three privileged functions below are ever called. This is why those three are
-- deliberately NOT granted to `authenticated`, unlike every other RPC in this schema
-- (see each function's own comment for why).
--
-- WHY KEY/VALUE, NOT A SINGLETON ROW: a future setting never needs a new migration to
-- add a column — just a new key. `sign_up_enabled` is the only key today.
--
-- WHY NO CLIENT-FACING RLS POLICY AT ALL, not even the toggle's read: a blanket
-- `for select using (true)` would expose every future key added to this table by
-- default, not just this one boolean. sign_up_is_enabled() below hand-picks exactly the
-- one value the sign-up page needs, and nothing else this table will ever hold.
--
-- The usage view and reset read/write the EXISTING user_daily_usage table (Slice 1) —
-- its own migration header already earmarked this; no new usage table here.

create table app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

alter table app_settings enable row level security;

-- No select/insert/update/delete policy for any client role — see the header comment.
-- Every access goes only through the functions below.

insert into app_settings (key, value) values ('sign_up_enabled', 'true'::jsonb)
  on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- sign_up_is_enabled — the sign-up page's door. Called BEFORE a session exists, so it
-- deliberately skips the usual `auth.uid() is null` refusal every other function in this
-- schema starts with — a future reader adding that check back in would silently lock out
-- every real sign-up. Defaults to true if the row is somehow missing: a missing row must
-- fail OPEN (sign-ups allowed), never silently closed with no way to tell why.
-- ---------------------------------------------------------------------------
create or replace function sign_up_is_enabled()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (value #>> '{}')::boolean from app_settings where key = 'sign_up_enabled'),
    true
  );
$$;

revoke execute on function sign_up_is_enabled() from public;
grant execute on function sign_up_is_enabled() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_sign_up_enabled / admin_list_daily_usage / admin_reset_daily_usage — the
-- three privileged doors.
--
-- NO GRANT TO `authenticated` ON ANY OF THESE — a first in this schema. A function
-- granted to `authenticated` is callable by any signed-in user with their own session;
-- since none of these can verify ADMIN_EMAIL themselves, granting them that way would
-- make "admin only" a Node-side UI suggestion, not a real boundary. Instead they stay
-- reachable ONLY through the service-role client (lib/supabase/admin.ts), and only after
-- lib/admin/guard.ts has already compared the caller's email to ADMIN_EMAIL in Node, on
-- that exact request. `p_admin_user_id` on the setter is an audit trail
-- (app_settings.updated_by) only — not an access check; Postgres has no way to verify it
-- against ADMIN_EMAIL, so the real check already happened before this function was ever
-- called.
-- ---------------------------------------------------------------------------
create or replace function admin_set_sign_up_enabled(p_enabled boolean, p_admin_user_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into app_settings (key, value, updated_at, updated_by)
    values ('sign_up_enabled', to_jsonb(p_enabled), now(), p_admin_user_id)
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
$$;

revoke execute on function admin_set_sign_up_enabled(boolean, uuid) from public, authenticated;

-- admin_list_daily_usage joins to auth.users for the email column, which is not exposed
-- through PostgREST — only reachable from inside a security definer function.
create or replace function admin_list_daily_usage()
returns table(user_id uuid, email text, analyses_count integer, updated_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.user_id, au.email, u.analyses_count, u.updated_at
  from user_daily_usage u
  join auth.users au on au.id = u.user_id
  where u.usage_date = (now() at time zone 'Asia/Bangkok')::date
  order by u.analyses_count desc, au.email asc;
$$;

revoke execute on function admin_list_daily_usage() from public, authenticated;

-- A no-op, not an error, if the target has no row for today — same shape as
-- decrement_daily_usage() and delete_my_gemini_key().
create or replace function admin_reset_daily_usage(p_target_user_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update user_daily_usage
     set analyses_count = 0, updated_at = now()
   where user_id = p_target_user_id
     and usage_date = (now() at time zone 'Asia/Bangkok')::date;
$$;

revoke execute on function admin_reset_daily_usage(uuid) from public, authenticated;
