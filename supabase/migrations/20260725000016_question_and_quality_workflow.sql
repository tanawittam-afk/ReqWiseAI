-- ReqWiseAI — Slice 6A, part 2 of 2
-- Open-question resolution and quality-finding workflow.
--
-- Slice 5 deliberately locked both types out of the requirement review workflow
-- (`is_reviewable_item_type`): a question is answered and a finding is acknowledged,
-- neither is "approved". This migration gives each its own workflow, and keeps that
-- lock exactly as it is — the two paths never meet.
--
-- WHY NO THIRTEENTH TABLE (DATA-MODEL §C.12). A separate `item_workflows` table would
-- buy nothing the existing model cannot already guarantee:
--   * audit trail — `review_activities` is already append-only, already scoped by
--     project, already stamps the actor from the JWT, and already carries a comment.
--     It gains two nullable columns here and nothing else.
--   * authorization — every policy is written against `analysis_items.project_id`. A
--     new table would need its own RLS, its own membership helper and its own
--     immutability triggers, all restating rules that already hold.
--   * type-specific state — a CHECK constraint keyed on `item_type` makes the
--     impossible states unrepresentable, which is stronger than a foreign key to a
--     side table that says nothing about which rows may have one.
--   * query performance — the workspace reads every item of a run in one query. A
--     side table makes that a join for a value that is one-to-one with the row.
--   * integrity — a one-to-one side table can drift (an item with two workflow rows,
--     or none). Columns on the row cannot.
-- The 12-table model stands.

-- ---------------------------------------------------------------------------
-- One enum for both workflows, because they are one column.
--
-- Which labels a given row may hold is decided by a CHECK on item_type below, so a
-- question can never be 'resolved' and a finding can never be 'answered'. Two enums
-- would need two nullable columns and a constraint saying exactly one is populated —
-- more machinery for the same guarantee.
-- ---------------------------------------------------------------------------
create type item_workflow_state as enum (
  -- shared
  'open',
  -- open_question
  'answered',
  'deferred',
  'not_applicable',
  -- quality_finding
  'acknowledged',
  'resolved',
  'dismissed'
);

alter table analysis_items
  add column workflow_state  item_workflow_state,
  add column resolution_text text,
  add column resolved_at     timestamptz,
  add column resolved_by     uuid references auth.users (id),
  add column follow_up_on    date;

comment on column analysis_items.resolution_text is
  'The stakeholder answer, deferral reason, dismissal reason or resolution note that '
  'produced the current workflow_state. Cleared on reopen; the text itself survives in '
  'review_activities, which is append-only.';

-- Existing questions and findings predate the column and are all still open. The guard
-- trigger is stood down for the backfill so it does not stamp updated_at on rows nobody
-- touched; it is re-enabled immediately, inside the same transaction.
alter table analysis_items disable trigger analysis_items_guard_update;
update analysis_items
   set workflow_state = 'open'
 where item_type in ('open_question', 'quality_finding')
   and workflow_state is null;
alter table analysis_items enable trigger analysis_items_guard_update;

-- ---------------------------------------------------------------------------
-- Impossible states, made unrepresentable.
-- ---------------------------------------------------------------------------

-- A reviewable requirement carries no workflow at all; each deferred type carries only
-- its own labels. `is not null and in (...)` rather than a bare `in`, because a CHECK
-- passes on NULL and a question with no state is exactly the drift being prevented.
alter table analysis_items
  add constraint analysis_items_workflow_state_by_type check (
    case item_type
      when 'open_question' then
        workflow_state is not null
        and workflow_state in ('open', 'answered', 'deferred', 'not_applicable')
      when 'quality_finding' then
        workflow_state is not null
        and workflow_state in ('open', 'acknowledged', 'resolved', 'dismissed')
      else workflow_state is null
    end
  );

-- Resolution fields belong to the two workflow types and to nobody else.
alter table analysis_items
  add constraint analysis_items_resolution_by_type check (
    item_type in ('open_question', 'quality_finding')
    or (resolution_text is null and resolved_at is null
        and resolved_by is null and follow_up_on is null)
  );

-- Every state that represents a decision carries the words behind it. 'open' and
-- 'acknowledged' are the two that do not: nothing has been decided yet, and
-- acknowledging is explicitly "seen, not fixed" (product spec §5).
alter table analysis_items
  add constraint analysis_items_resolution_text_required check (
    workflow_state is null
    or workflow_state in ('open', 'acknowledged')
    or (resolution_text is not null and btrim(resolution_text) <> '')
  );

