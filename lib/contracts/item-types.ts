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
};

/** How well the source text supports an item. Drives the evidence rules. */
export const EVIDENCE_CLASSES = ["stated", "inferred", "assumed"] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

/** Where an item came from. A domain profile is context, never evidence. */
export const ITEM_ORIGINS = ["source_analysis", "domain_profile", "quality_rule"] as const;
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

/**
 * Item types a `quality_rule`-origin item may take. A quality rule observes the
 * requirements; it never asserts a business fact.
 */
export const QUALITY_RULE_ITEM_TYPES: readonly ItemType[] = ["quality_finding", "open_question"];

/** Provider-scoped key format: readable, kebab-case, no collision with display IDs. */
export const PROVIDER_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PROVIDER_KEY_MAX_LENGTH = 64;
