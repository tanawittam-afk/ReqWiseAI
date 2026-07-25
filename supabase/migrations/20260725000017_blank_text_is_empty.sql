-- ReqWiseAI — Slice 6A, correction
--
-- `trim()` / `btrim()` with one argument removes **spaces only**. Not tabs, not
-- newlines, not carriage returns. Every "a note is required" rule in this schema was
-- written as `nullif(btrim(coalesce(p_text, '')), '')`, which means a note of E'\n\t'
-- counted as words and satisfied the rule.
--
-- `scripts/verify-workflow.mts` check 5 is what caught it: an "answer" of "   \n  "
-- was accepted, because btrim left the newline behind. The slice-5 functions carry the
-- identical defect — their own check happened to use a spaces-only string, so it
-- passed. Both are corrected here rather than only the one the test hit; a rule that is
-- right in one function and wrong in its sibling is worse than one that is wrong twice,
-- because nobody will think to look.
--
-- `blank_to_null()` is the single definition of "this text says nothing", used by all
-- four functions from now on. Everything else in each function is unchanged.
--
-- 20260724000001..16 are applied to the live project and are never edited.

create or replace function blank_to_null(p_text text)
returns text
language sql
immutable
as $$
  -- \s covers space, tab, newline, carriage return, form feed and vertical tab.
  select nullif(regexp_replace(coalesce(p_text, ''), '^\s+|\s+$', '', 'g'), '');
$$;

comment on function blank_to_null(text) is
  'Trims ALL whitespace (not just spaces, unlike btrim/trim) and returns null for text '
  'that says nothing. The single definition of "blank" behind every required-note rule.';

revoke execute on function blank_to_null(text) from public;
grant execute on function blank_to_null(text) to authenticated;

-- ---------------------------------------------------------------------------
-- resolve_open_question — v_answer now uses blank_to_null()
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
  v_answer   text := blank_to_null(p_answer);
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

  if p_expected_state is null or p_expected_state <> v_from then
    raise exception 'workflow conflict: expected %, current is %', p_expected_state, v_from
      using errcode = 'PT409';
  end if;

  if not is_valid_question_transition(v_from, p_to_state) then
    raise exception 'invalid workflow transition: % -> %', v_from, p_to_state
      using errcode = 'check_violation';
  end if;

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
    'item_id',      p_item_id,
    'activity_id',  v_activity,
    'from_state',   v_from,
    'to_state',     p_to_state,
    'follow_up_on', case when p_to_state = 'deferred' then p_follow_up_on else null end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- update_quality_finding — v_note now uses blank_to_null()
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
  v_note     text := blank_to_null(p_note);
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

-- ---------------------------------------------------------------------------
-- review_item — same correction to its comment, nothing else changed.
-- ---------------------------------------------------------------------------
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
  v_comment  text := blank_to_null(p_comment);
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

  if not is_reviewable_item_type(v_type) then
    raise exception 'this item type uses a different workflow'
      using errcode = 'restrict_violation';
  end if;

  if p_expected_status is not null and p_expected_status <> v_from then
    raise exception 'status conflict: expected %, current is %', p_expected_status, v_from
      using errcode = 'PT409';
  end if;

  if p_to_status is not null and p_to_status is distinct from v_from then
    if not is_valid_status_transition(v_from, p_to_status) then
      raise exception 'invalid status transition: % -> %', v_from, p_to_status
        using errcode = 'check_violation';
    end if;

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

-- ---------------------------------------------------------------------------
-- edit_analysis_item — title, description and change reason all use it now.
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
  v_title      text := blank_to_null(p_title);
  v_desc       text := blank_to_null(p_description);
  v_reason     text := blank_to_null(p_change_reason);
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
      using errcode = 'PT409';
  end if;

  if v_title is null or char_length(v_title) > 300 then
    raise exception 'a requirement needs a title of 1 to 300 characters'
      using errcode = 'check_violation';
  end if;
  if v_desc is null or char_length(v_desc) > 4000 then
    raise exception 'a requirement needs a description of 1 to 4000 characters'
      using errcode = 'check_violation';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'a change reason may be at most 500 characters'
      using errcode = 'check_violation';
  end if;

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
