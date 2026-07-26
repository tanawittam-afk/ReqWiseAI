-- Removes everything the eight scripts/verify-*.mts scripts create.
--
--   npx supabase db query --linked -f scripts/verify-db-cleanup.sql
--
-- **Run the dry run first**, every time:
--
--   npx supabase db query --linked -f scripts/verify-db-cleanup-dryrun.sql
--
-- It reports what these patterns match and — more usefully — what they do not, including the
-- two real demo accounts. This file disables immutability triggers and cascades across seven
-- tables; it is the most destructive operation in this repository and there is no undo. The
-- two files share their patterns by convention, not by mechanism (a `.sql` file cannot import
-- another), so a new fixture name has to be added to both.
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
--
-- The projects_guard_update trigger only fires on UPDATE, so a delete needs no
-- special handling here — but the archive lifecycle means the application itself has
-- no delete path at all, which is the point of this file.
--
-- Every name the eight scripts use. Slices 5, 6A, 6B and 6C were missing here until
-- 2026-07-26, which is most of why 258 verification projects had accumulated: the scripts
-- kept naming new fixtures and this list stopped being updated. Demo-account projects are
-- deliberately absent — see the dry run's `manual_review` section.
delete from projects
 where name like 'Verification project%'
    or name like 'Slice 2 verification project%'
    or name like 'Slice 3 %'
    or name like 'Slice 4 %'
    or name like 'User B''s project%'
    or name like 'Review verification %'
    or name like 'Archived verification %'
    or name like 'Outsider project %'
    or name like 'Second project %'
    or name like 'Workflow verification %'
    or name like 'Archived workflow %'
    or name like 'Outsider workflow %'
    or name like 'Traceability A %'
    or name like 'Traceability B %'
    or name like 'Traceability archived %'
    or name like 'Export verification%';

alter table source_documents  enable trigger user;
alter table analysis_runs     enable trigger user;
alter table item_versions     enable trigger user;
alter table review_activities enable trigger user;

-- Cascades to profiles and organization_members.
delete from auth.users
 where email like 'reqwise-verify-%@example.com'
    or email like 'reqwise-src-%@example.com'
    or email like 'reqwise-analysis-%@example.com'
    or email like 'reqwise-review-%@example.com'
    or email like 'reqwise-wf-%@example.com'
    or email like 'reqwise-tr-%@example.com'
    or email like 'reqwise-export-%@example.com';

-- Personal organizations are not owned by a user row, so they outlive the cascade.
delete from organizations o
 where o.is_personal
   and not exists (
     select 1 from organization_members m where m.organization_id = o.id
   );

commit;
