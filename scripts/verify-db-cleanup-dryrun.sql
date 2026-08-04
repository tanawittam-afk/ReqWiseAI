-- What `verify-db-cleanup.sql` WOULD delete. Deletes nothing — this file contains no
-- INSERT, UPDATE or DELETE, only SELECT/CTE, and needs no transaction.
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
-- still are not. `known_groups` below names which script owns each pattern so a new script
-- can be slotted in as one more row rather than a guess at which `like` to extend.
--
-- Read every section, not just `would_delete`: an empty `would_delete` is fine, a demo
-- project appearing anywhere other than `preserved`/`manual_review` is not, and a non-empty
-- `unknown` section means some row in this project matches neither a known fixture pattern
-- nor a known demo account — stop and find out what it is before ever widening a pattern to
-- reach it.

with known_groups(verification_script, account_pattern, project_pattern) as (
  values
    ('verify-db.mts',              'reqwise-verify-%@example.com',  'Verification project%'),
    ('verify-db.mts',              'reqwise-verify-%@example.com',  'Slice 2 verification project%'),
    ('verify-projects.mts',        'reqwise-verify-%@example.com',  'User B''s project%'),
    ('verify-sources.mts',         'reqwise-src-%@example.com',     'Slice 3 %'),
    ('verify-sources.mts',         'reqwise-src-%@example.com',     'Slice 4 %'),
    ('verify-review.mts',          'reqwise-review-%@example.com',  'Review verification %'),
    ('verify-review.mts',          'reqwise-review-%@example.com',  'Archived verification %'),
    ('verify-review.mts',          'reqwise-review-%@example.com',  'Outsider project %'),
    ('verify-review.mts',          'reqwise-review-%@example.com',  'Second project %'),
    ('verify-workflow.mts',        'reqwise-wf-%@example.com',      'Workflow verification %'),
    ('verify-workflow.mts',        'reqwise-wf-%@example.com',      'Archived workflow %'),
    ('verify-workflow.mts',        'reqwise-wf-%@example.com',      'Outsider workflow %'),
    ('verify-traceability.mts',    'reqwise-tr-%@example.com',      'Traceability A %'),
    ('verify-traceability.mts',    'reqwise-tr-%@example.com',      'Traceability B %'),
    ('verify-traceability.mts',    'reqwise-tr-%@example.com',      'Traceability archived %'),
    ('verify-export.mts',          'reqwise-export-%@example.com',  'Export verification%'),
    -- verify-change-requests.mts — added this session; exact literal prefixes read from
    -- the script itself (emailA/emailB and the four newProject() call sites), narrow
    -- enough that they cannot collide with any of the four real demo project names.
    ('verify-change-requests.mts', 'reqwise-cr-%@example.com',      'Change request verification %'),
    ('verify-change-requests.mts', 'reqwise-cr-%@example.com',      'Archived CR project %'),
    ('verify-change-requests.mts', 'reqwise-cr-%@example.com',      'Outsider CR project %'),
    ('verify-change-requests.mts', 'reqwise-cr-%@example.com',      'Second CR project %'),
    -- verify-workspace.mts — added with Phase 5. Exact literal prefixes read from the
    -- script's own emailA/emailB and its three newProject() call sites (ACTIVE_NAME,
    -- ARCHIVED_NAME, OUTSIDER_NAME), not guessed.
    ('verify-workspace.mts',      'reqwise-ws-%@example.com',      'Workspace verification %'),
    ('verify-workspace.mts',      'reqwise-ws-%@example.com',      'Archived workspace project %'),
    ('verify-workspace.mts',      'reqwise-ws-%@example.com',      'Outsider workspace project %')
    -- verify-analysis.mts and verify-gemini.mts create no fixture rows: verify-analysis
    -- only reads (forensics + the legacy verifier), and verify-gemini's offline mode
    -- never touches Supabase at all (no client is constructed — grep-checked). Neither
    -- needs a pattern here.
),
account_patterns(pattern) as (
  select distinct account_pattern from known_groups
),
project_patterns(pattern) as (
  select distinct project_pattern from known_groups
),
protected_demo_emails(email) as (
  values ('slice1-demo@example.com'), ('slice3.demo@reqwise.dev')
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
),
demo_projects as (
  select pr.id, pr.name
    from projects pr
    join organization_members m on m.organization_id = pr.organization_id
    join auth.users u on u.id = m.user_id
    join protected_demo_emails d on d.email = u.email
),
report as (
select 'would_delete' as section, 'auth.users' as target, count(*) as rows, null as detail
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
select 'would_delete', 'change_requests', count(*), null
  from change_requests x where x.project_id in (select id from doomed_projects)
union all
-- change_request_* activity rows live inside review_activities (change_request_id column,
-- migration 20260727000023), not a separate table — counted here for visibility only, not
-- as an extra delete target (the review_activities count above already includes them).
select 'would_delete', 'review_activities (change-request kind)', count(*), null
  from review_activities x
 where x.project_id in (select id from doomed_projects)
   and x.change_request_id is not null
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
-- Per-verification-group breakdown, so a shrinking or growing group is visible without
-- reading the row-level detail. A group with 0 accounts and 0 projects is normal — it
-- means that script has not been run against this project (or was already cleaned).
select
  'would_delete_by_group',
  g.verification_script,
  (select count(distinct u.id) from auth.users u where u.email like g.account_pattern),
  'accounts matching ' || g.account_pattern
  from (select distinct verification_script, account_pattern from known_groups) g
union all
select
  'would_delete_by_group',
  g.verification_script || ' / ' || g.project_pattern,
  (select count(*) from projects pr where pr.name like g.project_pattern),
  'projects matching ' || g.project_pattern
  from known_groups g
union all
-- Everything the patterns do NOT reach. A real account or project must appear here, and
-- ideally *only* the two protected demo accounts' own rows (see `unknown` below for the
-- stricter check: preserved minus the two known demo accounts should be empty).
select 'preserved', 'auth.users', count(*), string_agg(u.email, ', ' order by u.email)
  from auth.users u
 where u.id not in (select id from doomed_users)
