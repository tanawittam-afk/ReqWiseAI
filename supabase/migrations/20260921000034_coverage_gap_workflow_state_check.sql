-- Phase 3 (Gap check), Slice 3 — bug-fix follow-up to 20260921000033.
--
-- Two more type-scoped CHECK constraints from 20260725000016, each an independent gate
-- on the same rule `enforce_insert_draft()`/`update_coverage_gap()` enforce —
-- "belt and suspenders", the same phrase 20260920000029's own comment uses for this
-- exact relationship. Extending the trigger's/is_reviewable_item_type()'s IN-lists in
-- 20260921000033 without also extending these two CHECK constraints left the gates
-- disagreeing. Caught live via `npm run verify:coverage-gap` against the applied
-- 031/032/033 migrations, not caught by any of build/lint/typecheck/test (a database
-- constraint, invisible to all four). 20260921000033 is already applied and is never
-- edited — this is a new migration, not a correction in place.
--
--  1. `analysis_items_workflow_state_by_type` — the trigger assigns
--     `workflow_state := 'open'` for a new `coverage_gap` row, and this constraint's
--     `else workflow_state is null` branch was rejecting that exact row.
--
--  2. `analysis_items_resolution_by_type` — `update_coverage_gap()` writes
--     `resolution_text`/`resolved_at`/`resolved_by` on resolve/dismiss, and this
--     constraint's `item_type in ('open_question', 'quality_finding')` guard did not
--     yet admit `coverage_gap`, so it would have required those columns to stay null —
--     directly contradicting what the RPC just wrote. Found by re-reading the same
--     migration file before it repeated, not by a second failed live run.
--
--  3. `display_id_prefix()` (20260724000005) — a `case p_type when ... end` with no
--     `else`, so an unmatched type returns SQL NULL, not an error. Every item
--     `persist_analysis_result()` inserts (20260727000020) gets its prefix from this
--     function — Slice 5 appends `coverage_gap` items straight into that same
--     `p_items` array, so a NULL prefix there would have broken display-id allocation
--     for the *whole* analysis run, not just the gap items (no partial write; see
--     DATA-MODEL §C.13). Found by reasoning through Slice 5's call path while fixing
--     (1) and (2) above, ahead of Slice 5 actually exercising it — not caught live,
--     since nothing yet calls this function with `coverage_gap`.

alter table analysis_items drop constraint analysis_items_workflow_state_by_type;

alter table analysis_items
  add constraint analysis_items_workflow_state_by_type check (
    case item_type
      when 'open_question' then
        workflow_state is not null
        and workflow_state in ('open', 'answered', 'deferred', 'not_applicable')
      when 'quality_finding' then
        workflow_state is not null
        and workflow_state in ('open', 'acknowledged', 'resolved', 'dismissed')
      when 'coverage_gap' then
        workflow_state is not null
        and workflow_state in ('open', 'acknowledged', 'resolved', 'dismissed')
      else workflow_state is null
    end
  );

alter table analysis_items drop constraint analysis_items_resolution_by_type;

alter table analysis_items
  add constraint analysis_items_resolution_by_type check (
    item_type in ('open_question', 'quality_finding', 'coverage_gap')
    or (resolution_text is null and resolved_at is null
        and resolved_by is null and follow_up_on is null)
  );

create or replace function display_id_prefix(p_type item_type)
returns text
language sql
immutable
as $$
  select case p_type
    when 'problem_statement'          then 'PS'
    when 'business_objective'         then 'OBJ'
    when 'stakeholder'                then 'STK'
    when 'business_requirement'       then 'BR'
    when 'functional_requirement'     then 'FR'
    when 'non_functional_requirement' then 'NFR'
    when 'user_story'                 then 'US'
    when 'acceptance_criterion'       then 'AC'
    when 'business_rule'              then 'RULE'
    when 'assumption'                 then 'ASM'
    when 'risk'                       then 'RISK'
    when 'constraint'                 then 'CON'
    when 'open_question'              then 'Q'
    when 'quality_finding'            then 'QF'
    when 'coverage_gap'               then 'GAP'
  end;
$$;
