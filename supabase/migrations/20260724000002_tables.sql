-- ReqWiseAI — Phase 3A
-- The 12 tables of DATA-MODEL.md §C.1. Every table below `projects` carries a
-- denormalized `project_id` so that each RLS policy is a single indexed predicate
-- rather than a multi-table join; composite foreign keys guarantee the denormalized
-- column cannot drift from its parent.
--
-- RLS is enabled here but no policies are added yet — that is 20260724000006_rls.sql.
-- Between the two migrations the tables are readable only by the service role, which
-- is the safe default.

create extension if not exists pgcrypto; -- gen_random_uuid()

-- 1. profiles — per-user app data mirroring auth.users
create table profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  ui_locale   output_lang not null default 'en',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. organizations — the tenancy boundary
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_personal boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 3. organization_members — who may reach an organization, and as what role
create table organization_members (
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            org_role not null default 'member',
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index on organization_members (user_id);

-- 5. domain_profiles — business context as data (seeded, never hardcoded in engine)
--    Created before `projects` because `projects` references it.
create table domain_profiles (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  description text not null,
  -- terminology / stakeholders / workflows / rules / clarification categories /
  -- risks / suggested NFRs / validation rules / question templates
  content     jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 4. projects — a unit of analysis work
create table projects (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  domain_profile_id uuid not null references domain_profiles (id),
  name             text not null,
  description      text,
  created_by       uuid not null references auth.users (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- referenced by composite FKs from child tables to pin project_id consistency
  unique (id, organization_id)
);
create index on projects (organization_id);

-- 6. source_documents — the raw business input, verbatim. IMMUTABLE (see next migration).
create table source_documents (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  kind        source_kind not null default 'other',
  title       text not null,
  raw_text    text not null,
  input_lang  output_lang not null default 'th',
  created_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  unique (id, project_id)
);
create index on source_documents (project_id);

-- 7. analysis_runs — one execution. IMMUTABLE. Keeps both raw and validated output.
create table analysis_runs (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects (id) on delete cascade,
  source_document_id  uuid not null,
  provider            text not null,
  model               text,
  prompt_version      text,
  schema_version      text not null,
  output_lang         output_lang not null,
  validation_status   run_validation_status not null,
  raw_provider_output jsonb,   -- exactly what the provider returned
  validated_output    jsonb,   -- the parsed structure; null when validation failed
  error               jsonb,   -- structured validation / provider error; null on success
  created_by          uuid not null references auth.users (id),
  created_at          timestamptz not null default now(),
  foreign key (source_document_id, project_id)
    references source_documents (id, project_id) on delete cascade,
  unique (id, project_id)
);
create index on analysis_runs (project_id);
create index on analysis_runs (source_document_id);

-- 8. analysis_items — every structured output, discriminated by item_type. MUTABLE
--    (the review surface). Soft-deleted, never hard-deleted.
create table analysis_items (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects (id) on delete cascade,
  analysis_run_id uuid not null,
  item_type       item_type not null,
  display_id      text not null,          -- BR-001 etc, allocated by the app
  provider_key    text not null,          -- the provider's own key, for audit/mapping
  title           text not null,
  description     text not null,
  priority        item_priority not null default 'unassigned',
  status          item_status not null default 'draft',
  version_no      integer not null default 1,
  evidence_class  evidence_class not null,
  origin          item_origin not null,
  confidence      double precision not null check (confidence >= 0 and confidence <= 1),
  rationale       text,
  attributes      jsonb,                  -- type-specific fields (validated in app by Zod)
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (analysis_run_id, project_id)
    references analysis_runs (id, project_id) on delete cascade,
  unique (id, project_id),                -- for child composite FKs
  unique (project_id, display_id)         -- display ids are unique per project
);
create index on analysis_items (project_id);
create index on analysis_items (analysis_run_id);

-- 9. item_source_references — vertical traceability: item -> exact excerpt in a source
create table item_source_references (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null,
  item_id            uuid not null,
  source_document_id uuid not null,
  excerpt            text not null,         -- stored verbatim; durable even if offsets rot
  start_offset       integer,
  end_offset         integer,
  evidence_strength  double precision check (evidence_strength >= 0 and evidence_strength <= 1),
  offset_verified    boolean not null default false,
  created_at         timestamptz not null default now(),
  foreign key (item_id, project_id)
    references analysis_items (id, project_id) on delete cascade,
  foreign key (source_document_id, project_id)
    references source_documents (id, project_id) on delete cascade,
  check (
    (start_offset is null and end_offset is null)
    or (start_offset is not null and end_offset is not null
        and start_offset >= 0 and end_offset > start_offset)
  ),
  -- an unverified span may not claim exact offsets and verification at once
  check (offset_verified = false or (start_offset is not null and end_offset is not null))
);
create index on item_source_references (item_id);
create index on item_source_references (project_id);

-- 10. item_relations — horizontal traceability: item -> item
create table item_relations (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null,
  from_item_id  uuid not null,
  to_item_id    uuid not null,
  relation_type item_relation_type not null,
  created_at    timestamptz not null default now(),
  foreign key (from_item_id, project_id)
    references analysis_items (id, project_id) on delete cascade,
  foreign key (to_item_id, project_id)
    references analysis_items (id, project_id) on delete cascade,
  check (from_item_id <> to_item_id),
  unique (from_item_id, to_item_id, relation_type)
);
create index on item_relations (project_id);
create index on item_relations (from_item_id);
create index on item_relations (to_item_id);

-- 11. item_versions — snapshot of an item before each significant edit. APPEND-ONLY.
create table item_versions (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null,
  item_id       uuid not null,
  version_no    integer not null,
  snapshot      jsonb not null,          -- the item state BEFORE this edit
  changed_by    uuid references auth.users (id),
  change_reason text,
  created_at    timestamptz not null default now(),
  foreign key (item_id, project_id)
    references analysis_items (id, project_id) on delete cascade,
  unique (item_id, version_no)
);
create index on item_versions (item_id);
create index on item_versions (project_id);

-- 12. review_activities — audit of every human review action. APPEND-ONLY.
create table review_activities (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null,
  item_id       uuid not null,
  actor_id      uuid not null references auth.users (id),
  activity_type review_activity_type not null,
  from_status   item_status,
  to_status     item_status,
  comment       text,
  created_at    timestamptz not null default now(),
  foreign key (item_id, project_id)
    references analysis_items (id, project_id) on delete cascade
);
create index on review_activities (item_id);
create index on review_activities (project_id);

-- Enable RLS everywhere. Policies arrive in 20260724000006_rls.sql; until then only
-- the service role can read or write, which is the safe default.
alter table profiles              enable row level security;
alter table organizations         enable row level security;
alter table organization_members  enable row level security;
alter table projects              enable row level security;
alter table domain_profiles       enable row level security;
alter table source_documents      enable row level security;
alter table analysis_runs         enable row level security;
alter table analysis_items        enable row level security;
alter table item_source_references enable row level security;
alter table item_relations        enable row level security;
alter table item_versions         enable row level security;
alter table review_activities     enable row level security;
