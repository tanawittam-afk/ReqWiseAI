-- ReqWiseAI — Slice 5
-- Requirement editing, human review, approval, and version history.
--
-- Phase 3A (20260724000005) already made three things true at the schema level: items
-- are born 'draft', a content change auto-writes an item_versions snapshot, and a
-- status change must route through review_item(). This migration closes the gaps that
-- a real review workflow exposes, none of which the earlier slice needed:
--
--   1. The transition table allowed 'approved' -> 'implemented' / 'needs_clarification'
--      and 'rejected' -> 'draft'. The product now says approved and rejected are
--      TERMINAL in the MVP, so those three edges are withdrawn. The 'implemented'
--      enum value survives (dropping an enum label rewrites every dependent row); it
--      is simply unreachable until a later slice re-opens it deliberately.
--
--   2. Nothing stopped a project member from PATCHing an approved item's title, an
--      archived project's items, or an item's evidence_class / confidence / display_id
--      straight through PostgREST. The trigger versioned the edit and let it through.
--      Provenance that a client can rewrite is not provenance.
--
--   3. A human review did not survive contact with an edit: an item could be marked
--      'reviewed' and then have its text changed underneath the review, with the
--      status still reading 'reviewed'. The reset now happens inside the trigger, so
--      it holds on EVERY path — the RPC, a hand-rolled PostgREST call, or psql —
--      rather than only in the path the application happens to use.
--
--   4. item_versions.change_reason existed and was never written.
--
-- 20260724000001..12 are applied to the live project and are never edited.

-- ---------------------------------------------------------------------------
-- Which item types take the requirement review workflow.
--
-- open_question and quality_finding are observations ABOUT the analysis, not claims
-- the analysis makes. "Approving" a question is a category error: a question is
-- answered, and a finding is acknowledged or dismissed. Both get their own workflow
-- in a later slice; until then the database refuses to pretend otherwise.
-- ---------------------------------------------------------------------------
create or replace function is_reviewable_item_type(p_type item_type)
returns boolean
language sql
immutable
as $$
  select p_type not in ('open_question', 'quality_finding');
$$;

-- ---------------------------------------------------------------------------
-- Allowed HUMAN review transitions (product spec §4).
--
-- Deliberately absent: 'reviewed' -> 'draft' and 'needs_clarification' -> 'draft'
-- as review ACTIONS. Returning to draft is not something a reviewer chooses; it is
-- what editing the content does to a review that no longer describes it. That reset
-- is performed by guard_item_update() below, which is why it does not appear here —
-- keeping this table exactly the set of moves a person may pick from a menu.
-- ---------------------------------------------------------------------------
create or replace function is_valid_status_transition(p_from item_status, p_to item_status)
returns boolean
language sql
immutable
as $$
  select (p_from, p_to) in (
    ('draft',               'reviewed'),
    ('draft',               'needs_clarification'),
    ('draft',               'rejected'),
    ('needs_clarification', 'reviewed'),
    ('needs_clarification', 'rejected'),
    ('reviewed',            'approved'),
    ('reviewed',            'needs_clarification'),
    ('reviewed',            'rejected')
  );
$$;

-- ---------------------------------------------------------------------------
-- The one gate every UPDATE of analysis_items passes through.
--
-- SECURITY DEFINER, unlike the Phase 3A version: the audit rows this trigger writes
-- (item_versions, review_activities) must be written whether or not the caller's RLS
-- would have allowed them. An edit that succeeds while its history insert is refused
-- would be exactly the silent hole this table exists to prevent.
-- ---------------------------------------------------------------------------
create or replace function guard_item_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  content_changed boolean;
  reset_to_draft  boolean;
  reviewing       boolean;
  v_actor         uuid := auth.uid();
  v_reason        text;
