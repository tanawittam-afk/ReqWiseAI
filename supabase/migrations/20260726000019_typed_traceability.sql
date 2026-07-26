-- ReqWiseAI — Slice 6B, part 2 of 2: everything that *uses* the labels added in
-- 20260726000018.
--
-- Three things happen here.
--
--   1. `is_allowed_relation_pair()` — the item-type pair matrix, as a function rather
--      than a thirteenth table. A lookup table would need seeding, and a seed row
--      naming a brand-new enum label is the exact thing part 1 exists to avoid; it
--      would also be mutable data describing an immutable rule. DATA-MODEL's standing
--      rule ("a new table is justified only when an entity has a genuinely different
--      lifecycle, permission model, or query pattern") is not met.
--
--   2. Integrity triggers — pair validity, project/organization boundary, archived
--      projects, and a **deferred** cycle check over the hierarchical spine.
--
--   3. `persist_analysis_result()` takes typed relations instead of deriving every
--      edge as `derives_from`.
--
-- Backward compatibility, stated precisely: no existing row is read, rewritten or
-- retyped by this migration. The triggers are INSERT/UPDATE triggers, so the 189
-- committed `derives_from` rows are never evaluated against rules written after they
-- were stored. A pre-existing cycle among them, if one exists, is surfaced as a
-- coverage warning in the application and is not repaired here — repairing it would
-- mean deciding which edge the analysis "meant", which is a human's call.
--
-- 20260724000001..20260726000018 are applied and are never edited.

-- ---------------------------------------------------------------------------
-- Which relation types carry the traceability spine
-- ---------------------------------------------------------------------------
-- Mirrors HIERARCHICAL_RELATION_TYPES in lib/contracts/relations.ts.
--
-- `related_to` is absent on purpose: it makes no parent/child claim, so "A related_to
-- B" and "B related_to A" are two ordinary rows rather than a loop. The observation
-- types (`raises_question`, `flags_quality_issue`, `constrained_by`, `mitigates`)
-- describe the spine from outside it and cannot form one.
create or replace function relation_is_hierarchical(p_type item_relation_type)
returns boolean
language sql
immutable
as $$
  select p_type in (
    'supports', 'implemented_by', 'expressed_as', 'validated_by', 'derives_from'
  );
$$;

-- ---------------------------------------------------------------------------
-- Canonical hierarchy direction
-- ---------------------------------------------------------------------------
-- The four types slice 6B authors are written parent → child. `derives_from` was
-- written child → parent by every run before it. Both are read here as parent → child
-- so a graph mixing the two conventions cannot show a phantom two-node cycle.
--
-- Mirrors HIERARCHY_DIRECTION / canonicalHierarchyEdge() in lib/contracts/relations.ts.
create or replace function relation_parent_item(
  p_type item_relation_type,
  p_from uuid,
  p_to   uuid
)
returns uuid
language sql
immutable
as $$
  select case when p_type = 'derives_from' then p_to else p_from end;
$$;

create or replace function relation_child_item(
  p_type item_relation_type,
  p_from uuid,
  p_to   uuid
)
returns uuid
language sql
immutable
as $$
  select case when p_type = 'derives_from' then p_from else p_to end;
$$;

-- ---------------------------------------------------------------------------
-- The allowed (relation_type, from_type, to_type) matrix
-- ---------------------------------------------------------------------------
-- Mirrors ALLOWED_RELATION_PAIRS in lib/contracts/relations.ts exactly. When one
-- changes the other must; tests/traceability/pairs.test.ts asserts they agree on
-- every one of the 10 × 14 × 14 combinations.
--
-- Note there is no same-type special case, and none is needed: no spine rule names
-- the same item type on both sides, so BR implemented_by BR is already refused.
-- Decomposition within a level is not traceability across levels.
create or replace function is_allowed_relation_pair(
  p_type item_relation_type,
  p_from item_type,
  p_to   item_type
)
returns boolean
language sql
immutable
as $$
  select case p_type

    -- A business objective is supported by the business requirements beneath it.
    when 'supports' then
      p_from = 'business_objective' and p_to = 'business_requirement'

    -- A business requirement is implemented by functional / non-functional requirements.
    when 'implemented_by' then
      p_from = 'business_requirement'
      and p_to in ('functional_requirement', 'non_functional_requirement')

    -- A functional requirement is expressed as a user story.
    when 'expressed_as' then
      p_from = 'functional_requirement' and p_to = 'user_story'

    -- A story or a requirement is validated by an acceptance criterion.
    when 'validated_by' then
      p_from in ('user_story', 'business_requirement', 'functional_requirement',
                 'non_functional_requirement')
      and p_to = 'acceptance_criterion'

    -- A requirement is constrained by a constraint or a business rule.
    when 'constrained_by' then
      p_from in ('business_requirement', 'functional_requirement',
                 'non_functional_requirement', 'user_story')
      and p_to in ('constraint', 'business_rule')

    -- The question is the `from` side, so the arrow points at what is being questioned.
    when 'raises_question' then
      p_from = 'open_question' and p_to <> 'open_question'

    -- Likewise the finding is the `from` side.
    when 'flags_quality_issue' then
      p_from = 'quality_finding' and p_to <> 'quality_finding'

    -- The mitigation is the `from` side, so the arrow points at the risk made safer.
    when 'mitigates' then
      p_from in ('business_requirement', 'functional_requirement',
                 'non_functional_requirement', 'user_story',
                 'business_rule', 'constraint')
      and p_to = 'risk'

    -- The fallback, deliberately the broadest rule in the table. Narrowing it would
    -- push a real link into a specific type that misdescribes it, which is the failure
    -- this slice exists to fix. Self-relation and duplicates are still refused.
    when 'related_to' then true

    -- Legacy. Pre-6B rows sit between item types whose intended relationship cannot be
    -- re-derived, so the pair rule cannot be applied to them retroactively.
    when 'derives_from' then true

    -- Phase 3A labels no code path has ever written. Unreachable, and refused rather
    -- than quietly permitted, so "unknown type" fails closed.
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- guard_item_relation — per-row integrity, on every path
-- ---------------------------------------------------------------------------
create or replace function guard_item_relation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from_type    item_type;
  v_from_project uuid;
  v_to_type      item_type;
  v_to_project   uuid;
  v_from_org     uuid;
  v_to_org       uuid;
begin
  -- Self relation. The table CHECK says the same thing; repeating it here is what
  -- makes the error a sentence instead of a constraint name.
  if new.from_item_id = new.to_item_id then
    raise exception 'a relation may not point an item at itself'
      using errcode = 'check_violation';
  end if;

  select item_type, project_id into v_from_type, v_from_project
    from analysis_items where id = new.from_item_id;
  select item_type, project_id into v_to_type, v_to_project
    from analysis_items where id = new.to_item_id;

  if v_from_type is null or v_to_type is null then
    raise exception 'a relation must reference two existing items'
      using errcode = 'foreign_key_violation';
  end if;

  -- Project boundary. The composite foreign keys already tie both endpoints to
  -- `new.project_id`; this catches the same error with a message that says which
  -- rule was broken, and survives a future schema change that relaxes them.
  if v_from_project is distinct from new.project_id
     or v_to_project is distinct from new.project_id then
    raise exception 'a relation may not cross projects'
      using errcode = 'check_violation';
  end if;

  -- Organization boundary. Implied by the project boundary today, because a project
  -- belongs to exactly one organization — asserted anyway, because "implied by" is
  -- how a tenancy leak gets introduced by a later, locally-reasonable change.
  select organization_id into v_from_org from projects where id = v_from_project;
  select organization_id into v_to_org   from projects where id = v_to_project;
  if v_from_org is distinct from v_to_org or v_from_org is null then
    raise exception 'a relation may not cross organizations'
      using errcode = 'check_violation';
  end if;

  -- An archived project is read-only, exactly as it is for sources and items.
  if not project_is_active(new.project_id) then
    raise exception 'project is archived and read-only'
      using errcode = 'restrict_violation';
  end if;

  if not is_allowed_relation_pair(new.relation_type, v_from_type, v_to_type) then
    raise exception 'relation type % does not describe % -> %',
      new.relation_type, v_from_type, v_to_type
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_item_relation_write on item_relations;
create trigger guard_item_relation_write
  before insert or update on item_relations
  for each row execute function guard_item_relation();

-- ---------------------------------------------------------------------------
-- check_relation_cycle — deferred, because a cycle can be built in one statement
-- ---------------------------------------------------------------------------
-- `persist_analysis_result()` writes every relation of a run in a single
-- `INSERT ... SELECT`. Rows of one statement are not visible to a BEFORE trigger
-- firing for a later row of that same statement, so an immediate check would miss a
-- loop closed entirely within one run — the common case, since a run's relations all
-- point at each other.
--
-- A DEFERRABLE INITIALLY DEFERRED constraint trigger runs at COMMIT, when every row
-- the transaction wrote is visible. The cost is that the failure surfaces at commit
-- rather than at the offending statement; the benefit is that it cannot be evaded by
-- batching, and the whole run rolls back, which is the required behaviour anyway.
create or replace function check_relation_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent uuid;
  v_child  uuid;
begin
  if not relation_is_hierarchical(new.relation_type) then
    return null;
  end if;

  v_parent := relation_parent_item(new.relation_type, new.from_item_id, new.to_item_id);
  v_child  := relation_child_item(new.relation_type, new.from_item_id, new.to_item_id);

  -- The new edge is parent → child. It closes a loop exactly when the graph already
  -- contains a path child →* parent.
  if exists (
    with recursive descendant (item_id, depth) as (
      select v_child, 0
      union all
      select relation_child_item(r.relation_type, r.from_item_id, r.to_item_id),
             d.depth + 1
        from item_relations r
        join descendant d
          on d.item_id = relation_parent_item(r.relation_type, r.from_item_id, r.to_item_id)
       where r.project_id = new.project_id
         and relation_is_hierarchical(r.relation_type)
         -- A guard, not an optimisation: without it a pre-existing legacy cycle would
         -- make this query non-terminating instead of reporting the new edge.
         and d.depth < 64
    )
    select 1 from descendant where item_id = v_parent
  ) then
    raise exception 'hierarchical relation % would create a cycle', new.relation_type
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

drop trigger if exists check_relation_cycle_write on item_relations;
create constraint trigger check_relation_cycle_write
  after insert or update on item_relations
  deferrable initially deferred
  for each row execute function check_relation_cycle();

-- ---------------------------------------------------------------------------
-- persist_analysis_result — typed relations
-- ---------------------------------------------------------------------------
-- The signature gains `p_relations`, so the old one is dropped rather than replaced:
-- adding a defaulted parameter creates an overload, and two candidates that differ
-- only by a defaulted argument make every PostgREST call ambiguous.
drop function if exists persist_analysis_result(
  uuid, uuid, text, text, text, text, text, output_lang, run_validation_status,
  jsonb, jsonb, jsonb, jsonb
);

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

    -- Pass 2 — source references, now that every local_key resolves.
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

    -- Pass 3 — typed relations.
    --
    -- One row at a time rather than one `INSERT ... SELECT`, so an unresolved local
    -- key is refused by name instead of arriving as a NULL into a NOT NULL column.
    -- `validateAnalysis()` already guarantees every key resolves; this is the net.
    --
    -- Nothing is skipped. A relation the database refuses raises, and the raise takes
    -- the run, its items, and its references down with it — dropping the bad edge and
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