union all
select 'preserved', 'projects', count(*), string_agg(pr.name, ' | ' order by pr.name)
  from projects pr
 where pr.id not in (select id from doomed_projects)
union all
-- The two real demo accounts specifically, so their presence in `preserved` above is
-- confirmed rather than assumed. Expect exactly 2.
select 'preserved_demo_accounts', 'auth.users', count(*), string_agg(u.email, ', ' order by u.email)
  from auth.users u
  join protected_demo_emails d on d.email = u.email
union all
-- Left behind on purpose: a hand-made project inside a real demo account. Widening the
-- patterns to reach demo accounts would make the cleanup script able to delete the demo.
select 'manual_review', 'demo-account projects', count(*), string_agg(demo_projects.name, ' | ' order by demo_projects.name)
  from demo_projects
union all
-- Stop-and-look bucket: any account that is neither a recognized verification fixture
-- nor one of the two protected demo accounts. In a project that only ever holds demo
-- data and verify-*.mts fixtures, this must be empty. A non-empty result means either a
-- new verify-*.mts script needs a pattern added above, or a real, unrecognized user
-- exists — never fix a non-empty result by widening a pattern; find out what the row is
-- first.
select 'unknown', 'auth.users', count(*), string_agg(u.email, ', ' order by u.email)
  from auth.users u
 where u.id not in (select id from doomed_users)
   and u.email not in (select email from protected_demo_emails)
union all
-- Same idea for projects: neither a recognized fixture project nor owned by a protected
-- demo account.
select 'unknown', 'projects', count(*), string_agg(pr.name, ' | ' order by pr.name)
  from projects pr
 where pr.id not in (select id from doomed_projects)
   and pr.id not in (select id from demo_projects)
)
select * from report
order by
  case section
    when 'would_delete' then 0
    when 'would_delete_by_group' then 1
    when 'preserved' then 2
    when 'preserved_demo_accounts' then 3
    when 'manual_review' then 4
    when 'unknown' then 5
    else 9
  end,
  target;
