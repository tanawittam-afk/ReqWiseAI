-- ReqWiseAI — Slice 2
-- Project intake fields + the archive lifecycle.
--
-- Product decision (2026-07-24): a project is never hard-deleted. Deletion would take
-- its source documents and analysis runs with it, and those are immutable by design —
-- the cascade cannot even execute. Archiving keeps every child row and every audit
-- trail intact, and stays reversible.
--
-- The rules below are schema-level, not application discipline:
--   * a project is born 'active'; only archive_project()/restore_project() move it
--   * organization, creator, domain profile and creation time are immutable after insert
--   * an archived project is read-only — no UPDATE succeeds until it is restored
--   * both lifecycle functions take the actor from auth.uid(), never from an argument
--
-- New migration file. 20260724000001..6 are already applied to the live project and
-- must never be edited.

create type project_status as enum ('active', 'archived');

alter table projects
  add column status             project_status not null default 'active',
  add column output_lang        output_lang    not null default 'th',
  add column business_objective text,
  add column known_stakeholders text[]         not null default '{}',
  add column archived_at        timestamptz,
  add column archived_by        uuid references auth.users (id),
  add column archive_reason     text;

-- Archive metadata exists exactly when the project is archived. archive_reason stays
-- optional: a reason is useful, not mandatory.
alter table projects
  add constraint projects_archive_state_consistent check (
    (status = 'active'
      and archived_at is null and archived_by is null and archive_reason is null)
    or
    (status = 'archived'
      and archived_at is not null and archived_by is not null)
  );

-- Length ceilings mirror lib/contracts/project.ts. Zod is the first gate; this is the
-- one that holds when a client bypasses the form.
alter table projects
  add constraint projects_name_not_blank check (btrim(name) <> ''),
  add constraint projects_name_length check (char_length(name) <= 120),
  add constraint projects_description_length check (description is null or char_length(description) <= 2000),
  add constraint projects_business_objective_length check (business_objective is null or char_length(business_objective) <= 2000),
  add constraint projects_known_stakeholders_bounded check (
    array_length(known_stakeholders, 1) is null or array_length(known_stakeholders, 1) <= 20
  );

-- The project list always filters by organization and status.
create index projects_organization_status_idx on projects (organization_id, status);

-- ---------------------------------------------------------------------------
-- What a user may change about a project, and what they may not.
--
-- RLS already answers "may this user touch this row at all". Column-level rules do
-- not fit in a policy predicate, so they live here: a policy cannot express "you may
-- edit the name but not the organization".
-- ---------------------------------------------------------------------------
create or replace function guard_project_update()
returns trigger
language plpgsql
as $$
declare
  lifecycle boolean;
begin
  lifecycle := coalesce(current_setting('reqwise.project_lifecycle', true), 'off') = 'on';

  if new.organization_id is distinct from old.organization_id then
    raise exception 'a project cannot be moved to another organization'
      using errcode = 'restrict_violation';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'project.created_by is immutable'
      using errcode = 'restrict_violation';
  end if;
  if new.domain_profile_id is distinct from old.domain_profile_id then
    raise exception 'the domain profile is chosen at creation and cannot be changed'
      using errcode = 'restrict_violation';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'project.created_at is immutable'
      using errcode = 'restrict_violation';
  end if;

  if not lifecycle then
    if new.status         is distinct from old.status
    or new.archived_at    is distinct from old.archived_at
    or new.archived_by    is distinct from old.archived_by
    or new.archive_reason is distinct from old.archive_reason then
      raise exception 'project status may only be changed through archive_project() or restore_project()'
        using errcode = 'restrict_violation';
    end if;

    if old.status = 'archived' then
      raise exception 'project is archived and read-only; restore it first'
        using errcode = 'restrict_violation';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_guard_update
  before update on projects
  for each row execute function guard_project_update();

-- ---------------------------------------------------------------------------
-- archive_project — the only way in.
--
-- SECURITY INVOKER on purpose: the caller's own RLS decides whether the row is
-- visible and updatable, so there is no privilege to escape from. The actor is read
-- from the JWT; an actor argument would be a forgery hole. Same pattern as
-- review_item() in 20260724000005.
-- ---------------------------------------------------------------------------
create or replace function archive_project(p_project uuid, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor  uuid := auth.uid();
  v_status project_status;
begin
  if v_actor is null then
    raise exception 'archive_project requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select status into v_status from projects where id = p_project;
  if v_status is null then
    raise exception 'project % not found or not visible', p_project
      using errcode = 'no_data_found';
  end if;

  if v_status = 'archived' then
    return;   -- idempotent: archiving twice is not an error
  end if;

  perform set_config('reqwise.project_lifecycle', 'on', true);
  update projects
     set status         = 'archived',
         archived_at    = now(),
         archived_by    = v_actor,
         archive_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_project;
  perform set_config('reqwise.project_lifecycle', 'off', true);
end;
$$;

-- restore_project — owner only. Archiving is a working decision any member can make;
-- undoing it is an ownership decision.
create or replace function restore_project(p_project uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor  uuid := auth.uid();
  v_status project_status;
begin
  if v_actor is null then
    raise exception 'restore_project requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select status into v_status from projects where id = p_project;
  if v_status is null then
    raise exception 'project % not found or not visible', p_project
      using errcode = 'no_data_found';
  end if;

  if not is_project_owner(p_project) then
    raise exception 'only an organization owner may restore a project'
      using errcode = 'insufficient_privilege';
  end if;

  if v_status = 'active' then
    return;   -- idempotent
  end if;

  perform set_config('reqwise.project_lifecycle', 'on', true);
  update projects
     set status         = 'active',
         archived_at    = null,
         archived_by    = null,
         archive_reason = null
   where id = p_project;
  perform set_config('reqwise.project_lifecycle', 'off', true);
end;
$$;

-- Archiving replaces deletion, so the DELETE path is removed rather than left
-- unused. A policy that exists is a policy someone will eventually call.
drop policy projects_delete_owner on projects;

revoke execute on function archive_project(uuid, text) from public;
revoke execute on function restore_project(uuid) from public;
grant execute on function archive_project(uuid, text) to authenticated;
grant execute on function restore_project(uuid) to authenticated;
