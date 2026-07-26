/**
 * The export contract — the one shape that leaves this system.
 *
 * Two rules shape every decision in this file.
 *
 *  1. **A database row is not a public contract.** Every field here was chosen; nothing
 *     arrived by spreading a row. `organization_id`, `created_by`, `actor_id`,
 *     `resolved_by`, `provider_key`, `raw_provider_output`, `validated_output` and
 *     `idempotency_key` are absent on purpose — a reader of an exported document has no
 *     use for them, and two of them are auth identities. `strictObject` turns "somebody
 *     added a field upstream" into a parse error instead of a silent leak.
 *  2. **A version number, from the first release.** `reqwise-export/1.0` is written into
 *     every package, because a JSON file outlives the app that produced it and the
 *     reader that eventually parses it deserves to know what it is holding.
 *
 * Identity: items are referenced by **display id** (`FR-005`), never by their UUID. A
 * display id is the identifier a stakeholder can already cite in an email, and it is
 * stable per project (DATA-MODEL §C.10). The three UUIDs that do appear are the ones
 * that mean something outside the database — the project, the source revision, and the
 * analysis run in audit metadata (§5 of the slice brief).
 */

import { z } from "zod";
import { ITEM_TYPES, type ItemType } from "./item-types.ts";
import { RELATION_TYPES } from "./relations.ts";
import { ITEM_STATUSES } from "./review.ts";
import { SOURCE_KINDS } from "./source.ts";
import { WORKFLOW_STATES } from "./workflow.ts";

/**
 * Bumped when the shape changes in a way a consumer must notice. A new optional field
 * is a minor bump; a removed or re-meant field is a major one.
 */
export const EXPORT_SCHEMA_VERSION = "reqwise-export/1.0";

// --- scope -----------------------------------------------------------------

/**
 * Which review states an export includes.
 *
 * These are named after what a reader wants, not after the enum: "the signed-off
 * document", "what the team has looked at", "everything still alive", "the whole record".
 */
export const EXPORT_STATUS_SCOPES = [
  "approved_only",
  "reviewed_and_approved",
  "active_working_set",
  "all_statuses",
] as const;

export type ExportStatusScope = (typeof EXPORT_STATUS_SCOPES)[number];

/**
 * The statuses each scope admits. Written out rather than derived from an ordering,
 * because `active_working_set` is not a prefix of anything — it is "everything except
 * rejected", which no ordering expresses.
 */
export const STATUSES_IN_SCOPE: Record<ExportStatusScope, readonly string[]> = {
  approved_only: ["approved"],
  reviewed_and_approved: ["reviewed", "approved"],
  active_working_set: ["draft", "needs_clarification", "reviewed", "approved"],
  all_statuses: [...ITEM_STATUSES],
};

export const EXPORT_STATUS_SCOPE_LABEL: Record<ExportStatusScope, string> = {
  approved_only: "Approved only",
  reviewed_and_approved: "Reviewed and approved",
  active_working_set: "Active working set",
  all_statuses: "All statuses",
};

export const EXPORT_STATUS_SCOPE_MEANING: Record<ExportStatusScope, string> = {
  approved_only: "Only requirements a reviewer has approved.",
  reviewed_and_approved: "Reviewed and approved requirements. Drafts are left out.",
  active_working_set: "Everything still in play — drafts included, rejected left out.",
  all_statuses: "The whole record, rejected requirements included, each labelled.",
};

/**
 * Optional sections, in the order they appear in the document (§7 of the brief).
 *
 * The first twelve mirror the twelve requirement-shaped item types one-for-one, so a
 * reader can drop "risks" from a stakeholder pack without a special case existing
 * anywhere. `open_questions` and `quality_findings` are the two observation types, and
 * the last six are cross-cutting sections rather than item types.
 */
