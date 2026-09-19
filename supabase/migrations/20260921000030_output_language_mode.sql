-- ReqWiseAI — Phase 2, Slice 6: output-language "match source"
--
-- `projects.output_lang` stays exactly what it always was — a binary `output_lang`
-- enum value, `'th'` or `'en'` — because that enum type is SHARED with
-- `profiles.ui_locale` and `source_documents.input_lang` (20260724000001_enums.sql):
-- widening it to add a third value would widen those two unrelated columns as well.
-- Instead, a project's *preference* ("always th", "always en", or "match the source
-- each time") lives in a new, separate column, `output_lang_mode`.
--
-- `output_lang` keeps its old meaning for a `'fixed'` project: the value to use. For a
-- `'match_source'` project it becomes a "last resolved" record, written by
-- `buildAnalysisInput()` (lib/analysis/input.ts) each time a run actually executes, via
-- the Thai-ratio detector (lib/analysis/language-detect.ts) — never by this RPC, and
-- never the AI. `analysis_runs.output_lang` itself is untouched by any of this: it
-- stays a plain, factual, historical record of what a specific run was actually
-- written in.
--
-- WHY security invoker, no privilege escape needed: this is the same reasoning as
-- archive_project()/restore_project() (20260724000007) — RLS's plain
-- `projects_update` policy (`is_org_member`) already gates who may touch this row, and
-- `output_lang`/`output_lang_mode` are not in guard_project_update()'s immutable-column
-- list, so no lifecycle-flag escape hatch is needed. That trigger's existing "an
-- archived project is read-only" check already refuses this RPC on an archived
-- project, for free.

alter table projects
  add column output_lang_mode text not null default 'fixed'
    check (output_lang_mode in ('fixed', 'match_source'));

-- ---------------------------------------------------------------------------
-- set_project_output_language — the only way to change a project's output-language
-- preference after creation. p_mode is 'th' | 'en' | 'match_source'; the first two set
-- a fixed language, the third switches to match-source mode (output_lang itself is
-- left as whatever it already was — the next run resolves and overwrites it).
-- ---------------------------------------------------------------------------
create or replace function set_project_output_language(p_project uuid, p_mode text)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_exists boolean;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;

  if p_mode not in ('th', 'en', 'match_source') then
    raise exception 'invalid output language mode' using errcode = 'check_violation';
  end if;

  select true into v_exists from projects where id = p_project;
  if v_exists is null then
    raise exception 'project not found or not visible' using errcode = 'no_data_found';
  end if;

  if p_mode = 'match_source' then
    update projects set output_lang_mode = 'match_source' where id = p_project;
  else
    update projects set output_lang = p_mode::output_lang, output_lang_mode = 'fixed'
      where id = p_project;
  end if;
end;
$$;

revoke execute on function set_project_output_language(uuid, text) from public;
grant execute on function set_project_output_language(uuid, text) to authenticated;
