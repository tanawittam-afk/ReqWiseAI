-- ReqWiseAI — Change requests, part 3 of 3
--
-- "approved" and "rejected" are terminal on analysis_items (20260725000013) so that the
-- record of what was actually reviewed and signed off can never be silently rewritten.
-- That is exactly why a later disagreement with a terminal item cannot be a status flip
-- back to draft: the fix must be a NEW object with its own audit trail, referencing the
-- item it proposes to change and (optionally) the answer that prompted it.
--
-- WHY A NEW TABLE, not more columns on analysis_items like slice 6A's workflow_state
-- (DATA-MODEL §C.12's own bar: "a new table is justified only when an entity has a
-- genuinely different lifecycle, permission model, or query pattern"):
--   * lifecycle — a change request is many-to-one against an item (one item can
--     accumulate several over time, including rejected ones); workflow_state was
--     one-to-one with its row.
--   * a second reference — it names the approved/rejected item AND, optionally, the
--     open_question that motivated it. Nothing else in the schema does that.
--   * its own decision — approve/reject/withdraw is a separate act from anything a
--     reviewer does to the item itself.
-- This clears the bar the workflow columns deliberately did not.
--
-- WHY THE AUDIT TRAIL STAYS ON review_activities, not a fourth table: opening, approving,
-- rejecting or withdrawing a change request is the same *shape* of event the table
-- already logs for review and workflow actions (actor, item, moment, optional comment).
-- Only the change-request ROW has a different lifecycle from those events; the act of
-- logging what happened to it does not. review_activities already carries two "one of
-- these, never both" column pairs (from_status/to_status, from_workflow_state/
-- to_workflow_state); change_request_id is a third slot in the same append-only row,
-- populated whenever the activity concerns a change request.

-- ---------------------------------------------------------------------------
-- change_requests
-- ---------------------------------------------------------------------------
create table change_requests (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null,
  target_item_id       uuid not null,
  source_question_id   uuid,                         -- nullable: a manually raised request has none
  status               change_request_status not null default 'pending',
  proposed_title       text not null,
  proposed_description text not null,
  proposed_priority    item_priority not null,
  reason               text not null,                 -- always required, regardless of provenance
  requested_by         uuid not null references auth.users (id),
  requested_at         timestamptz not null default now(),
  resolution_note      text,                           -- required on reject
  resolved_by          uuid references auth.users (id),
  resolved_at          timestamptz,
  applied_version_no   integer,                        -- the item_versions snapshot approval created
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  foreign key (target_item_id, project_id)
    references analysis_items (id, project_id) on delete cascade,
  foreign key (source_question_id, project_id)
    references analysis_items (id, project_id) on delete set null,

  check ((resolved_at is null) = (resolved_by is null)),
  check (status <> 'rejected' or (resolution_note is not null and btrim(resolution_note) <> '')),
  check (status <> 'approved' or applied_version_no is not null)
);
create index on change_requests (project_id);
create index on change_requests (target_item_id);
create index on change_requests (status);

-- DB-enforced, not just RPC-checked: only one proposal may be in flight against a given
-- item at a time. A partial unique index is the guarantee a race between two callers
-- cannot slip past.
create unique index change_requests_one_pending
  on change_requests (target_item_id) where status = 'pending';

comment on column change_requests.reason is
  'Why this change is proposed. Never left blank, whether or not a source_question_id '
  'is attached — a manually raised request is never wordless either.';

alter table change_requests enable row level security;

create policy change_requests_select on change_requests
  for select using (is_project_member(project_id));
create policy change_requests_insert on change_requests
  for insert with check (is_project_member(project_id) and requested_by = auth.uid());
-- No update/delete policy: every status transition goes through the SECURITY DEFINER
-- RPCs below, same as review_activities and item_versions today.

-- review_activities gains a third "one of these, never together" column, alongside
-- from_status/to_status (slice 5) and from_workflow_state/to_workflow_state (slice 6A).
alter table review_activities
  add column change_request_id uuid references change_requests (id);