export const EXPORT_SECTIONS = [
  "problem_statement",
  "business_objectives",
  "stakeholders",
  "business_requirements",
  "functional_requirements",
  "non_functional_requirements",
  "user_stories",
  "acceptance_criteria",
  "business_rules",
  "assumptions",
  "risks",
  "constraints",
  "open_questions",
  "quality_findings",
  "source_evidence",
  "traceability",
  "coverage",
  "version_summary",
  "review_activity",
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];

/**
 * Which item type each item-bearing section carries.
 *
 * The five sections that are not in this map (`source_evidence`, `traceability`,
 * `coverage`, `version_summary`, `review_activity`) are cross-cutting: they decorate or
 * summarise items rather than listing a type of their own.
 */
export const SECTION_ITEM_TYPE: Partial<Record<ExportSection, ItemType>> = {
  problem_statement: "problem_statement",
  business_objectives: "business_objective",
  stakeholders: "stakeholder",
  business_requirements: "business_requirement",
  functional_requirements: "functional_requirement",
  non_functional_requirements: "non_functional_requirement",
  user_stories: "user_story",
  acceptance_criteria: "acceptance_criterion",
  business_rules: "business_rule",
  assumptions: "assumption",
  risks: "risk",
  constraints: "constraint",
  open_questions: "open_question",
  quality_findings: "quality_finding",
};

export const EXPORT_SECTION_LABEL: Record<ExportSection, string> = {
  problem_statement: "Problem statements",
  business_objectives: "Business objectives",
  stakeholders: "Stakeholders",
  business_requirements: "Business requirements",
  functional_requirements: "Functional requirements",
  non_functional_requirements: "Non-functional requirements",
  user_stories: "User stories",
  acceptance_criteria: "Acceptance criteria",
  business_rules: "Business rules",
  assumptions: "Assumptions",
  risks: "Risks",
  constraints: "Constraints",
  open_questions: "Stakeholder questions",
  quality_findings: "Quality findings",
  source_evidence: "Source evidence",
  traceability: "Traceability",
  coverage: "Coverage summary",
  version_summary: "Version summary",
  review_activity: "Review activity summary",
};

/**
 * The default document: every requirement type, both observation types, the evidence
 * that justifies them, and the traceability and coverage that show what is missing.
 * Full version history and the full review timeline are **off** — they are an audit
 * trail, not a requirements document, and including them by default would bury the
 * requirements under their own changelog.
 */
export const DEFAULT_SECTIONS: Record<ExportSection, boolean> = {
  problem_statement: true,
  business_objectives: true,
  stakeholders: true,
  business_requirements: true,
  functional_requirements: true,
  non_functional_requirements: true,
  user_stories: true,
  acceptance_criteria: true,
  business_rules: true,
  assumptions: true,
  risks: true,
  constraints: true,
  open_questions: true,
  quality_findings: true,
  source_evidence: true,
  traceability: true,
  coverage: true,
  version_summary: false,
  review_activity: false,
};

const sectionsSchema = z.strictObject(
  Object.fromEntries(EXPORT_SECTIONS.map((key) => [key, z.boolean()])) as {
    [K in ExportSection]: z.ZodBoolean;
  },
);

export const exportScopeSchema = z.strictObject({
  status: z.enum(EXPORT_STATUS_SCOPES),
  sections: sectionsSchema,
  /**
   * Confidence is a model's self-report, not a measurement. Some audiences read it as
   * precision, so whether it appears is a choice rather than a constant.
   */
  includeConfidence: z.boolean(),
});

export type ExportScope = z.infer<typeof exportScopeSchema>;

export const DEFAULT_SCOPE: ExportScope = {
  status: "reviewed_and_approved",
  sections: DEFAULT_SECTIONS,
  includeConfidence: true,
};

// --- presets ---------------------------------------------------------------

/**
 * Presets are a UI convenience and nothing else.
 *
 * Each one resolves to an explicit `ExportScope` **before** the builder is called, so
 * no rule anywhere reads a preset name. That is deliberate: a preset that could change
 * behaviour would be a hidden business rule, and the next person to add one would be
 * changing the document's meaning while believing they were adding a shortcut.
 */
