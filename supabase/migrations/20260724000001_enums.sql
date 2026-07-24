-- ReqWiseAI — Phase 3A
-- Enumerated types. Every one mirrors a `const [...] as const` in lib/contracts,
-- so the database rejects exactly what the TypeScript layer rejects. Keep the two
-- in step: a value added here must be added in lib/contracts/item-types.ts and
-- vice versa.

-- 14 analysis item types (lib/contracts/item-types.ts ITEM_TYPES)
create type item_type as enum (
  'problem_statement',
  'business_objective',
  'stakeholder',
  'business_requirement',
  'functional_requirement',
  'non_functional_requirement',
  'user_story',
  'acceptance_criterion',
  'business_rule',
  'assumption',
  'risk',
  'constraint',
  'open_question',
  'quality_finding'
);

-- How well the source text supports an item (EVIDENCE_CLASSES)
create type evidence_class as enum ('stated', 'inferred', 'assumed');

-- Where an item came from (ITEM_ORIGINS). A domain profile is context, never evidence.
create type item_origin as enum ('source_analysis', 'domain_profile', 'quality_rule');

-- Priority (PRIORITIES). 'unassigned' is the honest default.
create type item_priority as enum ('critical', 'high', 'medium', 'low', 'unassigned');

-- Review workflow status. AI items always begin at 'draft'.
create type item_status as enum (
  'draft',
  'needs_clarification',
  'reviewed',
  'approved',
  'rejected',
  'implemented'
);

-- Outcome of a provider call (mirrors RunAnalysisResult in lib/analysis/run-analysis.ts)
create type run_validation_status as enum ('valid', 'invalid', 'provider_error');

-- Human review actions recorded in the audit trail
create type review_activity_type as enum (
  'comment',
  'status_change',
  'priority_change',
  'edit',
  'approve',
  'reject',
  'request_clarification'
);

-- Membership role. MVP only ever writes 'owner'; 'member' exists so invitations are
-- a later feature, not a migration of every policy.
create type org_role as enum ('owner', 'member');

-- Kind of raw business input a source document holds
create type source_kind as enum ('meeting_notes', 'interview', 'client_message', 'project_brief', 'other');

-- Horizontal traceability link types (item -> item)
create type item_relation_type as enum (
  'derives_from',
  'refines',
  'satisfies',
  'verifies',
  'conflicts_with',
  'duplicates'
);

-- Output language of an analysis
create type output_lang as enum ('th', 'en');