-- Who and when travel together, or not at all.
alter table analysis_items
  add constraint analysis_items_resolved_stamp check (
    (resolved_at is null) = (resolved_by is null)
  );

-- A follow-up date is a property of deferring something.
alter table analysis_items
  add constraint analysis_items_follow_up_only_deferred check (
    follow_up_on is null or workflow_state = 'deferred'
  );

-- The workspace reads a run's items and filters by workflow state; this keeps the
-- questions/findings tabs a lookup rather than a scan as runs accumulate.
create index analysis_items_workflow_state_idx
  on analysis_items (project_id, workflow_state)
  where workflow_state is not null;

-- ---------------------------------------------------------------------------
-- review_activities records which workflow states a transition moved between.
--
-- `from_status`/`to_status` are typed `item_status` and describe the *review* workflow;
-- reusing them for workflow states would mean widening that enum with labels that make
-- no sense for a requirement. Two nullable columns are the honest shape: a row carries
-- either a review transition or a workflow transition, never both.
-- ---------------------------------------------------------------------------
alter table review_activities
  add column from_workflow_state item_workflow_state,
  add column to_workflow_state   item_workflow_state;

-- ---------------------------------------------------------------------------
-- Allowed transitions (product spec §4 and §5).
-- ---------------------------------------------------------------------------
create or replace function is_valid_question_transition(
  p_from item_workflow_state,
  p_to   item_workflow_state
)
returns boolean
language sql
immutable
as $$
  select (p_from, p_to) in (
    ('open',           'answered'),
    ('open',           'deferred'),
    ('open',           'not_applicable'),
    ('deferred',       'open'),
    ('deferred',       'answered'),
    ('deferred',       'not_applicable'),
    ('answered',       'open'),
    ('not_applicable', 'open')
  );
$$;

create or replace function is_valid_finding_transition(
  p_from item_workflow_state,
  p_to   item_workflow_state
)
returns boolean
language sql
immutable
as $$
  select (p_from, p_to) in (
    ('open',         'acknowledged'),
    ('open',         'resolved'),
    ('open',         'dismissed'),
    ('acknowledged', 'resolved'),
    ('acknowledged', 'dismissed'),
    ('acknowledged', 'open'),
    ('resolved',     'open'),
    ('dismissed',    'open')
  );
$$;

-- ---------------------------------------------------------------------------
-- AI-created questions and findings start 'open'. Nothing may insert another state,
-- and no requirement may be inserted carrying one.
--
-- Replaces the Phase 3A body, which enforced status='draft' and version_no=1; both
-- rules are preserved verbatim.
-- ---------------------------------------------------------------------------
create or replace function enforce_insert_draft()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'draft' then
    raise exception 'analysis_items must be created with status ''draft'' (got ''%'')', new.status
      using errcode = 'check_violation';
  end if;
  if new.version_no <> 1 then
    raise exception 'analysis_items must be created at version 1 (got %)', new.version_no
      using errcode = 'check_violation';
  end if;

  -- Assigned rather than validated: a provider that offers a workflow state is not
  -- refused, it is ignored. There is no state an analysis can legitimately claim.
  if new.item_type in ('open_question', 'quality_finding') then
    new.workflow_state := 'open';
  else
    new.workflow_state := null;
  end if;
  new.resolution_text := null;
  new.resolved_at     := null;
  new.resolved_by     := null;
  new.follow_up_on    := null;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- guard_item_update — extended, not replaced in spirit.
--
-- Identical to 20260725000013 except for the workflow block: the five workflow columns
-- join status in the set that may only change through their own RPC. Everything else —
-- the pinned identity and evidence columns, the version snapshot, the review reset —
-- is unchanged.
-- ---------------------------------------------------------------------------
create or replace function guard_item_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  content_changed  boolean;
  workflow_changed boolean;
  reset_to_draft   boolean;
  reviewing        boolean;
  in_workflow      boolean;
  v_actor          uuid := auth.uid();
  v_reason         text;