export const EXPORT_PRESETS = [
  "portfolio_demo",
  "developer_handoff",
  "stakeholder_review",
  "audit_package",
  "full_project_archive",
] as const;

export type ExportPreset = (typeof EXPORT_PRESETS)[number];

export const EXPORT_PRESET_LABEL: Record<ExportPreset, string> = {
  portfolio_demo: "Portfolio demo",
  developer_handoff: "Developer handoff",
  stakeholder_review: "Stakeholder review",
  audit_package: "Audit package",
  full_project_archive: "Full project archive",
};

export const EXPORT_PRESET_MEANING: Record<ExportPreset, string> = {
  portfolio_demo:
    "The reviewed and approved document with its evidence, questions, findings and traceability — history left out.",
  developer_handoff:
    "What a developer needs to build: approved requirements, stories, criteria, rules, constraints and traceability.",
  stakeholder_review:
    "Business-facing reading: objectives, requirements and the questions still waiting on an answer.",
  audit_package: "Everything, including version history and the review timeline.",
  full_project_archive: "Every item in every status, with all evidence and all history.",
};

function sections(overrides: Partial<Record<ExportSection, boolean>>): Record<ExportSection, boolean> {
  return { ...DEFAULT_SECTIONS, ...overrides };
}

const PRESET_SCOPES: Record<ExportPreset, ExportScope> = {
  portfolio_demo: {
    status: "reviewed_and_approved",
    sections: sections({}),
    includeConfidence: true,
  },
  developer_handoff: {
    status: "approved_only",
    sections: sections({
      stakeholders: false,
      assumptions: false,
      risks: false,
      coverage: false,
    }),
    includeConfidence: false,
  },
  stakeholder_review: {
    status: "reviewed_and_approved",
    sections: sections({
      non_functional_requirements: false,
      user_stories: false,
      acceptance_criteria: false,
      business_rules: false,
      quality_findings: false,
      traceability: false,
    }),
    includeConfidence: false,
  },
  audit_package: {
    status: "all_statuses",
    sections: sections({ version_summary: true, review_activity: true }),
    includeConfidence: true,
  },
  full_project_archive: {
    status: "all_statuses",
    sections: sections({ version_summary: true, review_activity: true }),
    includeConfidence: true,
  },
};

/** A preset resolved into the only thing the builder understands. */
export function scopeForPreset(preset: ExportPreset): ExportScope {
  const scope = PRESET_SCOPES[preset];
  return { ...scope, sections: { ...scope.sections } };
}

export function isExportPreset(value: string): value is ExportPreset {
  return (EXPORT_PRESETS as readonly string[]).includes(value);
}

export function isExportStatusScope(value: string): value is ExportStatusScope {
  return (EXPORT_STATUS_SCOPES as readonly string[]).includes(value);
}

export function isStatusInScope(scope: ExportStatusScope, status: string): boolean {
  return STATUSES_IN_SCOPE[scope].includes(status);
}

// --- the package -----------------------------------------------------------

const isoDate = z.string().min(1);

export const exportSourceSchema = z.strictObject({
  /** The source *revision* id. Stable, and the thing a citation actually points at. */
  revisionId: z.string().uuid(),
  title: z.string(),
  kind: z.enum(SOURCE_KINDS),
  revisionNumber: z.number().int().positive(),
  /** Frozen because an analysis cites it. Derived, never stored (DATA-MODEL §C.3). */
  locked: z.boolean(),
  sourceDate: z.string().nullable(),
  characterCount: z.number().int().nonnegative(),
  createdAt: isoDate,
});

export type ExportSource = z.infer<typeof exportSourceSchema>;

export const exportEvidenceSchema = z.strictObject({
  sourceRevisionId: z.string().uuid(),
  sourceTitle: z.string(),
  sourceKind: z.enum(SOURCE_KINDS),
  revisionNumber: z.number().int().positive(),
  /** Verbatim, exactly as stored. Never re-derived from offsets at export time. */
  excerpt: z.string(),
  startOffset: z.number().int().nonnegative().nullable(),
  endOffset: z.number().int().positive().nullable(),
  /** The database's own verdict on whether the offsets were checked when written. */
  offsetVerified: z.boolean(),
});

