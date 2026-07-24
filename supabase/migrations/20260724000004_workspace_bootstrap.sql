-- ReqWiseAI — Phase 3A
-- Personal-workspace bootstrap (DATA-MODEL.md §C.6).
--
-- On first sign-in, one transaction creates the user's profile, a personal
-- organization, and an owner membership. The client is never trusted to do this —
-- it happens on the auth.users insert, in the database, with definer rights.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  display    text;
begin
  display := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (user_id, display_name)
  values (new.id, display);

  insert into public.organizations (name, is_personal)
  values (coalesce(display, 'My workspace') || '''s workspace', true)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

-- AFTER INSERT so the auth.users row already exists when the FKs are checked.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Convenience: the personal organization for a user, used by the app when it needs
-- "where do new projects go". Definer so it can read organization_members regardless
-- of the caller's RLS view.
create or replace function personal_org_id(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.id
  from public.organizations o
  join public.organization_members m on m.organization_id = o.id
  where m.user_id = p_user and o.is_personal
  order by o.created_at
  limit 1;
$$;
