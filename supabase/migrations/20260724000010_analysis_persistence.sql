-- ReqWiseAI — Slice 4
-- Atomic persistence for a deterministic analysis run.
--
-- The application layer never writes analysis_items, item_source_references or
-- item_relations directly — it calls persist_analysis_result() below, on the
-- caller's own user-scoped client. No service role is used in this path.
--
-- Why a single SECURITY DEFINER function rather than several statements from the
-- server: an analysis run is all-or-nothing (DATA-MODEL.md, AI-OUTPUT-CONTRACT.md
-- §D.8). A crash between "insert the run" and "insert its items" must never leave a
-- run without its items, or items without their references. Postgres already gives
-- one function call exactly-once transactional semantics; splitting the work across
-- several round trips from Node would not.
--
-- 20260724000001..9 are applied to the live project and are never edited.

-- ---------------------------------------------------------------------------
-- Idempotency: a client-generated key, unique per project, so a double submit or a
-- network retry cannot create a second run for the same confirmation.
-- ---------------------------------------------------------------------------
alter table analysis_runs
  add column request_key text;

alter table analysis_runs
  add constraint analysis_runs_request_key_length check (
    request_key is null or char_length(request_key) between 8 and 100
  );

-- Partial: only runs created through the idempotent path carry a key. Rows written
-- directly (as scripts/verify-sources.mts does, to put a source into the locked
-- state) leave it null and are unaffected.
create unique index analysis_runs_request_key_unique
  on analysis_runs (project_id, request_key)
  where request_key is not null;

-- ---------------------------------------------------------------------------
-- persist_analysis_result — the one door analysis output is written through.
--
-- p_items is a JSON array built by lib/analysis/persist.ts from a NormalizedAnalysis.
-- Each element:
--   { local_key, provider_key, item_type, title, description, priority,
--     evidence_class, origin, confidence, rationale, attributes,
--     related_local_keys: [local_key, ...],
--     source_references: [{ excerpt, start_offset, end_offset, evidence_strength,
--                            offset_verified }, ...] }
--
-- local_key is the id normalizeAnalysis() minted (lib/normalization/normalize.ts) —
-- unique within one run, never persisted itself. It exists so relations and
-- references in this payload can address "the third item in this array" without
-- knowing that item's real database id in advance; this function resolves every
-- local_key to a freshly-generated analysis_items.id (in a temp table, dropped at
-- the end of the transaction) before relations are written. A local_key that (by
-- construction, guaranteed by validateAnalysis before this is ever called) fails to
-- resolve casts to NULL and analysis_items' not-null id columns then reject the
-- whole transaction, rather than silently dropping the edge.
--
-- Display ids are allocated here, not by the caller: next_display_id() takes a row
-- lock on the project for the duration of this function, so concurrent runs on the
-- same project cannot mint the same number. It is called once per distinct
-- item_type present in this run (not once per item) and the number is then
-- incremented locally — one allocation per prefix, per the product spec.
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

  -- Idempotency: a prior call with the same key wins; this call is a no-op that
  -- reports the run already created rather than a second insert.
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

  -- The row lock next_display_id() takes below is what serializes concurrent
  -- persists of the same project; taking it even when there are no items keeps the
  -- run insert itself inside that same serialization point.
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
    -- Defensive: a pooled connection could in principle reuse a session across
    -- transactions if "on commit drop" ever failed to fire. Start from empty.
    truncate persist_item_ids;
    truncate persist_type_counters;

    -- Pass 1 — allocate a display id and insert every item, recording the
    -- local_key -> real item id mapping as we go.
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      v_item_type := (v_item ->> 'item_type')::item_type;

      select next_n into v_next_n from persist_type_counters where item_type = v_item_type;
      if v_next_n is null then
        -- One allocation per prefix: ask the database once for the first number
        -- this run uses for this type, then count up in memory for the rest.
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

      -- related_item_keys carries no relation kind of its own (AI-OUTPUT-CONTRACT.md);
      -- every edge from it is recorded as 'derives_from'. A local_key that failed to
      -- resolve produces NULL here and analysis_items' not-null id column then rejects
      -- the whole transaction rather than silently dropping the edge — validateAnalysis
      -- has already guaranteed every related key exists in the same output, so this
      -- path is a safety net, not an expected outcome.
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

revoke execute on function persist_analysis_result(
  uuid, uuid, text, text, text, text, text, output_lang, run_validation_status,
  jsonb, jsonb, jsonb, jsonb
) from public;
grant execute on function persist_analysis_result(
  uuid, uuid, text, text, text, text, text, output_lang, run_validation_status,
  jsonb, jsonb, jsonb, jsonb
) to authenticated;