-- ---------------------------------------------------------------------------
-- Allowed change-request transitions. Only ever out of 'pending'; nothing transitions
-- out of a terminal change-request status, mirroring is_valid_status_transition().
-- ---------------------------------------------------------------------------
create or replace function is_valid_change_request_transition(
  p_from change_request_status,
  p_to   change_request_status
)
returns boolean
language sql
immutable
as $$
  select (p_from, p_to) in (
    ('pending', 'approved'),
    ('pending', 'rejected'),
    ('pending', 'withdrawn')
  );
$$;

-- ---------------------------------------------------------------------------
-- guard_change_request_insert — the request itself must make sense before it exists.
--
-- A CHECK constraint cannot look at another table's row, so this is a trigger: the
-- target must currently be terminal (approved/rejected), and if a source question is
-- named it must actually be an open_question in the same project. This runs for every
-- INSERT, including one issued directly by the service role, exactly like
-- guard_item_update() holds regardless of caller.
-- ---------------------------------------------------------------------------
create or replace function guard_change_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_status item_status;
  v_source_type   item_type;
begin
  select status into v_target_status
    from analysis_items
   where id = new.target_item_id and project_id = new.project_id;

  if v_target_status is null then
    raise exception 'target requirement not found in this project'
      using errcode = 'no_data_found';
  end if;

  if v_target_status not in ('approved', 'rejected') then
    raise exception 'a change request may only be opened against an approved or rejected requirement'
      using errcode = 'restrict_violation';
  end if;

  if new.source_question_id is not null then
    select item_type into v_source_type
      from analysis_items
     where id = new.source_question_id and project_id = new.project_id;

    if v_source_type is null then
      raise exception 'source question not found in this project'
        using errcode = 'no_data_found';
    end if;
    if v_source_type <> 'open_question' then
      raise exception 'a change request''s source must be a stakeholder question'
        using errcode = 'restrict_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger change_requests_guard_insert
  before insert on change_requests
  for each row execute function guard_change_request_insert();

-- ---------------------------------------------------------------------------
-- guard_change_request_update — the resolution door.
--
-- Everything about the original request is pinned; only status (plus the resolution
-- columns written alongside it) may ever change, and only through resolve_change_request()
-- / withdraw_change_request(), which set this transaction-local flag. A direct UPDATE,
-- even from the service role, is refused otherwise — the same shape as guard_item_update().
-- ---------------------------------------------------------------------------
create or replace function guard_change_request_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resolving boolean;
begin
  if new.id                   is distinct from old.id
     or new.project_id        is distinct from old.project_id
     or new.target_item_id    is distinct from old.target_item_id
     or new.source_question_id is distinct from old.source_question_id
     or new.proposed_title    is distinct from old.proposed_title
     or new.proposed_description is distinct from old.proposed_description
     or new.proposed_priority is distinct from old.proposed_priority
     or new.reason            is distinct from old.reason
     or new.requested_by      is distinct from old.requested_by
     or new.requested_at      is distinct from old.requested_at
     or new.created_at        is distinct from old.created_at then
    raise exception 'a change request''s original proposal cannot be altered, only resolved'
      using errcode = 'restrict_violation';
  end if;

  if new.status is distinct from old.status then
    resolving := coalesce(current_setting('reqwise.change_request_resolving', true), 'off') = 'on';
    if not resolving then
      raise exception 'a change request''s status may only be changed through its own action; a direct update is not permitted'
        using errcode = 'restrict_violation';
    end if;
    if old.status <> 'pending' then
      raise exception 'a change request that is no longer pending cannot be resolved again'
        using errcode = 'restrict_violation';
    end if;
    if not is_valid_change_request_transition(old.status, new.status) then
      raise exception 'invalid change request transition: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger change_requests_guard_update
  before update on change_requests
  for each row execute function guard_change_request_update();

