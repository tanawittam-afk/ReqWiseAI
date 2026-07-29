-- Restore the execution boundary and enforce a coherent provider/status/payload
-- contract on the current typed-traceability persistence function.
--
-- This migration intentionally replaces the existing 14-argument function in
-- place. Its authorization, idempotency, inserts, display-id allocation,
-- evidence, and typed-relation behavior remain unchanged from migration 19.

create or replace function public.persist_analysis_result(
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
  p_items             jsonb default '[]'::jsonb,
  p_relations         jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor           uuid := auth.uid();
  v_existing        analysis_runs%rowtype;
  v_run_id          uuid;
  v_item            jsonb;
  v_relation        jsonb;
  v_item_type       item_type;
  v_prefix          text;
  v_needed          integer;
  v_start           integer;
  v_end             integer;
  v_next_n          integer;
  v_display_id      text;
  v_new_item_id     uuid;
  v_from_id         uuid;
  v_to_id           uuid;
  v_relation_type   item_relation_type;
begin
  -- provider/status/payload contract
  if nullif(btrim(p_provider), '') is null
     or nullif(btrim(p_schema_version), '') is null then
    raise exception 'provider and schema version are required'
      using errcode = 'check_violation';
  end if;

  if p_items is null
     or p_relations is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_typeof(p_relations) <> 'array' then
    raise exception 'analysis items and relations must be arrays'
      using errcode = 'check_violation';
  end if;

  case p_validation_status
    when 'valid'::run_validation_status then
      if p_raw_output is null
         or p_raw_output = 'null'::jsonb
         or p_validated_output is null
         or p_validated_output = 'null'::jsonb
         or p_error is not null
         or jsonb_array_length(p_items) = 0 then
        raise exception 'valid analysis payload is incoherent'
          using errcode = 'check_violation';
      end if;

    when 'invalid'::run_validation_status then
      if p_raw_output is null
         or p_raw_output = 'null'::jsonb
         or p_validated_output is not null
         or p_error is null
         or p_error = 'null'::jsonb
         or jsonb_array_length(p_items) <> 0
         or jsonb_array_length(p_relations) <> 0 then
        raise exception 'invalid analysis payload is incoherent'
          using errcode = 'check_violation';
      end if;

    when 'provider_error'::run_validation_status then
      if p_raw_output is not null
         or p_validated_output is not null
         or p_error is null
         or p_error = 'null'::jsonb
         or jsonb_array_length(p_items) <> 0
         or jsonb_array_length(p_relations) <> 0 then
        raise exception 'provider-error analysis payload is incoherent'
          using errcode = 'check_violation';
      end if;
  end case;

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

  -- Idempotency. A key identifies one *attempt*, so replaying it is only meaningful
  -- when the attempt is the same one: same source, same actor, same provider, same
  -- output language. Anything else is a collision, and answering it with somebody
  -- else's run would be worse than refusing.
  if p_request_key is not null then
    select * into v_existing
      from analysis_runs
     where project_id = p_project and request_key = p_request_key;

    if found then
      if v_existing.source_document_id is distinct from p_source
         or v_existing.created_by is distinct from v_actor
         or v_existing.provider is distinct from p_provider
         or v_existing.output_lang is distinct from p_output_lang then
        raise exception 'this request identifier has already been used for a different analysis'
          using errcode = 'unique_violation';
      end if;

      return jsonb_build_object(
        'run_id', v_existing.id,
        'validation_status', v_existing.validation_status,
        'duplicate', true
      );
    end if;
  end if;

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
    create temporary table if not exists persist_ranges (
      prefix   text primary key,
      next_n   integer not null,
      end_n    integer not null
    ) on commit drop;
    truncate persist_item_ids;
    truncate persist_ranges;

    -- Reserve one range per prefix, in sorted prefix order. Sorting is what makes
    -- concurrent runs take these locks in a consistent sequence and therefore never
    -- deadlock against each other.
    for v_prefix, v_needed in
      select display_id_prefix((value ->> 'item_type')::item_type) as prefix,
             count(*)::integer as needed
        from jsonb_array_elements(p_items) as value
       group by 1
       order by 1
    loop
      select r.start_number, r.end_number
        into v_start, v_end
        from allocate_display_number_range(p_project, v_prefix, v_needed) r;

      insert into persist_ranges (prefix, next_n, end_n) values (v_prefix, v_start, v_end);
    end loop;

    -- Pass 1 - assign a number from the reserved range and insert every item.
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      -- An unsupported claim may not cite evidence - same rule as
      -- lib/validation/evidence.ts, asserted again at the write boundary.
      if v_item ->> 'evidence_class' = 'assumed'
         and jsonb_array_length(coalesce(v_item -> 'source_references', '[]'::jsonb)) > 0 then
        raise exception 'an assumed item may not carry a source reference'
          using errcode = 'check_violation';
      end if;

      v_item_type := (v_item ->> 'item_type')::item_type;
      v_prefix := display_id_prefix(v_item_type);

      select next_n into v_next_n from persist_ranges where prefix = v_prefix;
      if v_next_n is null then
        raise exception 'no display id range was reserved for this item type'
          using errcode = 'internal_error';
      end if;
      -- Overrunning the reservation would mean handing out a number nobody locked.
      if v_next_n > (select end_n from persist_ranges where prefix = v_prefix) then
        raise exception 'display id range exhausted'
          using errcode = 'internal_error';
      end if;

      v_display_id := v_prefix || '-' || lpad(v_next_n::text, 3, '0');
      update persist_ranges set next_n = v_next_n + 1 where prefix = v_prefix;

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

    -- Pass 2 - source references, now that every local_key resolves.
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
    end loop;

    -- Pass 3 - typed relations.
    --
    -- One row at a time rather than one `INSERT ... SELECT`, so an unresolved local
    -- key is refused by name instead of arriving as a NULL into a NOT NULL column.
    -- `validateAnalysis()` already guarantees every key resolves; this is the net.
    --
    -- Nothing is skipped. A relation the database refuses raises, and the raise takes
    -- the run, its items, and its references down with it - dropping the bad edge and
    -- keeping the rest would publish a matrix whose missing cell reads as "no such
    -- relationship" when it really means "we could not store it".
    for v_relation in select * from jsonb_array_elements(p_relations)
    loop
      v_relation_type := (v_relation ->> 'relation_type')::item_relation_type;

      -- A new run may not author the legacy label. It is what every pre-6B row
      -- carries precisely *because* the provider stated nothing; re-admitting it here
      -- would let this slice's own output re-introduce the problem it removes.
      if v_relation_type = 'derives_from' then
        raise exception 'derives_from is a legacy relation type and may not be written by a new run'
          using errcode = 'check_violation';
      end if;

      select item_id into v_from_id
        from persist_item_ids where local_key = v_relation ->> 'from_local_key';
      select item_id into v_to_id
        from persist_item_ids where local_key = v_relation ->> 'to_local_key';

      if v_from_id is null or v_to_id is null then
        raise exception 'relation references a local key that is not in this run'
          using errcode = 'foreign_key_violation';
      end if;

      insert into item_relations (project_id, from_item_id, to_item_id, relation_type)
      values (p_project, v_from_id, v_to_id, v_relation_type);
    end loop;

  elsif jsonb_array_length(p_relations) > 0 then
    -- A run with no items cannot have relations between them. Refusing rather than
    -- ignoring, because silently accepting means the caller's belief about what it
    -- stored is wrong.
    raise exception 'relations were supplied for a run that persists no items'
      using errcode = 'check_violation';
  end if;

  return jsonb_build_object(
    'run_id', v_run_id,
    'validation_status', p_validation_status,
    'duplicate', false
  );
end;
$$;

revoke execute on function public.persist_analysis_result(
  uuid, uuid, text, text, text, text, text, output_lang, run_validation_status,
  jsonb, jsonb, jsonb, jsonb, jsonb
) from public;

revoke execute on function public.persist_analysis_result(
  uuid, uuid, text, text, text, text, text, output_lang, run_validation_status,
  jsonb, jsonb, jsonb, jsonb, jsonb
) from anon;

grant execute on function public.persist_analysis_result(
  uuid, uuid, text, text, text, text, text, output_lang, run_validation_status,
  jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;
