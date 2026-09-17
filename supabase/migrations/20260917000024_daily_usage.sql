-- ReqWiseAI — Phase 1, Slice 1: per-user daily analysis limit
--
-- Sign-up is open and nothing limits usage today. This is the narrowest possible fix:
-- a per-user, per-Bangkok-day counter with a hard limit, enforced atomically in the
-- database rather than read-then-write from Node (which would race under concurrent
-- requests from the same user).
--
-- WHY A NEW TABLE keyed (user_id, usage_date), not a column on profiles: the row's
-- lifecycle resets daily and is disposable — profiles is durable per-user state with a
-- completely different query pattern (one row ever, not one row per day).
--
-- WHY THE LIMIT IS A PARAMETER (p_limit) to the RPC, not a constant baked into SQL: the
-- single source of truth for "10" is lib/config/limits.ts on the TypeScript side, used
-- both to call this function and to render the UI copy. The database enforces whatever
-- limit it is told, so the two can never drift silently.
--
-- WHY NO INSERT/UPDATE/DELETE POLICY: exactly like change_requests and analysis_items,
-- every write goes through a SECURITY DEFINER RPC below. A client can read its own row
-- to render "N of 10 left today", but never write it directly — the atomic
-- check-and-increment is the entire point, and a direct UPDATE would race it.
--
-- Own-Gemini-key bypass (Slice 3) and the admin usage view / reset (a separate slice)
-- are deliberately not built here. This table already carries what both need
-- (analyses_count per user per day); neither requires a schema change.

create table user_daily_usage (
  user_id        uuid not null references auth.users (id) on delete cascade,
  usage_date     date not null,
  analyses_count integer not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table user_daily_usage enable row level security;

create policy user_daily_usage_select_self on user_daily_usage
  for select using (user_id = auth.uid());

-- No insert/update/delete policy for any client role — writes go only through the
-- RPCs below.

-- ---------------------------------------------------------------------------
-- increment_daily_usage — the check-and-spend door.
--
-- One statement does the atomic work: insert-if-absent, then UPDATE ... WHERE
-- analyses_count < p_limit, so a burst of concurrent requests from the same user can
-- never push the count past the limit (the WHERE clause is evaluated under the row's
-- own update lock, not a separate read). `returning ... into` is null exactly when the
-- WHERE clause matched no row — i.e. the caller was already at the limit — which is
-- how the function tells "spent" from "refused" without a second round trip.
-- ---------------------------------------------------------------------------
create or replace function increment_daily_usage(p_limit integer)
returns table(allowed boolean, remaining integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user  uuid := auth.uid();
  v_date  date := (now() at time zone 'Asia/Bangkok')::date;
  v_count integer;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;

  insert into user_daily_usage (user_id, usage_date) values (v_user, v_date)
    on conflict (user_id, usage_date) do nothing;

  update user_daily_usage
     set analyses_count = analyses_count + 1, updated_at = now()
   where user_id = v_user and usage_date = v_date and analyses_count < p_limit
  returning analyses_count into v_count;

  if v_count is null then
    select analyses_count into v_count from user_daily_usage
     where user_id = v_user and usage_date = v_date;
    return query select false, greatest(p_limit - v_count, 0);
  end if;

  return query select true, greatest(p_limit - v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- decrement_daily_usage — the refund door.
--
-- Called only when an increment already succeeded but the analysis it paid for then
-- failed (provider error, persistence failure) — the caller should not lose a slot to
-- a run that produced nothing. Floored at zero so a refund can never go negative, and
-- scoped to "today" the same way increment is: a refund after a Bangkok-midnight
-- rollover would otherwise create a stray row for a day nothing was spent on.
-- ---------------------------------------------------------------------------
create or replace function decrement_daily_usage()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_date date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;

  update user_daily_usage
     set analyses_count = greatest(analyses_count - 1, 0), updated_at = now()
   where user_id = v_user and usage_date = v_date;
end;
$$;

revoke execute on function increment_daily_usage(integer) from public;
grant execute on function increment_daily_usage(integer) to authenticated;

revoke execute on function decrement_daily_usage() from public;
grant execute on function decrement_daily_usage() to authenticated;