export type ExportEvidence = z.infer<typeof exportEvidenceSchema>;

export const exportRelationRefSchema = z.strictObject({
  /** How the edge reads from this item's side: "is implemented by", "supports". */
  phrase: z.string(),
  displayId: z.string(),
  type: z.enum(RELATION_TYPES),
  direction: z.enum(["out", "in"]),
  legacy: z.boolean(),
});

export type ExportRelationRef = z.infer<typeof exportRelationRefSchema>;

/**
 * What happened to an item, without saying who did it.
 *
 * The count and the last transition are always present — a reader needs to know whether
 * an approval exists at all. The actor never is: `actor_id` is an auth user id, and
 * "approved on 26 July" is the fact a handoff document needs, not "approved by
 * 4f3c…". The actor is dropped in the loader, before this shape is built.
 */
const reviewSummarySchema = z.strictObject({
  activityCount: z.number().int().nonnegative(),
  lastActivity: z
    .strictObject({ label: z.string(), at: isoDate })
    .nullable(),
});

export const exportRequirementSchema = z.strictObject({
  displayId: z.string(),
  type: z.enum(ITEM_TYPES),
  typeLabel: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.string(),
  status: z.enum(ITEM_STATUSES),
  statusLabel: z.string(),
  /** The version the export shows. Version 1 is the analysis's own wording. */
  versionNo: z.number().int().positive(),
  /**
   * True when a person has edited this item since the analysis wrote it — inferred
   * from `versionNo > 1`, which is the only evidence the data actually holds.
   */
  humanEdited: z.boolean(),
  evidenceClass: z.string(),
  origin: z.string(),
  /** Null when the scope leaves confidence out — never 0, which would mean "none". */
  confidence: z.number().min(0).max(1).nullable(),
  rationale: z.string().nullable(),
  /** Empty when the scope excludes evidence, or when the item legitimately has none. */
  sourceEvidence: z.array(exportEvidenceSchema),
  /** The sentence shown where a domain-profile item has no citation to show. */
  evidenceNotice: z.string().nullable(),
  relations: z.array(exportRelationRefSchema),
  review: reviewSummarySchema,
  /** Audit metadata: which run produced the item. */
  analysisRunId: z.string().uuid(),
});

export type ExportRequirement = z.infer<typeof exportRequirementSchema>;

const workflowFields = {
  displayId: z.string(),
  title: z.string(),
  description: z.string(),
  workflowState: z.enum(WORKFLOW_STATES),
  workflowStateLabel: z.string(),
  origin: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
  /** The answer, the deferral reason, the dismissal reason — whichever applies. */
  resolutionText: z.string().nullable(),
  resolvedAt: isoDate.nullable(),
  followUpOn: z.string().nullable(),
  sourceEvidence: z.array(exportEvidenceSchema),
  evidenceNotice: z.string().nullable(),
  relations: z.array(exportRelationRefSchema),
  review: reviewSummarySchema,
  analysisRunId: z.string().uuid(),
} as const;

export const exportOpenQuestionSchema = z.strictObject({
  ...workflowFields,
  /** True while the question is open or deferred — the "still outstanding" split. */
  outstanding: z.boolean(),
});

export type ExportOpenQuestion = z.infer<typeof exportOpenQuestionSchema>;

export const exportQualityFindingSchema = z.strictObject({
  ...workflowFields,
  /**
   * The provider's own finding kind — ambiguous, incomplete, conflicting, untestable,
   * duplicate. There is deliberately **no severity**: the provider contract has none,
   * and inventing one would be the export asserting something nobody measured.
   */
  findingKind: z.string().nullable(),
  unresolved: z.boolean(),
});

export type ExportQualityFinding = z.infer<typeof exportQualityFindingSchema>;

