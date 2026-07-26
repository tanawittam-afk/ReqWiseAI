-- What `verify-db-cleanup.sql` WOULD delete. Deletes nothing.
--
--   npx supabase db query --linked -f scripts/verify-db-cleanup-dryrun.sql
--
-- Why this exists: the cleanup script disables immutability triggers and cascades from
-- `projects` across seven tables. That is the most destructive operation in this repository,
-- it runs against the live project, and until now the only way to find out what it matched
-- was to run it. A dry run makes the blast radius readable first.
--
-- The two files share their patterns **by convention, not by mechanism** — a `.sql` file
-- cannot import another. When a verification script starts using a new name, add it to both
-- and re-run this dry run to confirm the new fixtures are matched and the demo accounts
-- still are not.
--
-- Read the `preserved` section as carefully as the `would_delete` one: an empty
-- `would_delete` is fine, but a demo project appearing anywhere other than `preserved` is a
-- reason to stop.

with account_patterns(pattern) as (
  values
    ('reqwise-verify-%@example.com'),
    ('reqwise-src-%@example.com'),
    ('reqwise-analysis-%@example.com'),
    ('reqwise-review-%@example.com'),
    ('reqwise-wf-%@example.com'),
    ('reqwise-tr-%@example.com'),
    ('reqwise-export-%@example.com')
),
project_patterns(pattern) as (
  values
    ('Verification project%'),
    ('Slice 2 verification project%'),
    ('Slice 3 %'),
    ('Slice 4 %'),
    ('User B''s project%'),
    ('Review verification %'),
    ('Archived verification %'),
    ('Outsider project %'),
    ('Second project %'),
    ('Workflow verification %'),
    ('Archived workflow %'),
    ('Outsider workflow %'),
    ('Traceability A %'),
    ('Traceability B %'),
    ('Traceability archived %'),
    ('Export verification%')
),
doomed_users as (
  select u.id, u.email
    from auth.users u
    join account_patterns p on u.email like p.pattern
),
doomed_projects as (
  select pr.id, pr.name, pr.organization_id
    from projects pr
    join project_patterns p on pr.name like p.pattern
)
select
  'would_delete' as section,
  'auth.users'   as target,
  count(*)       as rows,
  null           as detail
  from doomed_users
union all
select 'would_delete', 'projects', count(*), null from doomed_projects
union all
select 'would_delete', 'source_documents', count(*), null
  from source_documents s where s.project_id in (select id from doomed_projects)
union all
select 'would_delete', 'analysis_runs', count(*), null
  from analysis_runs r where r.project_id in (select id from doomed_projects)
union all
select 'would_delete', 'analysis_items', count(*), null
  from analysis_items i where i.project_id in (select id from doomed_projects)
union all
select 'would_delete', 'item_source_references', count(*), null
  from item_source_references x where x.project_id in (select id from doomed_projects)
union all
select 'would_delete', 'item_relations', count(*), null
  from item_relations x where x.project_id in (select id from doomed_projects)
union all
select 'would_delete', 'item_versions', count(*), null
  from item_versions x where x.project_id in (select id from doomed_projects)
union all
select 'would_delete', 'review_activities', count(*), null
  from review_activities x where x.project_id in (select id from doomed_projects)
union all
-- Personal organizations outlive the user cascade, so the cleanup sweeps the empty ones.
select 'would_delete', 'organizations (orphaned personal)', count(*), null
  from organizations o
 where o.is_personal
   and not exists (
     select 1 from organization_members m
      where m.organization_id = o.id
        and m.user_id not in (select id from doomed_users)
   )
union all
-- Everything the patterns do NOT reach. A real account or project must appear here.
select 'preserved', 'auth.users', count(*), string_agg(u.email, ', ' order by u.email)
  from auth.users u
 where u.id not in (select id from doomed_users)
union all
select 'preserved', 'projects', count(*), string_agg(pr.name, ' | ' order by pr.name)
  from projects pr
 where pr.id not in (select id from doomed_projects)
union all
-- Left behind on purpose: a hand-made project inside a real demo account. Widening the
-- patterns to reach demo accounts would make the cleanup script able to delete the demo.
select 'manual_review', 'demo-account projects', count(*), string_agg(pr.name, ' | ' order by pr.name)
  from projects pr
  join organization_members m on m.organization_id = pr.organization_id
  join auth.users u on u.id = m.user_id
 where u.email in ('slice1-demo@example.com', 'slice3.demo@reqwise.dev')
order by section desc, target;
