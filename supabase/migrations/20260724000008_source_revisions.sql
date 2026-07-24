-- ReqWiseAI — Slice 3
-- Source documents become *revisioned audit evidence* instead of write-once rows.
--
-- 20260724000003 made source_documents wholly immutable, which was right for the
-- shape the product had then (a source arrived already analysed) and wrong for the
-- shape it has now: a BA pastes meeting notes, re-reads them, and fixes a typo before
-- running anything. Nothing has been analysed yet, so nothing is being rewritten.
--
-- The rule this migration installs is narrower and more honest:
--
--   * a revision is editable until an analysis run references it
--   * the moment a run references it, the revision is frozen — permanently
--   * editing a frozen revision means creating revision N+1, chained to N
--   * no revision is ever hard-deleted, frozen or not
--   * a source cannot be added or edited under an archived project
--
-- "Locked" is therefore never stored. It is `exists (analysis_run referencing me)`,
-- which cannot drift from the thing it describes. A boolean column could.
--
-- 20260724000001..7 are applied to the live project and are never edited.

-- ---------------------------------------------------------------------------
-- Revision identity and optional metadata
-- ---------------------------------------------------------------------------
-- document_key is the *logical* document; the primary key identifies one revision of
-- it. Revisions of the same document share a key, so "show me the history" is one
-- indexed lookup rather than a recursive walk up the supersedes chain.
alter table source_documents
  add column document_key    uuid    not null default gen_random_uuid(),
  add column revision_number integer not null default 1,
  add column supersedes_source_document_id uuid,
  -- Optional intake metadata (source date, who was interviewed, context notes).
  -- One jsonb column rather than three real ones: none of these is queried,
  -- constrained by a foreign key, or part of the lifecycle. When one of them earns a
  -- filter or an index, that is the migration that promotes it to a column.
  add column metadata        jsonb   not null default '{}'::jsonb,
  add column updated_at      timestamptz not null default now();

alter table source_documents
  add constraint source_documents_revision_positive check (revision_number >= 1),
  add constraint source_documents_no_self_supersede
    check (supersedes_source_document_id is distinct from id),
  -- A revision number is unique within a logical document. This is what makes a
  -- concurrent "create revision 2" a constraint violation instead of a fork.
  add constraint source_documents_revision_unique unique (document_key, revision_number),
  -- The predecessor must live in the same project. A composite foreign key states
  -- that in the schema, so no application code has to remember it.
  add constraint source_documents_supersedes_same_project
    foreign key (supersedes_source_document_id, project_id)
    references source_documents (id, project_id);

-- Content rules, mirroring lib/contracts/source.ts. Note what is NOT here: raw_text
-- is checked for *some* non-whitespace content and otherwise stored exactly as typed.
-- Trimming evidence would silently move every character offset an excerpt depends on.
alter table source_documents
  add constraint source_documents_title_not_blank check (btrim(title) <> ''),
  add constraint source_documents_title_length check (char_length(title) <= 200),
  add constraint source_documents_raw_text_not_blank check (btrim(raw_text) <> ''),
  add constraint source_documents_raw_text_length check (char_length(raw_text) <= 100000),
  add constraint source_documents_metadata_shape check (
    jsonb_typeof(metadata) = 'object'
    and (not (metadata ? 'sourceDate') or metadata ->> 'sourceDate' ~ '^\d{4}-\d{2}-\d{2}$')
    and (not (metadata ? 'stakeholder') or char_length(metadata ->> 'stakeholder') <= 160)
    and (not (metadata ? 'notes') or char_length(metadata ->> 'notes') <= 2000)
  );

create index source_documents_document_key_idx
  on source_documents (document_key, revision_number);
create index source_documents_supersedes_idx
  on source_documents (supersedes_source_document_id);

