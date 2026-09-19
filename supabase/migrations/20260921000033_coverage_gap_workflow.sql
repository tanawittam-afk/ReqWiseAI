-- Phase 3 (Gap check), Slice 3, part 3 of 3 — the workflow wiring for `coverage_gap`,
-- now that 20260921000031/32 have committed the enum values this needs.
--
-- Three pieces, each an established pattern extended, not a new one invented:
--
--  1. `enforce_insert_draft()` — extends the IN-list that assigns `workflow_state :=
--     'open'` on insert. Load-bearing: without this, a newly inserted `coverage_gap`
--     item gets `workflow_state = null` instead of `'open'`, and every workflow-
--     filtered query (including the Quality tab's own "open findings"-style list)
--     would silently never see it. Replaces 20260725000016's body verbatim except for
--     this one line.
--
--  2. `is_reviewable_item_type()` (20260725000013) — extends the exclusion list.
--     **A real gap this migration exists to close, not a stylistic mirror**: without
--     this, `coverage_gap` would silently be "reviewable" — `add_manual_requirement()`
--     (20260920000029) uses this exact function to decide which types a human may
--     manually create, and the general `edit_analysis_item()`/status-transition RPCs
--     use it to decide which types their workflow applies to. A `coverage_gap` must
--     only ever be created by the code+AI gap-check pipeline (`origin = 'quality_rule'`)
--     and only ever move through `update_coverage_gap()` below — exactly the same
--     reasoning `open_question`/`quality_finding` already have, extended by one type.
--
--  3. `update_coverage_gap()` — a direct sibling of `update_quality_finding()`
--     (20260725000016_question_and_quality_workflow.sql), "the same shape, different
--     rules" exactly as that migration's own comment already describes the
--     quality_finding/open_question relationship. Copies its body verbatim with the
--     type check and activity-kind mapping swapped to `coverage_gap`/`gap_*`.
--
-- 20260724000001..20260921000030 are applied to the live project and are never edited.

create or replace function is_reviewable_item_type(p_type item_type)
returns boolean
language sql
immutable
as $$
  select p_type not in ('open_question', 'quality_finding', 'coverage_gap');
$$;

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
  if new.item_type in ('open_question', 'quality_finding', 'coverage_gap') then
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
-- update_coverage_gap — the same shape as update_quality_finding, a different type.
-- ---------------------------------------------------------------------------
create or replace function update_coverage_gap(
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
    raise exception 'gap not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not is_project_member(v_project) then
    raise exception 'gap not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not project_is_active(v_project) then
    raise exception 'project is archived and read-only'
      using errcode = 'restrict_violation';
  end if;

  if v_type <> 'coverage_gap' then
    raise exception 'this item is not a coverage gap'
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

  -- Resolving claims the gap was addressed and dismissing claims it was never a real
  -- gap. Both are assertions somebody else will rely on, so both must say why.
  if p_to_state in ('resolved', 'dismissed', 'open') and v_note is null then
    raise exception 'a resolution note is required'
      using errcode = 'check_violation';
  end if;
  if v_note is not null and char_length(v_note) > 4000 then
    raise exception 'a note may be at most 4000 characters'
      using errcode = 'check_violation';
  end if;

  v_kind := case p_to_state
    when 'acknowledged' then 'gap_acknowledged'
    when 'resolved'     then 'gap_resolved'
    when 'dismissed'    then 'gap_dismissed'
    else                     'gap_reopened'
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

revoke execute on function update_coverage_gap(uuid, item_workflow_state, item_workflow_state, text) from public;
grant execute on function update_coverage_gap(uuid, item_workflow_state, item_workflow_state, text) to authenticated;