export const exportRelationSchema = z.strictObject({
  fromDisplayId: z.string(),
  fromType: z.enum(ITEM_TYPES),
  fromStatus: z.string(),
  type: z.enum(RELATION_TYPES),
  phrase: z.string(),
  toDisplayId: z.string(),
  toType: z.enum(ITEM_TYPES),
  toStatus: z.string(),
  legacy: z.boolean(),
});

export type ExportRelation = z.infer<typeof exportRelationSchema>;

export const exportCoverageSchema = z.strictObject({
  totals: z.strictObject({
    items: z.number().int().nonnegative(),
    linked: z.number().int().nonnegative(),
    orphans: z.number().int().nonnegative(),
    missingAcceptanceCriteria: z.number().int().nonnegative(),
    openQuestions: z.number().int().nonnegative(),
    unresolvedQualityFindings: z.number().int().nonnegative(),
    itemsWithSourceEvidence: z.number().int().nonnegative(),
    approvedRequirements: z.number().int().nonnegative(),
  }),
  /** One entry per coverage rule, each naming the display ids it flagged. */
  gaps: z.array(
    z.strictObject({
      key: z.string(),
      label: z.string(),
      meaning: z.string(),
      displayIds: z.array(z.string()),
    }),
  ),
  disclaimer: z.string(),
});

export type ExportCoverage = z.infer<typeof exportCoverageSchema>;

export const exportProjectSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string(),
  /** The ascii stem every downloaded file is named after. */
  slug: z.string(),
  description: z.string().nullable(),
  businessObjective: z.string().nullable(),
  knownStakeholders: z.array(z.string()),
  domain: z.strictObject({ key: z.string(), name: z.string() }).nullable(),
  outputLang: z.string(),
  status: z.enum(["active", "archived"]),
  archived: z.boolean(),
  archiveReason: z.string().nullable(),
  createdAt: isoDate,
  counts: z.strictObject({
    sources: z.number().int().nonnegative(),
    analysisRuns: z.number().int().nonnegative(),
    /** Requirement-shaped items **in scope**, not the project's lifetime total. */
    requirements: z.number().int().nonnegative(),
    approvedRequirements: z.number().int().nonnegative(),
    openQuestions: z.number().int().nonnegative(),
    unresolvedQualityFindings: z.number().int().nonnegative(),
  }),
});

export type ExportProject = z.infer<typeof exportProjectSchema>;

const versionSummarySchema = z.strictObject({
  displayId: z.string(),
  versionNo: z.number().int().positive(),
  /** How many snapshots exist behind the current wording. */
  versionCount: z.number().int().nonnegative(),
  lastChangedAt: isoDate.nullable(),
  lastChangeReason: z.string().nullable(),
});

const reviewActivitySummarySchema = z.strictObject({
  displayId: z.string(),
  label: z.string(),
  at: isoDate,
  /** The reviewer's own words, when they left any. Never who they are. */
  comment: z.string().nullable(),
});

export const exportPackageSchema = z.strictObject({
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  generatedAt: isoDate,
  project: exportProjectSchema,
  scope: exportScopeSchema,
  sources: z.array(exportSourceSchema),
  requirements: z.array(exportRequirementSchema),
  openQuestions: z.array(exportOpenQuestionSchema),
  qualityFindings: z.array(exportQualityFindingSchema),
  relations: z.array(exportRelationSchema),
  coverage: exportCoverageSchema,
  /** Present only when the scope asks for them; `[]`, never absent. */
  versionSummary: z.array(versionSummarySchema),
  reviewActivitySummary: z.array(reviewActivitySummarySchema),
  /** Sentences the document must show, such as the archived-project notice. */
  notices: z.array(z.string()),
});

export type ExportPackage = z.infer<typeof exportPackageSchema>;

/** The archived-project sentence, fixed wording so tests can assert on it. */
export const ARCHIVED_NOTICE =
  "This export was generated from an archived read-only project.";

/** What a domain-profile item says instead of a citation it does not have. */
export const NO_DIRECT_EVIDENCE_NOTICE =
  "Generated from domain guidance; no direct source evidence.";