-- ---------------------------------------------------------------------------
-- The two facts the guards need to consult
-- ---------------------------------------------------------------------------
-- Both are SECURITY DEFINER because a trigger must see the *whole* truth: a run
-- belonging to a row the caller cannot read still locks that row. Neither takes an
-- actor argument, neither is callable by anyone but an authenticated user, and both
-- pin search_path so a rogue schema cannot shadow the tables they read.
create or replace function source_document_is_locked(p_source uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from analysis_runs where source_document_id = p_source);
$$;

create or replace function project_is_active(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from projects where id = p_project and status = 'active');
$$;

revoke execute on function source_document_is_locked(uuid) from public;
revoke execute on function project_is_active(uuid) from public;
grant execute on function source_document_is_locked(uuid) to authenticated;
grant execute on function project_is_active(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- INSERT guard — where a revision may be born, and as what
-- ---------------------------------------------------------------------------
-- The application resolves the previous revision from the route and the database and
-- never trusts a hidden form field. This trigger is what makes that a guarantee
-- rather than a habit: even a hand-rolled PostgREST insert cannot forge a chain.
create or replace function guard_source_document_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  prev_key     uuid;
  prev_number  integer;
  prev_project uuid;
begin
  if not project_is_active(new.project_id) then
    raise exception 'project is archived and read-only; restore it before adding sources'
      using errcode = 'restrict_violation';
  end if;

  if new.supersedes_source_document_id is null then
    if new.revision_number <> 1 then
      raise exception 'a source document without a predecessor must be revision 1'
        using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  select document_key, revision_number, project_id
    into prev_key, prev_number, prev_project
    from source_documents
   where id = new.supersedes_source_document_id;

  if not found then
    raise exception 'the superseded revision does not exist'
      using errcode = 'foreign_key_violation';
  end if;
  if prev_project is distinct from new.project_id then
    raise exception 'a revision must stay in the same project as the revision it supersedes'
      using errcode = 'restrict_violation';
  end if;
  if new.document_key is distinct from prev_key then
    raise exception 'a revision must keep the document identity of the revision it supersedes'
      using errcode = 'restrict_violation';
  end if;
  if new.revision_number <> prev_number + 1 then
    raise exception 'revision number must be exactly one more than the revision it supersedes'
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

create trigger source_documents_guard_insert
  before insert on source_documents
  for each row execute function guard_source_document_insert();

-- ---------------------------------------------------------------------------
-- UPDATE guard — replaces the blanket rejection from 20260724000003
-- ---------------------------------------------------------------------------
-- Editing is permitted only while the revision is unreferenced. Once a run cites it,
-- the whole record freezes: title and metadata included, because a citation is a
-- snapshot of the document as it read at that moment, not of its body alone.
drop trigger source_documents_no_update on source_documents;

create or replace function guard_source_document_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if source_document_is_locked(old.id) then
    raise exception 'this revision has been analysed and is locked; create a new revision instead'
      using errcode = 'restrict_violation';
  end if;
  if not project_is_active(old.project_id) then
    raise exception 'project is archived and read-only; restore it first'
      using errcode = 'restrict_violation';
  end if;

  if new.project_id      is distinct from old.project_id
  or new.created_by      is distinct from old.created_by
  or new.created_at      is distinct from old.created_at
  or new.document_key    is distinct from old.document_key
  or new.revision_number is distinct from old.revision_number
  or new.supersedes_source_document_id is distinct from old.supersedes_source_document_id then
    raise exception 'project, creator and revision identity are fixed when a source is created'
      using errcode = 'restrict_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger source_documents_guard_update
  before update on source_documents
  for each row execute function guard_source_document_update();

-- source_documents_no_delete from 20260724000003 stays exactly as it is. Evidence is
-- never removed by the application; permanent purge is a privileged retention
-- workflow, not a user action (docs/architecture/DATA-MODEL.md §C.3).

-- ---------------------------------------------------------------------------
-- RLS: sources become updatable by project members
-- ---------------------------------------------------------------------------
-- The policy answers "may this user touch this row at all"; the trigger above answers
-- "and may this row be touched right now". Neither is sufficient alone.
create policy source_documents_update on source_documents
  for update using (is_project_member(project_id))
  with check (is_project_member(project_id));