begin
  -- --- identity and evidence are pinned, on every path and for every role --------
  -- These describe what the ANALYSIS found. A human may disagree with a requirement
  -- and rewrite it; a human may not restate what the provider observed, because the
  -- version history would then be a record of a claim nobody ever made.
  if new.id             is distinct from old.id
     or new.project_id      is distinct from old.project_id
     or new.analysis_run_id is distinct from old.analysis_run_id
     or new.item_type       is distinct from old.item_type
     or new.display_id      is distinct from old.display_id
     or new.provider_key    is distinct from old.provider_key
     or new.evidence_class  is distinct from old.evidence_class
     or new.origin          is distinct from old.origin
     or new.confidence      is distinct from old.confidence
     or new.rationale       is distinct from old.rationale
     or new.created_at      is distinct from old.created_at then
    raise exception 'the identity and evidence of an analysis item cannot be changed'
      using errcode = 'restrict_violation';
  end if;

  content_changed :=
       new.title       is distinct from old.title
    or new.description is distinct from old.description
    or new.priority    is distinct from old.priority
    or new.attributes  is distinct from old.attributes;

  -- version_no is derived, never supplied.
  if not content_changed and new.version_no is distinct from old.version_no then
    raise exception 'version_no is set by the database, not by the caller'
      using errcode = 'restrict_violation';
  end if;

  if content_changed then
    if v_actor is null then
      raise exception 'editing a requirement requires an authenticated user'
        using errcode = 'insufficient_privilege';
    end if;
    if old.status in ('approved', 'rejected') then
      raise exception 'an approved or rejected requirement is read-only'
        using errcode = 'restrict_violation';
    end if;
    if not is_reviewable_item_type(old.item_type) then
      raise exception 'this item type uses a different workflow'
        using errcode = 'restrict_violation';
    end if;
    if not exists (
      select 1 from projects where id = old.project_id and status = 'active'
    ) then
      raise exception 'project is archived and read-only'
        using errcode = 'restrict_violation';
    end if;

    -- Set by edit_analysis_item(); empty on any other path, which is honest.
    v_reason := nullif(trim(coalesce(current_setting('reqwise.change_reason', true), '')), '');

    insert into item_versions (project_id, item_id, version_no, snapshot, changed_by, change_reason)
    values (old.project_id, old.id, old.version_no, to_jsonb(old), v_actor, v_reason);
    new.version_no := old.version_no + 1;
  end if;

  -- --- a human review does not survive a material edit --------------------------
  -- Done here rather than in the RPC so it is a property of the table, not of the
  -- code path. An item cannot read 'reviewed' while holding text nobody reviewed.
  reset_to_draft := content_changed and old.status in ('reviewed', 'needs_clarification');

  if reset_to_draft then
    new.status := 'draft';
    insert into review_activities
      (project_id, item_id, actor_id, activity_type, from_status, to_status, comment)
    values
      (old.project_id, old.id, v_actor, 'edit', old.status, 'draft',
       case old.status
         when 'reviewed' then 'Reviewed item changed; returned to draft.'
         else 'Content updated after clarification; returned to draft.'
       end);
  end if;

  if new.status is distinct from old.status and not reset_to_draft then
    reviewing := coalesce(current_setting('reqwise.reviewing', true), 'off') = 'on';
    if not reviewing then
      raise exception 'status may only be changed through review_item(); a direct update is not permitted'
        using errcode = 'restrict_violation';
    end if;
    if not is_valid_status_transition(old.status, new.status) then
      raise exception 'invalid status transition: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- edit_analysis_item — the sanctioned door for a content edit.
