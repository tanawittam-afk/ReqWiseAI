-- ReqWiseAI — Phase 3A
-- Immutability, enforced twice over (DATA-MODEL.md §C.3):
--
--   1. RLS omits UPDATE/DELETE policies on these tables (next-but-one migration), so
--      a normal authenticated user cannot mutate them at all.
--   2. The triggers below RAISE on UPDATE/DELETE regardless of role, so even the
--      service role — which bypasses RLS — cannot rewrite history by mistake.
--
-- source_documents and analysis_runs are wholly immutable. item_versions and
-- review_activities are append-only. analysis_items is deliberately NOT here: it is
-- the mutable review surface.

create or replace function reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'table % is append-only / immutable; % is not permitted',
    tg_table_name, tg_op
    using errcode = 'restrict_violation';
end;
$$;

-- Fully immutable: no UPDATE, no DELETE.
create trigger source_documents_no_update
  before update on source_documents
  for each row execute function reject_mutation();
create trigger source_documents_no_delete
  before delete on source_documents
  for each row execute function reject_mutation();

create trigger analysis_runs_no_update
  before update on analysis_runs
  for each row execute function reject_mutation();
create trigger analysis_runs_no_delete
  before delete on analysis_runs
  for each row execute function reject_mutation();

-- Append-only audit: rows may be inserted, never changed or removed.
create trigger item_versions_no_update
  before update on item_versions
  for each row execute function reject_mutation();
create trigger item_versions_no_delete
  before delete on item_versions
  for each row execute function reject_mutation();

create trigger review_activities_no_update
  before update on review_activities
  for each row execute function reject_mutation();
create trigger review_activities_no_delete
  before delete on review_activities
  for each row execute function reject_mutation();
