-- ReqWiseAI — Slice 4.1
-- Two corrections to the slice-4 persistence path.
--
-- 1. Display ids are now allocated as a *reserved range* per (project, prefix),
--    under a lock scoped to exactly that pair.
--
--    What slice 4 did: call next_display_id() once per prefix, then count upward in a
--    local variable for the remaining items of that prefix. next_display_id() advances
--    nothing — it is `max(...) + 1` — so the numbers after the first were invented by
--    the caller and held only by the `SELECT ... FOR UPDATE` on the projects row. That
--    lock is real, but it is implicit (the reservation is a side effect of a row lock
--    taken for another reason), it is coarse (one project-wide lock serialises every
--    prefix), and nothing about the contract says a caller must hold it.
--
--    What this does: allocate_display_number_range() takes a transaction-scoped
--    advisory lock on (project, prefix), reads the high-water mark, and returns the
--    whole range the caller may use. The caller inserts those rows in the same
--    transaction, so on COMMIT the mark has advanced by exactly the requested count.
--    A concurrent allocation for the same pair blocks until then and starts after it.
--
--    Deadlock note: persist_analysis_result() allocates in sorted prefix order, so two
--    concurrent runs always take these locks in the same sequence.
--
--    Rollback semantics, stated precisely: a transaction that fails commits no rows, so
--    the mark does not move and the next caller receives the same numbers. Nothing was
--    ever visible under those numbers, so this is not reuse — the invariant is that no
--    two *committed* items share a display id, which the unique index on
--    (project_id, display_id) enforces as the final net.
--
-- 2. An idempotency key is now checked against the context it was first used with.
--    Slice 4 returned any run carrying the key. If the same key arrived for a
--    different source, it returned that other source's run — a wrong answer rather
--    than a refusal.
--
-- 20260724000001..11 are applied to the live project and are never edited.

-- ---------------------------------------------------------------------------
-- allocate_display_number_range — reserve N numbers for one (project, prefix)
-- ---------------------------------------------------------------------------
create or replace function allocate_display_number_range(
  p_project uuid,
  p_prefix  text,
  p_count   integer
)
returns table (start_number integer, end_number integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_high_water integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  if not is_project_member(p_project) then
    raise exception 'project not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if p_count is null or p_count < 1 then
    raise exception 'requested count must be at least 1'
      using errcode = 'check_violation';
  end if;

  if p_prefix is null or p_prefix !~ '^[A-Z]+$' then
    raise exception 'invalid display id prefix'
      using errcode = 'check_violation';
  end if;

  -- Transaction-scoped and specific to this (project, prefix): released automatically
  -- on commit or rollback, and never blocks an allocation for a different prefix.
  perform pg_advisory_xact_lock(hashtext(p_project::text || ':' || p_prefix));

  -- The high-water mark is derived, not stored — there is no counter table to drift
  -- from the rows it describes. A rejected or deleted item leaves a permanent gap,
  -- which is correct: a stakeholder may already have written that number down.
  select coalesce(max((regexp_replace(display_id, '^[A-Z]+-', ''))::integer), 0)
    into v_high_water
    from analysis_items
   where project_id = p_project
     and display_id like p_prefix || '-%';

  start_number := v_high_water + 1;
  end_number   := v_high_water + p_count;
  return next;
end;
$$;

revoke execute on function allocate_display_number_range(uuid, text, integer) from public;
grant execute on function allocate_display_number_range(uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- persist_analysis_result — range-based allocation + idempotency context check
-- ---------------------------------------------------------------------------
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
  v_existing        analysis_runs%rowtype;
  v_run_id          uuid;
  v_item            jsonb;
  v_item_type       item_type;
  v_prefix          text;
  v_needed          integer;
  v_start           integer;
  v_end             integer;
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

    -- Pass 1 — assign a number from the reserved range and insert every item.
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

    -- Pass 2 — source references and relations, now that every local_key resolves.
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
