-- ReqWiseAI — Phase 3A
-- Row Level Security (DATA-MODEL.md §C.7).
--
-- The whole model reduces to membership. The helpers are SECURITY DEFINER to avoid
-- infinite recursion: organization_members' own policy needs to consult
-- organization_members, which is only possible from a definer function that bypasses
-- RLS on that read.
--
-- Immutability (source_documents, analysis_runs, item_versions, review_activities) is
-- expressed here as the ABSENCE of UPDATE/DELETE policies, backed by the triggers in
-- 20260724000003. analysis_items has no INSERT policy: items are written only by the
-- server during an analysis run using the service role, which bypasses RLS.

-- --- membership helpers ----------------------------------------------------
create or replace function is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org and user_id = auth.uid()
  );
$$;

create or replace function is_org_owner(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function is_project_member(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from projects pr
    join organization_members m on m.organization_id = pr.organization_id
    where pr.id = p_project and m.user_id = auth.uid()
  );
$$;

create or replace function is_project_owner(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from projects pr
    join organization_members m on m.organization_id = pr.organization_id
    where pr.id = p_project and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- --- profiles --------------------------------------------------------------
create policy profiles_select_self on profiles
  for select using (user_id = auth.uid());
create policy profiles_insert_self on profiles
  for insert with check (user_id = auth.uid());
create policy profiles_update_self on profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --- organizations ---------------------------------------------------------
-- No INSERT policy: organizations are created by the bootstrap trigger (definer).
create policy organizations_select_member on organizations
  for select using (is_org_member(id));
create policy organizations_update_owner on organizations
  for update using (is_org_owner(id)) with check (is_org_owner(id));

-- --- organization_members --------------------------------------------------
-- No INSERT/UPDATE/DELETE policy: membership is written by the bootstrap trigger.
-- (Invitations are a later feature; that is when write policies get added.)
create policy organization_members_select on organization_members
  for select using (is_org_member(organization_id));

-- --- projects --------------------------------------------------------------
create policy projects_select on projects
  for select using (is_org_member(organization_id));
create policy projects_insert on projects
  for insert with check (is_org_member(organization_id) and created_by = auth.uid());
create policy projects_update on projects
  for update using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy projects_delete_owner on projects
  for delete using (is_org_owner(organization_id));

-- --- domain_profiles -------------------------------------------------------
-- Read-only reference data. Seeded by migration / service role; no user writes.
create policy domain_profiles_select on domain_profiles
  for select using (auth.uid() is not null);

-- --- source_documents (immutable) ------------------------------------------
create policy source_documents_select on source_documents
  for select using (is_project_member(project_id));
create policy source_documents_insert on source_documents
  for insert with check (is_project_member(project_id) and created_by = auth.uid());

-- --- analysis_runs (immutable) ---------------------------------------------
create policy analysis_runs_select on analysis_runs
  for select using (is_project_member(project_id));
create policy analysis_runs_insert on analysis_runs
  for insert with check (is_project_member(project_id) and created_by = auth.uid());

-- --- analysis_items --------------------------------------------------------
-- No INSERT policy: items are written by the server (service role) during a run.
-- UPDATE covers both edits (auto-versioned) and the soft-delete (deleted_at); there
-- is no DELETE policy, so items can never be hard-deleted by a user.
create policy analysis_items_select on analysis_items
  for select using (is_project_member(project_id));
create policy analysis_items_update on analysis_items
  for update using (is_project_member(project_id)) with check (is_project_member(project_id));

-- --- item_source_references ------------------------------------------------
create policy item_source_references_select on item_source_references
  for select using (is_project_member(project_id));
create policy item_source_references_insert on item_source_references
  for insert with check (is_project_member(project_id));
create policy item_source_references_delete on item_source_references
  for delete using (is_project_member(project_id));

-- --- item_relations --------------------------------------------------------
create policy item_relations_select on item_relations
  for select using (is_project_member(project_id));
create policy item_relations_insert on item_relations
  for insert with check (is_project_member(project_id));
create policy item_relations_update on item_relations
  for update using (is_project_member(project_id)) with check (is_project_member(project_id));
create policy item_relations_delete on item_relations
  for delete using (is_project_member(project_id));

-- --- item_versions (append-only) -------------------------------------------
create policy item_versions_select on item_versions
  for select using (is_project_member(project_id));
create policy item_versions_insert on item_versions
  for insert with check (is_project_member(project_id));

-- --- review_activities (append-only) ---------------------------------------
create policy review_activities_select on review_activities
  for select using (is_project_member(project_id));
create policy review_activities_insert on review_activities
  for insert with check (is_project_member(project_id) and actor_id = auth.uid());
