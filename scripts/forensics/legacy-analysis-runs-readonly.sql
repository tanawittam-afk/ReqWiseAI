-- ReqWiseAI Phase B legacy analysis-run forensics.
-- STRICTLY READ-ONLY: every statement in this file is SELECT/CTE only.
-- It intentionally returns identifiers and structural metadata, never source text,
-- payload values, prompts, project names, source titles, email addresses, or comments.

with
item_stats as (
  select
    analysis_run_id,
    count(*)::integer as item_count,
    count(*) filter (
      where item_type in (
        'business_requirement',
        'functional_requirement',
        'non_functional_requirement'
      )
    )::integer as requirement_count,
    count(*) filter (where item_type = 'user_story')::integer as user_story_count,
    count(*) filter (where item_type = 'acceptance_criterion')::integer
      as acceptance_criterion_count,
    count(*) filter (where item_type = 'assumption')::integer as assumption_count,
    count(*) filter (where item_type = 'risk')::integer as risk_count,
    count(*) filter (where item_type = 'open_question')::integer as question_count,
    count(*) filter (where item_type = 'quality_finding')::integer
      as quality_finding_count,
    count(*) filter (
      where workflow_state is not null and workflow_state::text <> 'open'
    )::integer as workflow_changed_count
  from public.analysis_items
  group by analysis_run_id
),
reference_stats as (
  select ai.analysis_run_id, count(isr.id)::integer as source_reference_count
  from public.analysis_items ai
  left join public.item_source_references isr on isr.item_id = ai.id
  group by ai.analysis_run_id
),
relation_stats as (
  select ai.analysis_run_id, count(distinct ir.id)::integer as relation_count
  from public.analysis_items ai
  left join public.item_relations ir
    on ir.from_item_id = ai.id or ir.to_item_id = ai.id
  group by ai.analysis_run_id
),
version_stats as (
  select ai.analysis_run_id, count(iv.id)::integer as item_version_count
  from public.analysis_items ai
  left join public.item_versions iv on iv.item_id = ai.id
  group by ai.analysis_run_id
),
review_stats as (
  select ai.analysis_run_id, count(ra.id)::integer as review_activity_count
  from public.analysis_items ai
  left join public.review_activities ra on ra.item_id = ai.id
  group by ai.analysis_run_id
),
base as (
  select
    ar.id as analysis_run_id,
    ar.project_id,
    p.organization_id,
    ar.source_document_id,
    ar.created_at,
    null::timestamptz as updated_at,
    ar.validation_status::text as status,
    ar.provider,
    ar.model,
    ar.prompt_version,
    ar.schema_version,
    ar.output_lang::text as output_lang,
    ar.request_key,
    md5(ar.created_by::text) as creator_id_hash,
    coalesce((
      select string_agg(om.role::text, ',' order by om.role::text)
      from public.organization_members om
      where om.organization_id = p.organization_id
        and om.user_id = ar.created_by
    ), 'not-a-current-member') as creator_organization_roles,
    (select count(*)::integer from public.source_documents sd
      where sd.id = ar.source_document_id and sd.project_id = ar.project_id)
      as source_document_count,
    ar.raw_provider_output is null or ar.raw_provider_output = 'null'::jsonb
      as raw_payload_null,
    jsonb_typeof(ar.raw_provider_output) as raw_payload_type,
    case when jsonb_typeof(ar.raw_provider_output) = 'object'
      then array(select jsonb_object_keys(ar.raw_provider_output) order by 1)
      else array[]::text[]
    end as raw_payload_top_level_keys,
    ar.validated_output is null or ar.validated_output = 'null'::jsonb
      as validated_payload_null,
    jsonb_typeof(ar.validated_output) as validated_payload_type,
    case when jsonb_typeof(ar.validated_output) = 'object'
      then array(select jsonb_object_keys(ar.validated_output) order by 1)
      else array[]::text[]
    end as validated_payload_top_level_keys,
    ar.validated_output = '{"items":[]}'::jsonb as validated_items_empty_exact,
    ar.error is null or ar.error = 'null'::jsonb as error_payload_null,
    jsonb_typeof(ar.error) as error_payload_type,
    case when jsonb_typeof(ar.error) = 'object'
      then array(select jsonb_object_keys(ar.error) order by 1)
      else array[]::text[]
    end as error_payload_top_level_keys,
    coalesce(i.item_count, 0) as item_count,
    coalesce(i.requirement_count, 0) as requirement_count,
    coalesce(i.user_story_count, 0) as user_story_count,
    coalesce(i.acceptance_criterion_count, 0) as acceptance_criterion_count,
    coalesce(i.assumption_count, 0) as assumption_count,
    coalesce(i.risk_count, 0) as risk_count,
    coalesce(i.question_count, 0) as question_count,
    coalesce(i.quality_finding_count, 0) as quality_finding_count,
    coalesce(i.workflow_changed_count, 0) as workflow_changed_count,
    coalesce(ref.source_reference_count, 0) as source_reference_count,
    coalesce(rel.relation_count, 0) as relation_count,
    coalesce(ver.item_version_count, 0) as item_version_count,
    coalesce(rev.review_activity_count, 0) as review_activity_count,
    (select count(*)::integer from public.analysis_runs pr
      where pr.project_id = ar.project_id) as project_run_count,
    (select count(*)::integer from public.source_documents ps
      where ps.project_id = ar.project_id) as project_source_count,
    (select count(*)::integer from public.analysis_items pi
      where pi.project_id = ar.project_id) as project_item_count,
    (select count(*)::integer
      from public.item_source_references pir
      where pir.project_id = ar.project_id) as project_source_reference_count,
    (select count(*)::integer from public.item_relations prel
      where prel.project_id = ar.project_id) as project_relation_count,
    (select count(*)::integer from public.item_versions piv
      where piv.project_id = ar.project_id) as project_item_version_count,
    (select count(*)::integer from public.review_activities pra
      where pra.project_id = ar.project_id) as project_review_activity_count,
    coalesce(ar.request_key like 'verify-%', false)
      as request_key_verification_indicator,
    coalesce(p.name ~* '(verify|verification|runtime|slice[ -]?[0-9]|test)', false)
      as project_name_verification_indicator,
    coalesce(sd.title ~* '(verify|verification|runtime|slice[ -]?[0-9]|test)', false)
      as source_title_verification_indicator,
    p.name = 'Verification project' as verify_db_project_name_exact,
    sd.title = 'edited before any analysis' as verify_db_source_title_exact,
    p.name = 'Slice 3 source verification' as verify_sources_project_name_exact,
    sd.title = 'Kick-off meeting (corrected)' as verify_sources_source_title_exact,
    coalesce(p.name ~* '(demo|sample|smart[ -]?space)', false)
      as project_name_demo_indicator,
    coalesce(sd.title ~* '(demo|sample|smart[ -]?space)', false)
      as source_title_demo_indicator,
    p.status::text as project_status,
    true as project_relationship_valid,
    true as source_relationship_valid
  from public.analysis_runs ar
  join public.projects p on p.id = ar.project_id
  join public.source_documents sd
    on sd.id = ar.source_document_id and sd.project_id = ar.project_id
  left join item_stats i on i.analysis_run_id = ar.id
  left join reference_stats ref on ref.analysis_run_id = ar.id
  left join relation_stats rel on rel.analysis_run_id = ar.id
  left join version_stats ver on ver.analysis_run_id = ar.id
  left join review_stats rev on rev.analysis_run_id = ar.id
),
incompatible as (
  select
    b.*,
    array_remove(array[
      case when nullif(btrim(provider), '') is null then 'blank_provider' end,
      case when nullif(btrim(schema_version), '') is null then 'blank_schema_version' end,
      case when status = 'valid' and raw_payload_null then 'valid_missing_raw' end,
      case when status = 'valid' and validated_payload_null
        then 'valid_missing_validated' end,
      case when status = 'valid' and not error_payload_null
        then 'valid_has_error' end,
      case when status = 'valid' and item_count = 0
        then 'valid_has_zero_items' end,
      case when status = 'invalid' and raw_payload_null
        then 'invalid_missing_raw' end,
      case when status = 'invalid' and not validated_payload_null
        then 'invalid_has_validated' end,
      case when status = 'invalid' and error_payload_null
        then 'invalid_missing_error' end,
      case when status = 'invalid' and item_count <> 0
        then 'invalid_has_items' end,
      case when status = 'invalid' and relation_count <> 0
        then 'invalid_has_relations' end,
      case when status = 'provider_error' and not raw_payload_null
        then 'provider_error_has_raw' end,
      case when status = 'provider_error' and not validated_payload_null
        then 'provider_error_has_validated' end,
      case when status = 'provider_error' and error_payload_null
        then 'provider_error_missing_error' end,
      case when status = 'provider_error' and item_count <> 0
        then 'provider_error_has_items' end,
      case when status = 'provider_error' and relation_count <> 0
        then 'provider_error_has_relations' end
    ], null) as mismatch_codes
  from base b
  where
    nullif(btrim(provider), '') is null
    or nullif(btrim(schema_version), '') is null
    or (
      status = 'valid'
      and (raw_payload_null or validated_payload_null or not error_payload_null
        or item_count = 0)
    )
    or (
      status = 'invalid'
      and (raw_payload_null or not validated_payload_null or error_payload_null
        or item_count <> 0 or relation_count <> 0)
    )
    or (
      status = 'provider_error'
      and (not raw_payload_null or not validated_payload_null or error_payload_null
        or item_count <> 0 or relation_count <> 0)
    )
),
fingerprinted as (
  select
    i.*,
    (
      verify_db_project_name_exact
      and verify_db_source_title_exact
      and request_key is null
      and status = 'valid'
      and provider = 'mock'
      and model is null
      and prompt_version is null
      and schema_version = '1.0.0'
      and output_lang = 'th'
      and raw_payload_null
      and validated_payload_null
      and error_payload_null
      and item_count = 2
      and requirement_count = 2
      and item_version_count = 1
      and review_activity_count = 2
      and source_reference_count = 0
      and relation_count = 0
      and (
        select count(*) = 2
          and count(*) filter (
            where ai.provider_key = 'br-verification'
              and ai.item_type = 'business_requirement'
              and ai.status = 'approved'
              and ai.version_no = 2
          ) = 1
          and count(*) filter (
            where ai.provider_key = 'br-second'
              and ai.item_type = 'business_requirement'
              and ai.status = 'draft'
              and ai.version_no = 1
          ) = 1
        from public.analysis_items ai
        where ai.analysis_run_id = i.analysis_run_id
      )
      and (
        select count(*) = 1
          and count(*) filter (
            where ai.provider_key = 'br-verification'
              and iv.version_no = 1
          ) = 1
        from public.item_versions iv
        join public.analysis_items ai on ai.id = iv.item_id
        where ai.analysis_run_id = i.analysis_run_id
      )
      and (
        select count(*) = 2
          and count(*) filter (
            where ai.provider_key = 'br-verification'
              and ra.activity_type = 'status_change'
              and ra.from_status = 'draft'
              and ra.to_status = 'reviewed'
          ) = 1
          and count(*) filter (
            where ai.provider_key = 'br-verification'
              and ra.activity_type = 'approve'
              and ra.from_status = 'reviewed'
              and ra.to_status = 'approved'
          ) = 1
        from public.review_activities ra
        join public.analysis_items ai on ai.id = ra.item_id
        where ai.analysis_run_id = i.analysis_run_id
      )
    ) as verify_db_exact_fingerprint,
    (
      verify_sources_project_name_exact
      and verify_sources_source_title_exact
      and request_key is null
      and status = 'valid'
      and provider = 'mock'
      and model is null
      and prompt_version is null
      and schema_version = '1.0.0'
      and output_lang = 'th'
      and raw_payload_null
      and validated_items_empty_exact
      and error_payload_null
      and item_count = 0
      and item_version_count = 0
      and review_activity_count = 0
      and source_reference_count = 0
      and relation_count = 0
      and project_run_count = 1
      and project_source_count = 3
      and project_item_count = 0
      and project_source_reference_count = 0
      and project_relation_count = 0
      and project_item_version_count = 0
      and project_review_activity_count = 0
    ) as verify_sources_exact_fingerprint
  from incompatible i
),
classified as (
  select
    f.*,
    case
      when verify_db_exact_fingerprint or verify_sources_exact_fingerprint
        then 'Verification/Test Data'
      when not request_key_verification_indicator
        and (project_name_demo_indicator or source_title_demo_indicator)
        and (review_activity_count > 0 or item_version_count > 0)
        then 'Seed or Demo Data'
      when not request_key_verification_indicator
        and (review_activity_count > 0 or item_version_count > 0
          or workflow_changed_count > 0)
        then 'Plausible Real User Data'
      else 'Unknown / Insufficient Evidence'
    end as classification,
    case
      when verify_db_exact_fingerprint or verify_sources_exact_fingerprint
        then 'high'
      when not request_key_verification_indicator
        and (review_activity_count > 0 or item_version_count > 0
          or workflow_changed_count > 0)
        then 'high'
      when not request_key_verification_indicator
        and (project_name_demo_indicator or source_title_demo_indicator)
        and (review_activity_count > 0 or item_version_count > 0)
        then 'medium'
      else 'low'
    end as classification_confidence
  from fingerprinted f
),
summary as (
  select jsonb_build_object(
    'incompatible_count', count(*),
    'classification_totals', (
      select jsonb_object_agg(classification, n)
      from (
        select classification, count(*) as n
        from classified
        group by classification
      ) c
    ),
    'classification_run_ids', (
      select jsonb_object_agg(classification, ids)
      from (
        select classification, jsonb_agg(analysis_run_id order by created_at) as ids
        from classified
        group by classification
      ) c
    ),
    'exact_fingerprint_totals', jsonb_build_object(
      'verify_db', count(*) filter (where verify_db_exact_fingerprint),
      'verify_sources', count(*) filter (where verify_sources_exact_fingerprint),
      'unmatched', count(*) filter (
        where not verify_db_exact_fingerprint
          and not verify_sources_exact_fingerprint
      )
    ),
    'mismatch_totals', (
      select jsonb_object_agg(code, n)
      from (
        select code, count(*) as n
        from classified, unnest(mismatch_codes) code
        group by code
      ) m
    ),
    'mismatch_run_ids', (
      select jsonb_object_agg(code, ids)
      from (
        select code, jsonb_agg(analysis_run_id order by created_at) as ids
        from classified, unnest(mismatch_codes) code
        group by code
      ) m
    ),
    'structural_profile_totals', (
      select jsonb_agg(to_jsonb(profile_row) order by classification, item_count)
      from (
        select
          classification,
          classification_confidence,
          status,
          provider,
          model,
          prompt_version,
          schema_version,
          output_lang,
          raw_payload_null,
          validated_payload_null,
          validated_payload_type,
          validated_payload_top_level_keys,
          error_payload_null,
          item_count,
          requirement_count,
          user_story_count,
          acceptance_criterion_count,
          assumption_count,
          risk_count,
          question_count,
          quality_finding_count,
          source_reference_count,
          relation_count,
          item_version_count,
          review_activity_count,
          workflow_changed_count,
          source_document_count,
          project_status,
          creator_organization_roles,
          count(*) as row_count
        from classified
        group by
          classification,
          classification_confidence,
          status,
          provider,
          model,
          prompt_version,
          schema_version,
          output_lang,
          raw_payload_null,
          validated_payload_null,
          validated_payload_type,
          validated_payload_top_level_keys,
          error_payload_null,
          item_count,
          requirement_count,
          user_story_count,
          acceptance_criterion_count,
          assumption_count,
          risk_count,
          question_count,
          quality_finding_count,
          source_reference_count,
          relation_count,
          item_version_count,
          review_activity_count,
          workflow_changed_count,
          source_document_count,
          project_status,
          creator_organization_roles
      ) profile_row
    ),
    'rows_with_items', count(*) filter (where item_count > 0),
    'rows_with_human_activity', count(*) filter (
      where review_activity_count > 0 or item_version_count > 0
        or workflow_changed_count > 0
    ),
    'rows_with_relations', count(*) filter (where relation_count > 0),
    'rows_with_source_references', count(*) filter (where source_reference_count > 0),
    'project_scope', jsonb_build_object(
      'rows_in_projects_with_other_runs_or_downstream_records', count(*) filter (
        where project_run_count > 1
          or project_item_count > item_count
          or project_source_reference_count > source_reference_count
          or project_relation_count > relation_count
          or project_item_version_count > item_version_count
          or project_review_activity_count > review_activity_count
      ),
      'run_ids_in_projects_with_other_runs_or_downstream_records', coalesce(
        jsonb_agg(analysis_run_id order by created_at) filter (
          where project_run_count > 1
            or project_item_count > item_count
            or project_source_reference_count > source_reference_count
            or project_relation_count > relation_count
            or project_item_version_count > item_version_count
            or project_review_activity_count > review_activity_count
        ),
        '[]'::jsonb
      ),
      'rows_in_projects_with_other_source_documents', count(*) filter (
        where project_source_count > source_document_count
      ),
      'run_ids_in_projects_with_other_source_documents', coalesce(
        jsonb_agg(analysis_run_id order by created_at) filter (
          where project_source_count > source_document_count
        ),
        '[]'::jsonb
      ),
      'rows_with_run_local_project_dependencies', count(*) filter (
        where project_run_count = 1
          and project_item_count = item_count
          and project_source_reference_count = source_reference_count
          and project_relation_count = relation_count
          and project_item_version_count = item_version_count
          and project_review_activity_count = review_activity_count
      )
    )
  ) as result
  from classified
),
row_results as (
  select jsonb_build_object(
    'analysis_run_id', analysis_run_id,
    'project_id', project_id,
    'organization_id', organization_id,
    'source_document_id', source_document_id,
    'created_at', created_at,
    'updated_at', updated_at,
    'status', status,
    'provider', provider,
    'model', model,
    'prompt_version', prompt_version,
    'schema_version', schema_version,
    'output_lang', output_lang,
    'creator_id_hash', creator_id_hash,
    'creator_organization_roles', creator_organization_roles,
    'source_document_count', source_document_count,
    'payload_structure', jsonb_build_object(
      'raw', jsonb_build_object(
        'null', raw_payload_null,
        'type', raw_payload_type,
        'top_level_keys', raw_payload_top_level_keys
      ),
      'validated', jsonb_build_object(
        'null', validated_payload_null,
        'type', validated_payload_type,
        'top_level_keys', validated_payload_top_level_keys
      ),
      'error', jsonb_build_object(
        'null', error_payload_null,
        'type', error_payload_type,
        'top_level_keys', error_payload_top_level_keys
      )
    ),
    'downstream_counts', jsonb_build_object(
      'items', item_count,
      'requirements', requirement_count,
      'user_stories', user_story_count,
      'acceptance_criteria', acceptance_criterion_count,
      'assumptions', assumption_count,
      'risks', risk_count,
      'questions', question_count,
      'quality_findings', quality_finding_count,
      'workflow_changed', workflow_changed_count,
      'source_references', source_reference_count,
      'relations', relation_count,
      'item_versions', item_version_count,
      'review_activities', review_activity_count
    ),
    'project_dependencies', jsonb_build_object(
      'run_count', project_run_count,
      'source_count', project_source_count,
      'item_count', project_item_count,
      'source_reference_count', project_source_reference_count,
      'relation_count', project_relation_count,
      'item_version_count', project_item_version_count,
      'review_activity_count', project_review_activity_count
    ),
    'project_status', project_status,
    'project_relationship_valid', project_relationship_valid,
    'source_relationship_valid', source_relationship_valid,
    'request_key_verification_indicator', request_key_verification_indicator,
    'project_name_verification_indicator', project_name_verification_indicator,
    'source_title_verification_indicator', source_title_verification_indicator,
    'project_name_demo_indicator', project_name_demo_indicator,
    'source_title_demo_indicator', source_title_demo_indicator,
    'provenance_fingerprint', jsonb_build_object(
      'verify_db_exact', verify_db_exact_fingerprint,
      'verify_sources_exact', verify_sources_exact_fingerprint,
      'verify_db_project_name_exact', verify_db_project_name_exact,
      'verify_db_source_title_exact', verify_db_source_title_exact,
      'verify_sources_project_name_exact', verify_sources_project_name_exact,
      'verify_sources_source_title_exact', verify_sources_source_title_exact,
      'validated_items_empty_exact', validated_items_empty_exact
    ),
    'mismatch_codes', mismatch_codes,
    'classification', classification,
    'classification_confidence', classification_confidence,
    'classification_evidence', case
      when verify_db_exact_fingerprint
        then array[
          'exact verify-db.mts project/source identity match',
          'exact mock/schema/lang/null-payload metadata match',
          'exact provider-key, item-status, version, and review-transition fingerprint',
          'no source references or relations'
        ]
      when verify_sources_exact_fingerprint
        then array[
          'exact verify-sources.mts project/source identity match',
          'exact mock/schema/lang and {"items":[]} payload match',
          'exact isolated project run/source/downstream fingerprint',
          'no downstream item, review, reference, or relation rows'
        ]
      else array[
        'repository-consistent empty legacy verification payload shape',
        'does not match either exact known verifier project/source/dependency fingerprint',
        'mixed project; preserve as unknown by default'
      ]
    end,
    'risk_if_modified', case
      when project_run_count > 1
        then 'high: mixed project contains other runs and user-visible or audit records'
      when verify_sources_exact_fingerprint
        then 'medium: proven fixture, but deletion is irreversible and its project has other source documents'
      when item_count > 0 or review_activity_count > 0 or item_version_count > 0
        or relation_count > 0
        then 'high: downstream audit or user-visible records exist'
      else 'not proven safe: preserve until fixture provenance is independently confirmed'
    end,
    'risk_if_preserved', case
      when item_count > 0 then
        'legacy row remains visible and blocks strict whole-inventory verification'
      else 'blocks strict whole-inventory verification'
    end
  ) as result
  from classified
),
safe_summary as (
  select jsonb_build_object(
    'totalRunCount', (select count(*) from base),
    'contractValidCount', (select count(*) from base) - count(*),
    'incompatibleCount', count(*)
  ) as result
  from classified
),
safe_row_results as (
  select jsonb_build_object(
    'id', analysis_run_id,
    'classification', classification,
    'classificationConfidence', classification_confidence,
    'status', status,
    'provider', provider,
    'model', model,
    'promptVersion', prompt_version,
    'schemaVersion', schema_version,
    'outputLang', output_lang,
    'payloadStructure', jsonb_build_object(
      'raw', case when raw_payload_null then 'sql-null' else raw_payload_type end,
      'validated', case
        when validated_payload_null then 'sql-null'
        else validated_payload_type
      end,
      'error', case when error_payload_null then 'sql-null' else error_payload_type end,
      'validatedTopLevelKeys', validated_payload_top_level_keys
    ),
    'mismatchCodes', mismatch_codes,
    'downstreamCounts', jsonb_build_object(
      'items', item_count,
      'userStories', user_story_count,
      'acceptanceCriteria', acceptance_criterion_count,
      'assumptions', assumption_count,
      'risks', risk_count,
      'questions', question_count,
      'qualityFindings', quality_finding_count,
      'sourceReferences', source_reference_count,
      'relations', relation_count,
      'versions', item_version_count,
      'reviews', review_activity_count,
      'workflowChanged', workflow_changed_count
    ),
    'projectDependencies', jsonb_build_object(
      'runs', project_run_count,
      'sources', project_source_count,
      'items', project_item_count,
      'sourceReferences', project_source_reference_count,
      'relations', project_relation_count,
      'versions', project_item_version_count,
      'reviews', project_review_activity_count
    ),
    'provenanceFingerprint', case
      when verify_db_exact_fingerprint then 'verify-db-exact-v1'
      when verify_sources_exact_fingerprint then 'verify-sources-exact-v1'
      else 'preserved-unknown-exact-v1'
    end
  ) as result
  from classified
)
select record_type, result
from (
  select 'summary' as record_type, result from safe_summary
  union all
  select 'row' as record_type, result from safe_row_results
) forensic_results
order by
  case record_type when 'summary' then 0 else 1 end,
  result->>'id';
