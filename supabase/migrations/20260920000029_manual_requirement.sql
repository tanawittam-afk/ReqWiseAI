-- ReqWiseAI — Phase 2, Slice 4 (part 2 of 2): the manual "add requirement" write path.
--
-- Until now `analysis_items` had exactly one door: `persist_analysis_result()`, always
-- from an AI analysis run, always with a real `analysis_run_id`. This migration opens
-- a second, narrow door for a human-authored item — same discipline as every other RPC
-- in this schema (SECURITY DEFINER, explicit membership/active checks, no direct
-- client INSERT even though nothing here would technically need a new RLS policy to
-- forbid one — `analysis_items` still has none).
--
-- WHY `analysis_run_id` BECOMES NULLABLE: a manually-added item was not produced by any
-- one run. The composite FK `(analysis_run_id, project_id) references analysis_runs
-- (id, project_id)` already tolerates a null `analysis_run_id` under ordinary
-- multi-column FK semantics (any null component vacuously satisfies the constraint) —
-- this ALTER only removes the NOT NULL, the FK itself is untouched.
--
-- WHY status/origin ARE HARDCODED IN THE FUNCTION, NOT TAKEN AS PARAMETERS: exactly
-- `edit_analysis_item()`'s own reasoning — the parameters a function does not accept
-- are the ones no client can supply. A manual item always starts 'draft' (enforced
-- again, redundantly, by enforce_insert_draft() — belt and suspenders) and always
-- carries origin = 'manual', never something a caller could spoof as 'source_analysis'.
--
-- WHY open_question/quality_finding ARE REFUSED HERE: those two types have their own
-- origins ('quality_rule') and their own workflow — is_reviewable_item_type() (already
-- defined, item_editing_and_review.sql) is the exact boundary this reuses, unchanged.

alter table analysis_items alter column analysis_run_id drop not null;

create or replace function add_manual_requirement(
  p_project        uuid,
  p_item_type      item_type,
  p_title          text,
  p_description    text,
  p_priority       item_priority,
  p_source         uuid default null,
  p_excerpt        text default null,
  p_evidence_class evidence_class default 'stated'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor      uuid := auth.uid();
  v_title      text := trim(coalesce(p_title, ''));
  v_desc       text := trim(coalesce(p_description, ''));
  v_excerpt    text := nullif(trim(coalesce(p_excerpt, '')), '');
  v_prefix     text;
  v_range      record;
  v_display_id text;
  v_item_id    uuid;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  if not is_project_member(p_project) then
    raise exception 'project not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not project_is_active(p_project) then
    raise exception 'project is archived and read-only'
      using errcode = 'restrict_violation';
  end if;

  if not is_reviewable_item_type(p_item_type) then
    raise exception 'this item type uses a different workflow'
      using errcode = 'restrict_violation';
  end if;

  if char_length(v_title) = 0 or char_length(v_title) > 300 then
    raise exception 'a requirement needs a title of 1 to 300 characters'
      using errcode = 'check_violation';
  end if;
  if char_length(v_desc) = 0 or char_length(v_desc) > 4000 then
    raise exception 'a requirement needs a description of 1 to 4000 characters'
      using errcode = 'check_violation';
  end if;

  -- An 'assumed' item citing a specific excerpt is a contradiction — the same rule
  -- persist_analysis_result() enforces on every AI-written item.
  if p_evidence_class = 'assumed' and v_excerpt is not null then
    raise exception 'an assumed item may not carry a source excerpt'
      using errcode = 'check_violation';
  end if;

  -- A cited source must belong to the same project — never trust the id alone.
  if p_source is not null and not exists (
    select 1 from source_documents where id = p_source and project_id = p_project
  ) then
    raise exception 'source not found or not visible'
      using errcode = 'no_data_found';
  end if;

  v_prefix := display_id_prefix(p_item_type);
  select * into v_range from allocate_display_number_range(p_project, v_prefix, 1);
  v_display_id := v_prefix || '-' || lpad(v_range.start_number::text, 3, '0');

  insert into analysis_items (
    project_id, analysis_run_id, item_type, display_id, provider_key, title,
    description, priority, status, evidence_class, origin, confidence, attributes
  ) values (
    p_project, null, p_item_type, v_display_id, 'manual-' || v_display_id, v_title,
    v_desc, p_priority, 'draft', p_evidence_class, 'manual', 1.0, '{}'::jsonb
  )
  returning id into v_item_id;

  if p_source is not null and v_excerpt is not null then
    insert into item_source_references (
      project_id, item_id, source_document_id, excerpt, start_offset, end_offset,
      evidence_strength, offset_verified
    ) values (
      p_project, v_item_id, p_source, v_excerpt, null, null, null, false
    );
  end if;

  return jsonb_build_object('item_id', v_item_id, 'display_id', v_display_id);
end;
$$;

revoke execute on function add_manual_requirement(uuid, item_type, text, text, item_priority, uuid, text, evidence_class) from public;
grant execute on function add_manual_requirement(uuid, item_type, text, text, item_priority, uuid, text, evidence_class) to authenticated;
