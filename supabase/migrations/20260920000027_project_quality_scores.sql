-- ReqWiseAI — Phase 2, Slice 3: project-card quality-score badge
--
-- A view over each project's LATEST analysis run's quality score, matching the same
-- formula `lib/analysis/workspace-view.ts`'s `qualityScore()` computes client-side for
-- a single already-loaded run — this view exists only because the project list needs
-- the number for every card cheaply, without loading every run's items into Node.
--
-- WHY `security_invoker = true` IS LOAD-BEARING: a view with no security clause runs
-- as its OWNER by default, bypassing RLS entirely — for a view that joins
-- analysis_runs/analysis_items across the whole table, that would leak every tenant's
-- score to every other tenant. `security_invoker = true` makes the view run as the
-- CALLING user instead, so `analysis_items_select`/the runs table's own RLS policies
-- (`is_project_member`) still apply row by row, exactly as if the query had been
-- written inline. This is the one thing the second-user check below must catch if it
-- is ever wrong.
--
-- WHY A VIEW, NOT A FUNCTION: `listProjects()` already embeds cheap aggregates
-- (`lib/projects/queries.ts`); a view composes into a second, separate PostgREST
-- select scoped to the same `project_id` list in one round trip, no RPC needed, and
-- no write surface to guard (it's read-only by construction).
--
-- A project with no runs or no open findings resolves to 100, not null — a LEFT JOIN
-- plus COALESCE, not an INNER JOIN, so "no data yet" reads as a clean project rather
-- than disappearing from the result set.

create view project_quality_scores
with (security_invoker = true) as
select
  r.project_id,
  greatest(0, 100 - coalesce(sum(
    case f.attributes ->> 'finding'
      when 'conflicting' then 15
      when 'untestable'  then 10
      when 'ambiguous'   then 8
      when 'incomplete'  then 8
      when 'duplicate'   then 5
      else 0
    end
  ), 0))::int as quality_score
from analysis_runs r
left join analysis_items f
  on f.analysis_run_id = r.id
  and f.item_type = 'quality_finding'
  and f.workflow_state = 'open'
where r.id = (
  select r2.id from analysis_runs r2
  where r2.project_id = r.project_id
  order by r2.created_at desc
  limit 1
)
group by r.project_id;