-- ---------------------------------------------------------------------------
-- guard_item_update — extended with one narrow exception.
--
-- Identical to 20260725000016 except for a single added condition: a terminal item may
-- have its content columns rewritten when the transaction-local
-- reqwise.change_request_approval flag is on, which only resolve_change_request() below
-- ever sets. Everything else — identity/evidence pinning, the version snapshot, the
-- workflow-column gate, the review reset — is unchanged. This is deliberately the ONLY
-- new door onto a terminal item; the status column itself still never moves here.
-- ---------------------------------------------------------------------------
create or replace function guard_item_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  content_changed        boolean;
  workflow_changed       boolean;
  reset_to_draft         boolean;
  reviewing              boolean;
  in_workflow            boolean;
  approving_change       boolean;
  v_actor                uuid := auth.uid();
  v_reason               text;
begin
  if new.id                 is distinct from old.id
     or new.project_id      is distinct from old.project_id
     or new.analysis_run_id is distinct from old.analysis_run_id
     or new.item_type       is distinct from old.item_type
     or new.display_id      is distinct from old.display_id
     or new.provider_key    is distinct from old.provider_key
     or new.evidence_class  is distinct from old.evidence_class
     or new.origin          is distinct from old.origin
     or new.confidence      is distinct from old.confidence
     or new.rationale       is distinct from old.rationale
     or new.created_at      is distinct from old.created_at then
    raise exception 'the identity and evidence of an analysis item cannot be changed'
      using errcode = 'restrict_violation';
  end if;

  workflow_changed :=
       new.workflow_state  is distinct from old.workflow_state
    or new.resolution_text is distinct from old.resolution_text
    or new.resolved_at     is distinct from old.resolved_at
    or new.resolved_by     is distinct from old.resolved_by
    or new.follow_up_on    is distinct from old.follow_up_on;

  if workflow_changed then
    in_workflow := coalesce(current_setting('reqwise.workflow', true), 'off') = 'on';
    if not in_workflow then
      raise exception 'the question and quality workflow may only be changed through its own action; a direct update is not permitted'
        using errcode = 'restrict_violation';
    end if;
  end if;

  content_changed :=
       new.title       is distinct from old.title
    or new.description is distinct from old.description
    or new.priority    is distinct from old.priority
    or new.attributes  is distinct from old.attributes;

  if not content_changed and new.version_no is distinct from old.version_no then
    raise exception 'version_no is set by the database, not by the caller'
      using errcode = 'restrict_violation';
  end if;

  if content_changed then
    if v_actor is null then
      raise exception 'editing a requirement requires an authenticated user'
        using errcode = 'insufficient_privilege';
    end if;

    approving_change := coalesce(current_setting('reqwise.change_request_approval', true), 'off') = 'on';

    if old.status in ('approved', 'rejected') and not approving_change then
      raise exception 'an approved or rejected requirement is read-only'
        using errcode = 'restrict_violation';
    end if;
    if not is_reviewable_item_type(old.item_type) then
      raise exception 'this item type uses a different workflow'
        using errcode = 'restrict_violation';
    end if;
    if not exists (
      select 1 from projects where id = old.project_id and status = 'active'
    ) then
      raise exception 'project is archived and read-only'
        using errcode = 'restrict_violation';
    end if;

    v_reason := nullif(trim(coalesce(current_setting('reqwise.change_reason', true), '')), '');

    insert into item_versions (project_id, item_id, version_no, snapshot, changed_by, change_reason)
    values (old.project_id, old.id, old.version_no, to_jsonb(old), v_actor, v_reason);
    new.version_no := old.version_no + 1;
  end if;

  -- A change request never reopens the item for human review — approving it supersedes
  -- the content, but the status the reviewer signed off on stays exactly as it was.
  reset_to_draft := content_changed and not approving_change and old.status in ('reviewed', 'needs_clarification');

  if reset_to_draft then
    new.status := 'draft';
    insert into review_activities
      (project_id, item_id, actor_id, activity_type, from_status, to_status, comment)
    values
      (old.project_id, old.id, v_actor, 'edit', old.status, 'draft',
       case old.status
         when 'reviewed' then 'Reviewed item changed; returned to draft.'
         else 'Content updated after clarification; returned to draft.'
       end);
  end if;

  if new.status is distinct from old.status and not reset_to_draft then
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

