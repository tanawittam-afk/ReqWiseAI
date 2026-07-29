-- Catalog-level proof for the analysis persistence RPC.
-- STRICTLY READ-ONLY: this file contains one CTE/SELECT statement.

with target as (
  select to_regprocedure(
    'public.persist_analysis_result(uuid,uuid,text,text,text,text,text,output_lang,run_validation_status,jsonb,jsonb,jsonb,jsonb,jsonb)'
  ) as function_oid
)
select
  function_oid is not null as function_exists,
  case when function_oid is null then false
    else has_function_privilege('authenticated', function_oid, 'EXECUTE')
  end as authenticated_execute,
  case when function_oid is null then true
    else has_function_privilege('anon', function_oid, 'EXECUTE')
  end as anon_execute,
  case when function_oid is null then true
    else exists (
      select 1
      from pg_proc p
      cross join lateral aclexplode(
        coalesce(p.proacl, acldefault('f', p.proowner))
      ) acl
      where p.oid = function_oid
        and acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    )
  end as public_execute
from target;
