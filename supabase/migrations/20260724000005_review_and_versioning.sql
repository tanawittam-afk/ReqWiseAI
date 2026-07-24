-- ReqWiseAI — Phase 3A
-- The rules that make "the AI never decides" true at the database level
-- (DATA-MODEL.md §C.4, §C.5). These are schema-level invariants: an application bug,
-- or a second client written later, cannot skip review or lose history, because the
-- database itself refuses.

-- ---------------------------------------------------------------------------
-- Display-ID allocator, DB-backed.
--
-- The Phase 2 port lib/normalization/ports.ts:createDisplayIdAllocator was written to
-- be swapped for exactly this: per project, per type, never reused, gaps preserved.
-- ---------------------------------------------------------------------------
create or replace function display_id_prefix(p_type item_type)
returns text
language sql
immutable
as $$
  select case p_type
    when 'problem_statement'          then 'PS'
    when 'business_objective'         then 'OBJ'
    when 'stakeholder'                then 'STK'
    when 'business_requirement'       then 'BR'
    when 'functional_requirement'     then 'FR'
    when 'non_functional_requirement' then 'NFR'
    when 'user_story'                 then 'US'
    when 'acceptance_criterion'       then 'AC'
    when 'business_rule'              then 'RULE'
    when 'assumption'                 then 'ASM'
    when 'risk'                       then 'RISK'
    when 'constraint'                 then 'CON'
    when 'open_question'              then 'Q'
    when 'quality_finding'            then 'QF'
  end;
$$;

-- Next display id for (project, type). Serialized on the project row so concurrent
-- runs cannot mint the same number. Numbering continues from the high-water mark; a
-- rejected item leaves a permanent gap.
create or replace function next_display_id(p_project uuid, p_type item_type)
returns text
language plpgsql
as $$
declare
  prefix text := display_id_prefix(p_type);
  next_n integer;
begin
  perform 1 from projects where id = p_project for update;

  select coalesce(
           max((regexp_replace(display_id, '^[A-Z]+-', ''))::integer),
           0) + 1
    into next_n
    from analysis_items
   where project_id = p_project and item_type = p_type;

  return prefix || '-' || lpad(next_n::text, 3, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- AI items are born as 'draft'. Nothing may insert any other status.
-- ---------------------------------------------------------------------------
create or replace function enforce_insert_draft()
returns trigger
language plpgsql
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
  return new;
end;
$$;

create trigger analysis_items_insert_draft
  before insert on analysis_items
  for each row execute function enforce_insert_draft();

-- ---------------------------------------------------------------------------
-- Allowed status transitions (DATA-MODEL §C.5 rule 4).
-- ---------------------------------------------------------------------------
create or replace function is_valid_status_transition(p_from item_status, p_to item_status)
returns boolean
language sql
immutable
as $$
  select (p_from, p_to) in (
    ('draft', 'needs_clarification'),
    ('draft', 'reviewed'),
    ('draft', 'rejected'),
    ('needs_clarification', 'draft'),
    ('needs_clarification', 'reviewed'),
    ('needs_clarification', 'rejected'),
    ('reviewed', 'approved'),
    ('reviewed', 'rejected'),
    ('reviewed', 'needs_clarification'),
    ('approved', 'implemented'),
    ('approved', 'needs_clarification'),
    ('rejected', 'draft')
  );
$$;

-- ---------------------------------------------------------------------------
-- On UPDATE of analysis_items:
--   * a content change (title/description/priority/item_type/attributes) auto-writes
--     an item_versions snapshot of the OLD state and bumps version_no — history can
--     never be forgotten.
--   * a status change must route through review_item() (which sets a transaction-local
--     flag and writes the review_activity), and must be a valid transition. A direct
--     UPDATE of status is rejected.
-- ---------------------------------------------------------------------------
create or replace function guard_item_update()
returns trigger
language plpgsql
as $$
declare
  content_changed boolean;
  reviewing boolean;
begin
  content_changed :=
       new.title       is distinct from old.title
    or new.description is distinct from old.description
    or new.priority    is distinct from old.priority
    or new.item_type   is distinct from old.item_type
    or new.attributes  is distinct from old.attributes;

  if content_changed then
    insert into item_versions (project_id, item_id, version_no, snapshot, changed_by)
    values (old.project_id, old.id, old.version_no, to_jsonb(old), auth.uid());
    new.version_no := old.version_no + 1;
  end if;

  if new.status is distinct from old.status then
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

create trigger analysis_items_guard_update
  before update on analysis_items
  for each row execute function guard_item_update();

-- ---------------------------------------------------------------------------
-- review_item — the ONLY sanctioned way to change an item's status.
-- Writes the status change and its audit row atomically, stamps the actor from the
-- JWT (never from client input), and enforces a human actor for approve/reject.
-- ---------------------------------------------------------------------------
create or replace function review_item(
  p_item_id       uuid,
  p_activity_type review_activity_type,
  p_to_status     item_status default null,
  p_comment       text default null
)
returns void
language plpgsql
security invoker         -- runs under the caller's RLS, so it can only touch its own items
as $$
declare
  v_actor   uuid := auth.uid();
  v_project uuid;
  v_from    item_status;
begin
  if v_actor is null then
    raise exception 'review_item requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select project_id, status into v_project, v_from
    from analysis_items
   where id = p_item_id and deleted_at is null;

  if v_project is null then
    raise exception 'item % not found or not visible', p_item_id
      using errcode = 'no_data_found';
  end if;

  -- approve / reject must be human, which is already guaranteed above.
  if p_to_status is not null and p_to_status is distinct from v_from then
    perform set_config('reqwise.reviewing', 'on', true);   -- transaction-local
    update analysis_items set status = p_to_status where id = p_item_id;
    perform set_config('reqwise.reviewing', 'off', true);
  end if;

  insert into review_activities
    (project_id, item_id, actor_id, activity_type, from_status, to_status, comment)
  values
    (v_project, p_item_id, v_actor, p_activity_type, v_from, p_to_status, p_comment);
end;
$$;
