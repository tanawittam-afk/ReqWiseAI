-- Removes everything the verify-*.mts scripts create.
--
--   npx supabase db query --linked -f scripts/verify-db-cleanup.sql
--
-- **Run the dry run first**, every time:
--
--   npx supabase db query --linked -f scripts/verify-db-cleanup-dryrun.sql
--
-- It reports what these patterns match and — more usefully — what they do not, including the
-- two real demo accounts and an explicit `unknown` bucket. This file disables immutability
-- triggers and cascades across seven tables plus change_requests; it is the most destructive
-- operation in this repository and there is no undo (see HANDOFF.md's 2026-07-30 entry for
-- what happens when a pattern here is too broad — there was no backup, and it was not
-- recoverable). The two files share their patterns by convention, not by mechanism (a `.sql`
-- file cannot import another), so a new fixture name has to be added to both.
--
-- Needed because the verification data cannot be deleted through the API: the
-- immutability triggers refuse DELETE on source_documents and analysis_runs, and they
-- refuse it for the service role too — by design (20260724000003_immutability.sql).
-- A cascade from `projects` therefore fails as well. Disabling the user triggers for
-- the duration of the delete is a maintenance operation, not something the application
-- can ever do. change_requests needs no trigger disabled — it was designed with an
-- UPDATE guard but no DELETE-blocking trigger, so it cascades normally through its
-- foreign key to analysis_items once that table's own triggers are disabled.
--
-- ---------------------------------------------------------------------------------------
-- EXPLICIT DESTRUCTIVE FLAG — this file refuses to run until you edit it.
-- Read the dry-run output first. Then, immediately before running, change the `false`
-- below to `true` and save. Change it back to `false` (or just don't commit the `true`)
-- afterward — this flag is not meant to sit at `true` in the repository.
-- ---------------------------------------------------------------------------------------
do $$
begin
  if not (false) then
    raise exception
      'Refusing to run the destructive cleanup: the confirmation flag at the top of '
      'scripts/verify-db-cleanup.sql is still false. Read the dry-run output '
      '(verify-db-cleanup-dryrun.sql) first, then edit this file''s `if not (false)` '
      'line to `if not (true)` immediately before running, and change it back '
      'afterward.'
      using errcode = 'restrict_violation';
  end if;
end $$;

begin;

-- Compute the exact doomed sets once, into temp tables, so the pre-flight safety check
-- below and the actual deletes further down operate on the identical set of rows — there
-- is no way for the assertion to pass against one set and the delete to run against another.
create temporary table _cleanup_doomed_users on commit drop as
select u.id, u.email
  from auth.users u
 where u.email like 'reqwise-verify-%@example.com'
    or u.email like 'reqwise-src-%@example.com'
    or u.email like 'reqwise-analysis-%@example.com'
    or u.email like 'reqwise-review-%@example.com'
    or u.email like 'reqwise-wf-%@example.com'
    or u.email like 'reqwise-tr-%@example.com'
    or u.email like 'reqwise-export-%@example.com'
    or u.email like 'reqwise-cr-%@example.com';

create temporary table _cleanup_doomed_projects on commit drop as
select pr.id, pr.name, pr.organization_id
  from projects pr
 where pr.name like 'Verification project%'
    or pr.name like 'Slice 2 verification project%'
    or pr.name like 'Slice 3 %'
    or pr.name like 'Slice 4 %'
    or pr.name like 'User B''s project%'
    or pr.name like 'Review verification %'
    or pr.name like 'Archived verification %'
    or pr.name like 'Outsider project %'
    or pr.name like 'Second project %'
    or pr.name like 'Workflow verification %'
    or pr.name like 'Archived workflow %'
    or pr.name like 'Outsider workflow %'
    or pr.name like 'Traceability A %'
    or pr.name like 'Traceability B %'
    or pr.name like 'Traceability archived %'
    or pr.name like 'Export verification%'
    or pr.name like 'Change request verification %'
    or pr.name like 'Archived CR project %'
    or pr.name like 'Outsider CR project %'
    or pr.name like 'Second CR project %';

-- Refuse to delete a protected account or a demo-owned project. This is the exact failure
-- mode that caused the 2026-07-30 data loss (a pattern above matched more than intended) —
-- checked here, every run, against the two real accounts by name, not re-derived from the
-- patterns themselves (a bug in the patterns must not be able to talk this check into
-- agreeing with itself).
do $$
declare
  v_protected_hit integer;
  v_demo_project_hit integer;
begin
  select count(*) into v_protected_hit
    from _cleanup_doomed_users
   where email in ('slice1-demo@example.com', 'slice3.demo@reqwise.dev');
  if v_protected_hit > 0 then
    raise exception
      'Refusing to run: % protected demo account(s) matched a fixture pattern. '
      'This must never happen — stop and inspect the patterns before touching anything.',
      v_protected_hit
      using errcode = 'restrict_violation';
  end if;

  select count(*) into v_demo_project_hit
    from _cleanup_doomed_projects dp
    join organization_members m on m.organization_id = dp.organization_id
    join auth.users u on u.id = m.user_id
   where u.email in ('slice1-demo@example.com', 'slice3.demo@reqwise.dev');
  if v_demo_project_hit > 0 then
    raise exception
      'Refusing to run: % project(s) owned by a protected demo account matched a '
      'fixture pattern. Stop and inspect the patterns before touching anything.',
      v_demo_project_hit
      using errcode = 'restrict_violation';
  end if;
end $$;

alter table source_documents  disable trigger user;
alter table analysis_runs     disable trigger user;
alter table item_versions     disable trigger user;
alter table review_activities disable trigger user;

-- Cascades to source_documents, analysis_runs, analysis_items, item_versions,
-- item_source_references, item_relations, review_activities and (since the
-- change-request slice) change_requests, via analysis_items' own cascade.
--
-- The projects_guard_update trigger only fires on UPDATE, so a delete needs no
-- special handling here — but the archive lifecycle means the application itself has
-- no delete path at all, which is the point of this file.
delete from projects where id in (select id from _cleanup_doomed_projects);

alter table source_documents  enable trigger user;
alter table analysis_runs     enable trigger user;
alter table item_versions     enable trigger user;
alter table review_activities enable trigger user;

-- Cascades to profiles and organization_members.
delete from auth.users where id in (select id from _cleanup_doomed_users);

-- Personal organizations are not owned by a user row, so they outlive the cascade.
delete from organizations o
 where o.is_personal
   and not exists (
     select 1 from organization_members m where m.organization_id = o.id
   );

commit;
