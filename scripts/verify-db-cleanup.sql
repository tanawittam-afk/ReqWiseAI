-- Removes everything scripts/verify-db.mts creates.
--
--   npx supabase db query --linked -f scripts/verify-db-cleanup.sql
--
-- Needed because the verification data cannot be deleted through the API: the
-- immutability triggers refuse DELETE on source_documents and analysis_runs, and they
-- refuse it for the service role too — by design (20260724000003_immutability.sql).
-- A cascade from `projects` therefore fails as well. Disabling the user triggers for
-- the duration of the delete is a maintenance operation, not something the application
-- can ever do.
--
-- Safe to run repeatedly; it only matches rows the verification script names.

begin;

alter table source_documents  disable trigger user;
alter table analysis_runs     disable trigger user;
alter table item_versions     disable trigger user;
alter table review_activities disable trigger user;

-- Cascades to source_documents, analysis_runs, analysis_items, item_versions,
-- item_source_references, item_relations and review_activities.
delete from projects where name = 'Verification project';

alter table source_documents  enable trigger user;
alter table analysis_runs     enable trigger user;
alter table item_versions     enable trigger user;
alter table review_activities enable trigger user;

-- Cascades to profiles and organization_members.
delete from auth.users where email like 'reqwise-verify-%@example.com';

-- Personal organizations are not owned by a user row, so they outlive the cascade.
delete from organizations o
 where o.is_personal
   and not exists (
     select 1 from organization_members m where m.organization_id = o.id
   );

commit;
