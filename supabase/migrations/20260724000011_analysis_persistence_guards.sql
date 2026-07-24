-- ReqWiseAI — Slice 4
-- Defense in depth for persist_analysis_result(): the evidence rule ("an assumed
-- item may carry no source reference" — lib/validation/evidence.ts) is already
-- enforced by validateAnalysis() before this function is ever called, but every
-- other guard in this schema is also asserted a second time at the boundary that
-- writes (20260724000005, 20260724000008). This closes the same gap here, so a
-- future caller of the RPC — not just today's server action — cannot smuggle an
-- unsupported claim wearing a citation.
--
-- 20260724000001..10 are applied to the live project and are never edited.

create or replace function persist_analysis_result(
  p_project           uuid,
  p_source            uuid,
  p_request_key       text,
  p_provider          text,
  p_model             text,
  p_prompt_version    text,
  p_schema_version    text,
  p_output_lang       output_lang,
  p_validation_status run_validation_status,
  p_raw_output        jsonb,
  p_validated_output  jsonb,
  p_error             jsonb,
  p_items             jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor           uuid := auth.uid();
  v_existing_id     uuid;
  v_existing_status run_validation_status;
  v_run_id          uuid;
  v_item            jsonb;
  v_item_type       item_type;
  v_next_n          integer;
  v_display_id      text;
  v_new_item_id     uuid;
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

  if not exists (
    select 1 from source_documents where id = p_source and project_id = p_project
  ) then
    raise exception 'source not found in this project'
      using errcode = 'no_data_found';
  end if;

  if p_request_key is not null then
    select id, validation_status into v_existing_id, v_existing_status
      from analysis_runs
     where project_id = p_project and request_key = p_request_key;

    if v_existing_id is not null then
      return jsonb_build_object(
        'run_id', v_existing_id,
        'validation_status', v_existing_status,
        'duplicate', true
      );
    end if;
  end if;

  perform 1 from projects where id = p_project for update;

  insert into analysis_runs (
    project_id, source_document_id, provider, model, prompt_version, schema_version,
    output_lang, validation_status, raw_provider_output, validated_output, error,
    request_key, created_by
  ) values (
    p_project, p_source, p_provider, p_model, p_prompt_version, p_schema_version,
    p_output_lang, p_validation_status, p_raw_output, p_validated_output, p_error,
    p_request_key, v_actor
  )
  returning id into v_run_id;

  if p_validation_status = 'valid' and jsonb_array_length(p_items) > 0 then
    create temporary table if not exists persist_item_ids (
      local_key text primary key,
      item_id   uuid not null
    ) on commit drop;
    create temporary table if not exists persist_type_counters (
      item_type item_type primary key,
      next_n    integer not null
    ) on commit drop;
    truncate persist_item_ids;
    truncate persist_type_counters;

    for v_item in select * from jsonb_array_elements(p_items)
    loop
      -- An unsupported claim may not cite evidence — same rule as
      -- lib/validation/evidence.ts, asserted again at the write boundary.
      if v_item ->> 'evidence_class' = 'assumed'
         and jsonb_array_length(coalesce(v_item -> 'source_references', '[]'::jsonb)) > 0 then
        raise exception 'an assumed item may not carry a source reference'
          using errcode = 'check_violation';
      end if;

      v_item_type := (v_item ->> 'item_type')::item_type;

      select next_n into v_next_n from persist_type_counters where item_type = v_item_type;
      if v_next_n is null then
        v_display_id := next_display_id(p_project, v_item_type);
        v_next_n := (regexp_replace(v_display_id, '^[A-Z]+-', ''))::integer;
        insert into persist_type_counters (item_type, next_n) values (v_item_type, v_next_n);
      else
        v_display_id := display_id_prefix(v_item_type) || '-' || lpad(v_next_n::text, 3, '0');
      end if;
      update persist_type_counters set next_n = v_next_n + 1 where item_type = v_item_type;

      insert into analysis_items (
        project_id, analysis_run_id, item_type, display_id, provider_key,
        title, description, priority, evidence_class, origin, confidence,
        rationale, attributes
      ) values (
        p_project, v_run_id, v_item_type, v_display_id, v_item ->> 'provider_key',
        v_item ->> 'title', v_item ->> 'description',
        coalesce((v_item ->> 'priority')::item_priority, 'unassigned'),
        (v_item ->> 'evidence_class')::evidence_class,
        (v_item ->> 'origin')::item_origin,
        (v_item ->> 'confidence')::double precision,
        v_item ->> 'rationale',
        v_item -> 'attributes'
      )
      returning id into v_new_item_id;

      insert into persist_item_ids (local_key, item_id) values (v_item ->> 'local_key', v_new_item_id);
    end loop;

    for v_item in select * from jsonb_array_elements(p_items)
    loop
      insert into item_source_references (
        project_id, item_id, source_document_id, excerpt, start_offset, end_offset,
        evidence_strength, offset_verified
      )
      select
        p_project,
        (select item_id from persist_item_ids where local_key = v_item ->> 'local_key'),
        p_source,
        ref ->> 'excerpt',
        (ref ->> 'start_offset')::integer,
        (ref ->> 'end_offset')::integer,
        (ref ->> 'evidence_strength')::double precision,
        coalesce((ref ->> 'offset_verified')::boolean, false)
      from jsonb_array_elements(coalesce(v_item -> 'source_references', '[]'::jsonb)) ref;

      insert into item_relations (project_id, from_item_id, to_item_id, relation_type)
      select
        p_project,
        (select item_id from persist_item_ids where local_key = v_item ->> 'local_key'),
        (select item_id from persist_item_ids where local_key = rel_key),
        'derives_from'
      from jsonb_array_elements_text(coalesce(v_item -> 'related_local_keys', '[]'::jsonb)) rel_key;
    end loop;
  end if;

  return jsonb_build_object(
    'run_id', v_run_id,
    'validation_status', p_validation_status,
    'duplicate', false
  );
end;
$$;