--
-- Narrow on purpose: three editable fields and an optional reason. Everything else
-- an edit form might be tempted to send (status, version, evidence class, source
-- references, actor) is absent from the signature, so there is nothing to forge —
-- the parameters a function does not accept are the ones no client can supply.
--
-- p_expected_version is the whole of the optimistic-concurrency story. The caller
-- states which version it read; if the row has moved on, the write is refused and
-- the other person's edit stands.
-- ---------------------------------------------------------------------------
create or replace function edit_analysis_item(
  p_item_id          uuid,
  p_expected_version integer,
  p_title            text,
  p_description      text,
  p_priority         item_priority,
  p_change_reason    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor      uuid := auth.uid();
  v_project    uuid;
  v_type       item_type;
  v_status     item_status;
  v_version    integer;
  v_title      text := trim(coalesce(p_title, ''));
  v_desc       text := trim(coalesce(p_description, ''));
  v_reason     text := nullif(trim(coalesce(p_change_reason, '')), '');
  v_new_status item_status;
  v_new_ver    integer;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  select project_id, item_type, status, version_no
    into v_project, v_type, v_status, v_version
    from analysis_items
   where id = p_item_id and deleted_at is null;

  if v_project is null then
    raise exception 'requirement not found or not visible'
      using errcode = 'no_data_found';
  end if;

  -- Membership is checked explicitly because this function is SECURITY DEFINER and
  -- therefore does NOT run under the caller's RLS. Skipping this would hand every
  -- authenticated user in the world an edit endpoint for every tenant.
  if not is_project_member(v_project) then
    raise exception 'requirement not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not project_is_active(v_project) then
    raise exception 'project is archived and read-only'
      using errcode = 'restrict_violation';
  end if;

  if not is_reviewable_item_type(v_type) then
    raise exception 'this item type uses a different workflow'
      using errcode = 'restrict_violation';
  end if;

  if v_status in ('approved', 'rejected') then
    raise exception 'an approved or rejected requirement is read-only'
      using errcode = 'restrict_violation';
  end if;

  if p_expected_version is null or p_expected_version <> v_version then
    raise exception 'version conflict: expected %, current is %', p_expected_version, v_version
      using errcode = 'serialization_failure';
  end if;

  if char_length(v_title) = 0 or char_length(v_title) > 300 then
    raise exception 'a requirement needs a title of 1 to 300 characters'
      using errcode = 'check_violation';
  end if;
  if char_length(v_desc) = 0 or char_length(v_desc) > 4000 then
    raise exception 'a requirement needs a description of 1 to 4000 characters'
      using errcode = 'check_violation';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'a change reason may be at most 500 characters'
      using errcode = 'check_violation';
  end if;

  -- Read by guard_item_update() when it writes the snapshot. Transaction-local, so a
  -- pooled connection cannot leak one edit's reason into the next.
  perform set_config('reqwise.change_reason', coalesce(v_reason, ''), true);

  update analysis_items
     set title = v_title, description = v_desc, priority = p_priority
   where id = p_item_id;

  perform set_config('reqwise.change_reason', '', true);

  select status, version_no into v_new_status, v_new_ver
    from analysis_items where id = p_item_id;

  return jsonb_build_object(
    'item_id',      p_item_id,
    'version_no',   v_new_ver,
    'status',       v_new_status,
    'status_reset', v_new_status is distinct from v_status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- review_item — replaced.
--
-- The Phase 3A version stamped the actor from the JWT and wrote the audit row, which
-- was the point at the time. It also let a caller: act on an archived project, act on
-- an open question, record a clarification request or a rejection with no note, and
-- act on a status it had not actually seen. Those are the checks a review workflow is
-- made of, so they live in the function rather than in the caller.
--
-- The signature gains p_expected_status and the return type changes, so the old one
-- is dropped rather than replaced in place.
-- ---------------------------------------------------------------------------
drop function if exists review_item(uuid, review_activity_type, item_status, text);

create or replace function review_item(
  p_item_id         uuid,
  p_activity_type   review_activity_type,
  p_to_status       item_status default null,
  p_comment         text default null,
  p_expected_status item_status default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor    uuid := auth.uid();
  v_project  uuid;
  v_type     item_type;
  v_from     item_status;
  v_comment  text := nullif(trim(coalesce(p_comment, '')), '');
  v_activity uuid;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  select project_id, item_type, status into v_project, v_type, v_from
    from analysis_items
   where id = p_item_id and deleted_at is null;

  if v_project is null then
    raise exception 'requirement not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not is_project_member(v_project) then
    raise exception 'requirement not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not project_is_active(v_project) then
    raise exception 'project is archived and read-only'
      using errcode = 'restrict_violation';
  end if;

  -- An approval is a human decision about a REQUIREMENT. Questions and quality
  -- findings are excluded here as well as in the UI, because a workflow enforced only
  -- by a hidden button is not enforced.
  if not is_reviewable_item_type(v_type) then
    raise exception 'this item type uses a different workflow'
      using errcode = 'restrict_violation';
  end if;

  -- Optimistic status check: the reviewer judged the item as it was on screen.
  if p_expected_status is not null and p_expected_status <> v_from then
    raise exception 'status conflict: expected %, current is %', p_expected_status, v_from
      using errcode = 'serialization_failure';
  end if;

  if p_to_status is not null and p_to_status is distinct from v_from then
    if not is_valid_status_transition(v_from, p_to_status) then
      raise exception 'invalid status transition: % -> %', v_from, p_to_status
        using errcode = 'check_violation';
    end if;

    -- A refusal and a request for clarification are instructions to somebody. An
    -- instruction with no words is a dead end for whoever picks the item up next.
    if p_to_status in ('rejected', 'needs_clarification') and v_comment is null then
      raise exception 'a note is required when rejecting or requesting clarification'
        using errcode = 'check_violation';
    end if;

    perform set_config('reqwise.reviewing', 'on', true);
    update analysis_items set status = p_to_status where id = p_item_id;
    perform set_config('reqwise.reviewing', 'off', true);
  end if;

  insert into review_activities
    (project_id, item_id, actor_id, activity_type, from_status, to_status, comment)
  values
    (v_project, p_item_id, v_actor, p_activity_type, v_from, p_to_status, v_comment)
  returning id into v_activity;

  return jsonb_build_object(
    'item_id',     p_item_id,
    'activity_id', v_activity,
    'from_status', v_from,
    'to_status',   coalesce(p_to_status, v_from)
  );
end;
$$;

revoke execute on function is_reviewable_item_type(item_type) from public;
grant execute on function is_reviewable_item_type(item_type) to authenticated;

revoke execute on function edit_analysis_item(uuid, integer, text, text, item_priority, text) from public;
grant execute on function edit_analysis_item(uuid, integer, text, text, item_priority, text) to authenticated;

revoke execute on function review_item(uuid, review_activity_type, item_status, text, item_status) from public;
grant execute on function review_item(uuid, review_activity_type, item_status, text, item_status) to authenticated;