-- ---------------------------------------------------------------------------
-- open_change_request — the sanctioned door for proposing a change.
--
-- Narrow like edit_analysis_item(): the target, the proposed content, why, and an
-- optional source question. No actor, no project, no status — nothing a caller could
-- forge is in the signature.
-- ---------------------------------------------------------------------------
create or replace function open_change_request(
  p_target_item_id        uuid,
  p_proposed_title        text,
  p_proposed_description  text,
  p_proposed_priority     item_priority,
  p_reason                text,
  p_source_question_id    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor   uuid := auth.uid();
  v_project uuid;
  v_status  item_status;
  v_title   text := trim(coalesce(p_proposed_title, ''));
  v_desc    text := trim(coalesce(p_proposed_description, ''));
  v_reason  text := trim(coalesce(p_reason, ''));
  v_cr_id   uuid;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  select project_id, status into v_project, v_status
    from analysis_items
   where id = p_target_item_id and deleted_at is null;

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

  if v_status not in ('approved', 'rejected') then
    raise exception 'a change request may only be opened against an approved or rejected requirement'
      using errcode = 'restrict_violation';
  end if;

  if p_source_question_id is not null and not exists (
    select 1 from analysis_items
     where id = p_source_question_id and project_id = v_project
       and item_type = 'open_question' and deleted_at is null
  ) then
    raise exception 'source question not found or is not a stakeholder question'
      using errcode = 'no_data_found';
  end if;

  if char_length(v_title) = 0 or char_length(v_title) > 300 then
    raise exception 'a proposed requirement needs a title of 1 to 300 characters'
      using errcode = 'check_violation';
  end if;
  if char_length(v_desc) = 0 or char_length(v_desc) > 4000 then
    raise exception 'a proposed requirement needs a description of 1 to 4000 characters'
      using errcode = 'check_violation';
  end if;
  if char_length(v_reason) = 0 or char_length(v_reason) > 2000 then
    raise exception 'a reason is required, at most 2000 characters'
      using errcode = 'check_violation';
  end if;

  -- Defense-in-depth ahead of change_requests_one_pending: turns a race into a sentence
  -- instead of a raw unique-violation for the common case, the index catches the rest.
  if exists (
    select 1 from change_requests
     where target_item_id = p_target_item_id and status = 'pending'
  ) then
    raise exception 'a change request is already pending against this requirement'
      using errcode = 'unique_violation';
  end if;

  insert into change_requests (
    project_id, target_item_id, source_question_id, status,
    proposed_title, proposed_description, proposed_priority, reason, requested_by
  ) values (
    v_project, p_target_item_id, p_source_question_id, 'pending',
    v_title, v_desc, p_proposed_priority, v_reason, v_actor
  )
  returning id into v_cr_id;

  insert into review_activities (
    project_id, item_id, actor_id, activity_type, comment, change_request_id
  ) values (
    v_project, p_target_item_id, v_actor, 'change_request_opened', v_reason, v_cr_id
  );

  return jsonb_build_object(
    'change_request_id', v_cr_id,
    'target_item_id',    p_target_item_id,
    'status',            'pending'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_change_request — approve or reject a pending proposal.
--
-- Approving writes the proposed content onto the target item (through the one narrow
-- exception guard_item_update() now allows) and stamps the version it produced; the
-- item's status never moves. Rejecting touches only the change request itself.
-- ---------------------------------------------------------------------------
create or replace function resolve_change_request(
  p_change_request_id uuid,
  p_decision           change_request_status,
  p_resolution_note    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor   uuid := auth.uid();
  v_cr      change_requests%rowtype;
  v_note    text := nullif(trim(coalesce(p_resolution_note, '')), '');
  v_new_ver integer;
  v_kind    review_activity_type;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'a change request can only be approved or rejected through this action'
      using errcode = 'check_violation';
  end if;

  select * into v_cr from change_requests where id = p_change_request_id;

  if v_cr.id is null then
    raise exception 'change request not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not is_project_member(v_cr.project_id) then
    raise exception 'change request not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not project_is_active(v_cr.project_id) then
    raise exception 'project is archived and read-only'
      using errcode = 'restrict_violation';
  end if;

  if v_cr.status <> 'pending' then
    raise exception 'this change request is no longer pending'
      using errcode = 'PT409';
  end if;

  if p_decision = 'rejected' and v_note is null then
    raise exception 'a resolution note is required when rejecting a change request'
      using errcode = 'check_violation';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'a resolution note may be at most 2000 characters'
      using errcode = 'check_violation';
  end if;

  if p_decision = 'approved' then
    perform set_config('reqwise.change_request_approval', 'on', true);

    update analysis_items
       set title       = v_cr.proposed_title,
           description = v_cr.proposed_description,
           priority    = v_cr.proposed_priority
     where id = v_cr.target_item_id;

    perform set_config('reqwise.change_request_approval', 'off', true);

    select version_no into v_new_ver from analysis_items where id = v_cr.target_item_id;
    v_kind := 'change_request_approved';
  else
    v_kind := 'change_request_rejected';
  end if;

  perform set_config('reqwise.change_request_resolving', 'on', true);

  update change_requests
     set status              = p_decision,
         resolution_note     = v_note,
         resolved_by         = v_actor,
         resolved_at         = now(),
         applied_version_no  = case when p_decision = 'approved' then v_new_ver else null end
   where id = p_change_request_id;

  perform set_config('reqwise.change_request_resolving', 'off', true);

  insert into review_activities (
    project_id, item_id, actor_id, activity_type, comment, change_request_id
  ) values (
    v_cr.project_id, v_cr.target_item_id, v_actor, v_kind, v_note, p_change_request_id
  );

  return jsonb_build_object(
    'change_request_id',  p_change_request_id,
    'decision',            p_decision,
    'applied_version_no',  v_new_ver
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- withdraw_change_request — the requester (or any project member) cancels their own
-- still-pending proposal. Touches only the change request; the item is never involved.
-- ---------------------------------------------------------------------------
create or replace function withdraw_change_request(p_change_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_cr    change_requests%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_cr from change_requests where id = p_change_request_id;

  if v_cr.id is null then
    raise exception 'change request not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if not is_project_member(v_cr.project_id) then
    raise exception 'change request not found or not visible'
      using errcode = 'no_data_found';
  end if;

  if v_cr.status <> 'pending' then
    raise exception 'only a pending change request can be withdrawn'
      using errcode = 'PT409';
  end if;

  perform set_config('reqwise.change_request_resolving', 'on', true);

  update change_requests
     set status = 'withdrawn', resolved_by = v_actor, resolved_at = now()
   where id = p_change_request_id;

  perform set_config('reqwise.change_request_resolving', 'off', true);

  insert into review_activities (
    project_id, item_id, actor_id, activity_type, change_request_id
  ) values (
    v_cr.project_id, v_cr.target_item_id, v_actor, 'change_request_withdrawn', p_change_request_id
  );

  return jsonb_build_object('change_request_id', p_change_request_id, 'status', 'withdrawn');
end;
$$;

revoke execute on function is_valid_change_request_transition(change_request_status, change_request_status) from public;
grant execute on function is_valid_change_request_transition(change_request_status, change_request_status) to authenticated;

revoke execute on function open_change_request(uuid, text, text, item_priority, text, uuid) from public;
grant execute on function open_change_request(uuid, text, text, item_priority, text, uuid) to authenticated;

revoke execute on function resolve_change_request(uuid, change_request_status, text) from public;
grant execute on function resolve_change_request(uuid, change_request_status, text) to authenticated;

revoke execute on function withdraw_change_request(uuid) from public;
grant execute on function withdraw_change_request(uuid) to authenticated;
