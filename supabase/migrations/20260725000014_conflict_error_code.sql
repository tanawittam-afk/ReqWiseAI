-- ReqWiseAI — Slice 5, correction to 20260725000013
--
-- The two optimistic-concurrency refusals were raised with `serialization_failure`
-- (SQLSTATE 40001), which reads correctly but behaves wrongly: PostgREST treats 40001
-- as a *transient* fault and retries the request, so a lost edit surfaced to the
-- browser as "upstream request timeout" after a long wait instead of as a refusal
-- anybody could act on. `scripts/verify-review.mts` check 26 is what caught it.
--
-- A version conflict is a permanent answer, not a retriable one. `PT409` is
-- PostgREST's own convention for "answer this request with HTTP 409 Conflict", which
-- is precisely what has happened, and it is never retried.
--
-- Only the two RAISE statements change. Every check, every parameter and the whole
-- body of both functions are otherwise identical to 20260725000013, which is applied
-- and therefore never edited.

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
