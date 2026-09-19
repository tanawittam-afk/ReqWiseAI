/**
 * The vocabulary shared by every layer: providers, validation, normalization,
 * persistence, and (later) the UI.
 *
 * Domain-blind by construction — nothing here knows what business the analysed
 * text is about. See `docs/architecture/ARCHITECTURE.md` §B.2.
 */

export const ITEM_TYPES = [
  "problem_statement",
  "business_objective",
  "stakeholder",
  "business_requirement",
  "functional_requirement",
  "non_functional_requirement",
  "user_story",
  "acceptance_criterion",
  "business_rule",
  "assumption",
  "risk",
  "constraint",
  "open_question",
  "quality_finding",
  "coverage_gap",
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

/**
 * Display-ID prefixes. Allocated by the application, never by a provider —
 * a provider that could choose stable IDs could renumber a requirement a
 * stakeholder has already cited.
 */
export const DISPLAY_ID_PREFIX: Record<ItemType, string> = {
  problem_statement: "PS",
  business_objective: "OBJ",
  stakeholder: "STK",
  business_requirement: "BR",
  functional_requirement: "FR",
  non_functional_requirement: "NFR",
  user_story: "US",
  acceptance_criterion: "AC",
  business_rule: "RULE",
  assumption: "ASM",
  risk: "RISK",
  constraint: "CON",
  open_question: "Q",
  quality_finding: "QF",
  coverage_gap: "GAP",
};

/** How well the source text supports an item. Drives the evidence rules. */
export const EVIDENCE_CLASSES = ["stated", "inferred", "assumed"] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

/**
 * Where an item came from. A domain profile is context, never evidence. `manual`
 * (Phase 2, Slice 4) is a human, typing directly — never spoofable as `source_analysis`,
 * since the RPC that writes it (`add_manual_requirement`) hardcodes the origin, never
 * taking it as a parameter.
 */
export const ITEM_ORIGINS = ["source_analysis", "domain_profile", "quality_rule", "manual"] as const;
export type ItemOrigin = (typeof ITEM_ORIGINS)[number];

export const PRIORITIES = ["critical", "high", "medium", "low", "unassigned"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** AI-generated items always start here. Nothing else may be written on insert. */
export const INITIAL_STATUS = "draft" as const;

/** Version 1 is the AI's original item, so any edit can be diffed back to it. */
export const INITIAL_VERSION_NO = 1;

export const QUALITY_FINDING_KINDS = [
  "ambiguous",
  "incomplete",
  "conflicting",
  "untestable",
  "duplicate",
] as const;
export type QualityFindingKind = (typeof QUALITY_FINDING_KINDS)[number];

/**
 * Item types a `quality_rule`-origin item may take. A quality rule observes the
 * requirements; it never asserts a business fact. `coverage_gap` (Phase 3) belongs
 * here for the same reason — a gap-check observation, never a business fact — and is
 * deliberately kept out of `QUALITY_FINDING_KINDS`/`QUALITY_FINDING_WEIGHTS`
 * (`lib/analysis/workspace-view.ts`): the quality score's formula is fixed and must
 * never silently grow a 6th deduction.
 */
export const QUALITY_RULE_ITEM_TYPES: readonly ItemType[] = [
  "quality_finding",
  "open_question",
  "coverage_gap",
];

/** Provider-scoped key format: readable, kebab-case, no collision with display IDs. */
export const PROVIDER_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PROVIDER_KEY_MAX_LENGTH = 64;