begin
  if new.id                 is distinct from old.id
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

  -- The workflow columns move only through resolve_open_question() /
  -- update_quality_finding(), which set this transaction-local flag. Without it an
  -- answer could be written with no activity row beside it, which is the one thing
  -- an append-only audit log cannot survive.
  workflow_changed :=
       new.workflow_state  is distinct from old.workflow_state
    or new.resolution_text is distinct from old.resolution_text
    or new.resolved_at     is distinct from old.resolved_at
    or new.resolved_by     is distinct from old.resolved_by
    or new.follow_up_on    is distinct from old.follow_up_on;

  if workflow_changed then
    in_workflow := coalesce(current_setting('reqwise.workflow', true), 'off') = 'on';
    if not in_workflow then
      raise exception 'the question and quality workflow may only be changed through its own action; a direct update is not permitted'
        using errcode = 'restrict_violation';
    end if;
  end if;

  content_changed :=
       new.title       is distinct from old.title
    or new.description is distinct from old.description
    or new.priority    is distinct from old.priority
    or new.attributes  is distinct from old.attributes;

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

    v_reason := nullif(trim(coalesce(current_setting('reqwise.change_reason', true), '')), '');

    insert into item_versions (project_id, item_id, version_no, snapshot, changed_by, change_reason)
    values (old.project_id, old.id, old.version_no, to_jsonb(old), v_actor, v_reason);
    new.version_no := old.version_no + 1;
  end if;

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
-- resolve_open_question — the one door a question's workflow moves through.
--
-- Narrow like edit_analysis_item(): the item, the state the caller believes it is in,
-- the state it should reach, the words behind the decision, and an optional follow-up
-- date. No actor, no project, no organization, no run, no evidence, no review status,
-- no version — a parameter the function does not accept cannot be forged.
-- ---------------------------------------------------------------------------
create or replace function resolve_open_question(
  p_item_id        uuid,
  p_expected_state item_workflow_state,
  p_to_state       item_workflow_state,
  p_answer         text default null,
  p_follow_up_on   date default null
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
  v_from     item_workflow_state;
  v_answer   text := nullif(btrim(coalesce(p_answer, '')), '');
  v_activity uuid;
  v_kind     review_activity_type;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  select project_id, item_type, workflow_state
    into v_project, v_type, v_from
    from analysis_items
   where id = p_item_id and deleted_at is null;

  if v_project is null then
    raise exception 'question not found or not visible'
      using errcode = 'no_data_found';
  end if;

  -- SECURITY DEFINER does NOT run under the caller's RLS, so membership is checked
  -- explicitly. Skipping it would hand every authenticated user an endpoint for every
  -- tenant's questions.
  if not is_project_member(v_project) then
    raise exception 'question not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not project_is_active(v_project) then
    raise exception 'project is archived and read-only'
      using errcode = 'restrict_violation';
  end if;

  if v_type <> 'open_question' then
    raise exception 'this item is not a stakeholder question'
      using errcode = 'restrict_violation';
  end if;

  -- Optimistic concurrency. PT409, not serialization_failure: PostgREST retries 40001
  -- as a transient fault and turns a refusal into a timeout (see 20260725000014).
  if p_expected_state is null or p_expected_state <> v_from then
    raise exception 'workflow conflict: expected %, current is %', p_expected_state, v_from
      using errcode = 'PT409';
  end if;

  if not is_valid_question_transition(v_from, p_to_state) then
    raise exception 'invalid workflow transition: % -> %', v_from, p_to_state
      using errcode = 'check_violation';
  end if;

  -- Every question transition carries words. Answering with nothing is not an answer;
  -- deferring, dismissing as not applicable and reopening are all instructions to
  -- whoever picks the question up next.
  if v_answer is null then
    raise exception 'an answer or reason is required'
      using errcode = 'check_violation';
  end if;
  if char_length(v_answer) > 4000 then
    raise exception 'an answer may be at most 4000 characters'
      using errcode = 'check_violation';
  end if;

  if p_follow_up_on is not null and p_to_state <> 'deferred' then
    raise exception 'a follow-up date only applies to a deferred question'
      using errcode = 'check_violation';
  end if;

  v_kind := case p_to_state
    when 'answered'       then 'question_answered'
    when 'deferred'       then 'question_deferred'
    when 'not_applicable' then 'question_not_applicable'
    else                       'question_reopened'
  end::review_activity_type;

  perform set_config('reqwise.workflow', 'on', true);

  update analysis_items
     set workflow_state  = p_to_state,
         -- Reopening clears the decision but never the record of it: the answer that
         -- was given survives in the activity row written when it was given.
         resolution_text = case when p_to_state = 'open' then null else v_answer end,
         resolved_at     = case when p_to_state = 'open' then null else now() end,
         resolved_by     = case when p_to_state = 'open' then null else v_actor end,
         follow_up_on    = case when p_to_state = 'deferred' then p_follow_up_on else null end
   where id = p_item_id;

  perform set_config('reqwise.workflow', 'off', true);

  insert into review_activities
    (project_id, item_id, actor_id, activity_type,
     from_workflow_state, to_workflow_state, comment)
  values
    (v_project, p_item_id, v_actor, v_kind, v_from, p_to_state, v_answer)
  returning id into v_activity;

  return jsonb_build_object(
    'item_id',        p_item_id,
    'activity_id',    v_activity,
    'from_state',     v_from,
    'to_state',       p_to_state,
    'follow_up_on',   case when p_to_state = 'deferred' then p_follow_up_on else null end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- update_quality_finding — the same shape, different rules.
--
-- The one asymmetry with questions: 'acknowledged' means "seen, not fixed", so it is
-- the single transition whose note is optional.
-- ---------------------------------------------------------------------------
create or replace function update_quality_finding(
  p_item_id        uuid,
  p_expected_state item_workflow_state,
  p_to_state       item_workflow_state,
  p_note           text default null
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
  v_from     item_workflow_state;
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_activity uuid;
  v_kind     review_activity_type;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  select project_id, item_type, workflow_state
    into v_project, v_type, v_from
    from analysis_items
   where id = p_item_id and deleted_at is null;

  if v_project is null then
    raise exception 'finding not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not is_project_member(v_project) then
    raise exception 'finding not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not project_is_active(v_project) then
    raise exception 'project is archived and read-only'
      using errcode = 'restrict_violation';
  end if;

  if v_type <> 'quality_finding' then
    raise exception 'this item is not a quality finding'
      using errcode = 'restrict_violation';
  end if;

  if p_expected_state is null or p_expected_state <> v_from then
    raise exception 'workflow conflict: expected %, current is %', p_expected_state, v_from
      using errcode = 'PT409';
  end if;

  if not is_valid_finding_transition(v_from, p_to_state) then
    raise exception 'invalid workflow transition: % -> %', v_from, p_to_state
      using errcode = 'check_violation';
  end if;

  -- Resolving claims the problem is fixed and dismissing claims it was never a
  -- problem. Both are assertions somebody else will rely on, so both must say why.
  if p_to_state in ('resolved', 'dismissed', 'open') and v_note is null then
    raise exception 'a resolution note is required'
      using errcode = 'check_violation';
  end if;
  if v_note is not null and char_length(v_note) > 4000 then
    raise exception 'a note may be at most 4000 characters'
      using errcode = 'check_violation';
  end if;

  v_kind := case p_to_state
    when 'acknowledged' then 'quality_acknowledged'
    when 'resolved'     then 'quality_resolved'
    when 'dismissed'    then 'quality_dismissed'
    else                     'quality_reopened'
  end::review_activity_type;

  perform set_config('reqwise.workflow', 'on', true);

  update analysis_items
     set workflow_state  = p_to_state,
         resolution_text = case
                             when p_to_state in ('open', 'acknowledged') then null
                             else v_note
                           end,
         resolved_at     = case
                             when p_to_state in ('resolved', 'dismissed') then now()
                             else null
                           end,
         resolved_by     = case
                             when p_to_state in ('resolved', 'dismissed') then v_actor
                             else null
                           end
   where id = p_item_id;

  perform set_config('reqwise.workflow', 'off', true);

  insert into review_activities
    (project_id, item_id, actor_id, activity_type,
     from_workflow_state, to_workflow_state, comment)
  values
    (v_project, p_item_id, v_actor, v_kind, v_from, p_to_state, v_note)
  returning id into v_activity;

  return jsonb_build_object(
    'item_id',     p_item_id,
    'activity_id', v_activity,
    'from_state',  v_from,
    'to_state',    p_to_state
  );
end;
$$;

revoke execute on function is_valid_question_transition(item_workflow_state, item_workflow_state) from public;
revoke execute on function is_valid_finding_transition(item_workflow_state, item_workflow_state) from public;
grant execute on function is_valid_question_transition(item_workflow_state, item_workflow_state) to authenticated;
grant execute on function is_valid_finding_transition(item_workflow_state, item_workflow_state) to authenticated;

revoke execute on function resolve_open_question(uuid, item_workflow_state, item_workflow_state, text, date) from public;
grant execute on function resolve_open_question(uuid, item_workflow_state, item_workflow_state, text, date) to authenticated;

revoke execute on function update_quality_finding(uuid, item_workflow_state, item_workflow_state, text) from public;
grant execute on function update_quality_finding(uuid, item_workflow_state, item_workflow_state, text) to authenticated;
