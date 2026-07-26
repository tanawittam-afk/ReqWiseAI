/**
 * The typed relation vocabulary — horizontal traceability, item → item.
 *
 * Slice 6B replaces the untyped `related_item_keys` edge (every one of which was
 * persisted as `derives_from`, a claim nobody made) with a directed, typed edge.
 *
 * Two rules govern everything in this file:
 *
 *  1. **A label means one direction and only one direction.** `implemented_by` always
 *     reads *from* the business requirement *to* the functional requirement. There is
 *     no reversed spelling of the same edge, because a reader who has to check which
 *     way round a particular row was written cannot trust the matrix built from it.
 *  2. **Legacy rows keep their own label.** `derives_from` is not rewritten, re-typed,
 *     or guessed at — it is displayed as what it is. See `LEGACY_RELATION_TYPES`.
 *
 * Domain-blind, like `item-types.ts`: nothing here knows what business the analysed
 * text is about.
 */

import { ITEM_TYPES, type ItemType } from "./item-types.ts";

/**
 * Relation types slice 6B introduces or keeps in active use.
 *
 * The database enum also carries `refines`, `satisfies`, `verifies`, `conflicts_with`
 * and `duplicates` from Phase 3A. No code path has ever written one, and this slice
 * does not start: they are neither produced nor accepted. Dropping an enum label
 * rewrites every dependent row, so they stay in the type and stay unreachable —
 * the same treatment `implemented` gets in the status enum (DATA-MODEL §C.5).
 */
export const RELATION_TYPES = [
  "supports",
  "implemented_by",
  "expressed_as",
  "validated_by",
  "constrained_by",
  "raises_question",
  "flags_quality_issue",
  "mitigates",
  "related_to",
  "derives_from",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

/**
 * Types a *new* analysis run may emit. `derives_from` is legacy-only: it exists so
 * rows written before this slice still load and still say what they say, but a
 * provider that offers one now is refused, because "derives from" was never a
 * statement about the relationship — it was the absence of one.
 */
export const LEGACY_RELATION_TYPES = ["derives_from"] as const satisfies readonly RelationType[];

/**
 * Written out rather than derived by `.filter()` so it stays a tuple of literals —
 * `z.enum()` needs one, and so does every exhaustive switch over it. The test
 * `authored + legacy === RELATION_TYPES` is what keeps the two lists honest.
 */
export const AUTHORED_RELATION_TYPES = [
  "supports",
  "implemented_by",
  "expressed_as",
  "validated_by",
  "constrained_by",
  "raises_question",
  "flags_quality_issue",
  "mitigates",
  "related_to",
] as const satisfies readonly RelationType[];

export type AuthoredRelationType = (typeof AUTHORED_RELATION_TYPES)[number];

export function isLegacyRelationType(type: string): boolean {
  return (LEGACY_RELATION_TYPES as readonly string[]).includes(type);
}

export function isAuthoredRelationType(value: string): value is AuthoredRelationType {
  return (AUTHORED_RELATION_TYPES as readonly string[]).includes(value);
}

export function isRelationType(value: string): value is RelationType {
  return (RELATION_TYPES as readonly string[]).includes(value);
}

/**
 * Hierarchical types form the traceability spine:
 *
 *   business_objective → business_requirement → functional_requirement
 *                      → user_story → acceptance_criterion
 *
 * These are the only types a cycle is checked over. `related_to` is deliberately
 * absent: it carries no parent/child claim, so "A related_to B, B related_to A" is
 * two ordinary rows, not a loop. `raises_question`, `flags_quality_issue`,
 * `constrained_by` and `mitigates` are observations *about* the spine rather than
 * links *along* it.
 */
export const HIERARCHICAL_RELATION_TYPES: readonly RelationType[] = [
  "supports",
  "implemented_by",
  "expressed_as",
  "validated_by",
  "derives_from",
];

export function isHierarchicalRelationType(type: string): boolean {
  return (HIERARCHICAL_RELATION_TYPES as readonly string[]).includes(type);
}

/**
 * Which way a hierarchical edge points along the spine.
 *
 * The four types this slice authors are written parent → child. `derives_from` was
 * written child → parent by every run before this slice, and rewriting 189 committed
 * rows to match a convention invented afterwards would be exactly the "changing legacy
 * relations by guessing" the slice forbids. So the direction is recorded instead.
 *
 * This matters in two places: building matrix rows, and reading a cycle. A graph that
 * mixes both conventions could show a two-node loop that is really one edge described
 * twice — which is why `canonicalHierarchyEdge()` exists and why a single run never
 * mixes them (a run authored after this slice emits no `derives_from` at all).
 */
export const HIERARCHY_DIRECTION: Record<string, "parent_to_child" | "child_to_parent"> = {
  supports: "parent_to_child",
  implemented_by: "parent_to_child",
  expressed_as: "parent_to_child",
  validated_by: "parent_to_child",
  derives_from: "child_to_parent",
};

/** A hierarchical edge as `[parent, child]`, whichever way the row was written. */
export function canonicalHierarchyEdge(
  type: string,
  fromId: string,
  toId: string,
): [parent: string, child: string] | null {
  const direction = HIERARCHY_DIRECTION[type];
  if (direction === undefined) return null;
  return direction === "parent_to_child" ? [fromId, toId] : [toId, fromId];
}

/**
 * Human-readable edge labels, read in the direction the row is stored:
 * `"{from} {label} {to}"`.
 */
export const RELATION_LABEL_EN: Record<RelationType, string> = {
  supports: "is supported by",
  implemented_by: "is implemented by",
  expressed_as: "is expressed as",
  validated_by: "is validated by",
  constrained_by: "is constrained by",
  raises_question: "raises a question about",
  flags_quality_issue: "flags a quality issue in",
  mitigates: "mitigates",
  related_to: "is related to",
  derives_from: "derives from",
};

export const RELATION_LABEL_TH: Record<RelationType, string> = {
  supports: "ได้รับการสนับสนุนโดย",
  implemented_by: "ถูกนำไปทำเป็น",
  expressed_as: "ถูกเขียนเป็น",
  validated_by: "ถูกตรวจรับด้วย",
  constrained_by: "ถูกจำกัดโดย",
  raises_question: "ตั้งคำถามต่อ",
  flags_quality_issue: "ชี้ปัญหาคุณภาพใน",
  mitigates: "ลดความเสี่ยงให้",
  related_to: "เกี่ยวข้องกับ",
  derives_from: "สืบทอดมาจาก",
};

/** The same edge read backwards, for the "incoming relations" list in the inspector. */
export const RELATION_INVERSE_LABEL_EN: Record<RelationType, string> = {
  supports: "supports",
  implemented_by: "implements",
  expressed_as: "expresses",
  validated_by: "validates",
  constrained_by: "constrains",
  raises_question: "has a question raised by",
  flags_quality_issue: "has a quality issue flagged by",
  mitigates: "is mitigated by",
  related_to: "is related to",
  derives_from: "is derived from by",
};

export const RELATION_INVERSE_LABEL_TH: Record<RelationType, string> = {
  supports: "สนับสนุน",
  implemented_by: "นำไปทำเป็นของ",
  expressed_as: "เป็นการเขียนของ",
  validated_by: "ตรวจรับ",
  constrained_by: "จำกัด",
  raises_question: "ถูกตั้งคำถามโดย",
  flags_quality_issue: "ถูกชี้ปัญหาคุณภาพโดย",
  mitigates: "ถูกลดความเสี่ยงโดย",
  related_to: "เกี่ยวข้องกับ",
  derives_from: "เป็นต้นทางของ",
};

/** Requirement-shaped types — the things a constraint constrains and a risk threatens. */
const REQUIREMENT_TYPES: readonly ItemType[] = [
  "business_requirement",
  "functional_requirement",
  "non_functional_requirement",
  "user_story",
];

/**
 * The allowed `(relation_type, from_type, to_type)` matrix.
 *
 * Mirrored exactly by `is_allowed_relation_pair()` in migration 19 — the database is
 * the enforcement point, this is the same rule stated where the tests and the UI can
 * read it. When one changes, the other must.
 */
export const ALLOWED_RELATION_PAIRS: Record<
  RelationType,
  { from: readonly ItemType[]; to: readonly ItemType[] } | "any"
> = {
  // A business objective is supported by the business requirements beneath it.
  supports: {
    from: ["business_objective"],
    to: ["business_requirement"],
  },
  // A business requirement is implemented by functional and non-functional requirements.
  implemented_by: {
    from: ["business_requirement"],
    to: ["functional_requirement", "non_functional_requirement"],
  },
  // A functional requirement is expressed as a user story.
  expressed_as: {
    from: ["functional_requirement"],
    to: ["user_story"],
  },
  // A story or a requirement is validated by an acceptance criterion.
  validated_by: {
    from: ["user_story", "business_requirement", "functional_requirement", "non_functional_requirement"],
    to: ["acceptance_criterion"],
  },
  // A requirement is constrained by a constraint or a business rule.
  constrained_by: {
    from: REQUIREMENT_TYPES,
    to: ["constraint", "business_rule"],
  },
  // A question is raised *by the question*, about anything that is not itself a question.
  raises_question: {
    from: ["open_question"],
    to: ITEM_TYPES.filter((t) => t !== "open_question"),
  },
  // A finding is raised *by the finding*, about anything that is not itself a finding.
  flags_quality_issue: {
    from: ["quality_finding"],
    to: ITEM_TYPES.filter((t) => t !== "quality_finding"),
  },
  // A risk is mitigated *by* a requirement, rule or constraint: the mitigation is the
  // `from` side, so the arrow points at the thing being made safer.
  mitigates: {
    from: [...REQUIREMENT_TYPES, "business_rule", "constraint"],
    to: ["risk"],
  },
  // The fallback, for a genuine link with no specific type. Deliberately the broadest
  // pair rule in the table — any type to any type — because narrowing it would push a
  // real link into a specific type that misdescribes it, which is the failure mode this
  // slice exists to fix. What still holds: no self-relation (the database refuses one),
  // and no duplicate. Use it only where nothing more specific applies.
  related_to: "any",
  // Legacy. Every row written before slice 6B is one of these, between item types we
  // cannot re-derive, so the pair rule cannot be applied retroactively. New runs may
  // not emit it at all — `AUTHORED_RELATION_TYPES` is what the validator accepts.
  derives_from: "any",
};

/**
 * Note there is no same-type special case. A spine edge between two items of one type
 * (BR `implemented_by` BR) is already refused by the matrix itself, because no spine
 * rule lists the same type on both sides — decomposition within a level is not
 * traceability across levels.
 */
export function isAllowedRelationPair(
  type: RelationType,
  fromType: ItemType,
  toType: ItemType,
): boolean {
  const rule = ALLOWED_RELATION_PAIRS[type];
  if (rule === "any") return true;
  return rule.from.includes(fromType) && rule.to.includes(toType);
}

/** The spine, top to bottom. Drives matrix columns and map columns alike. */
export const TRACEABILITY_SPINE: readonly ItemType[] = [
  "business_objective",
  "business_requirement",
  "functional_requirement",
  "user_story",
  "acceptance_criterion",
];

/** The relation that carries the spine from one column to the next. */
export const SPINE_STEP: ReadonlyArray<{
  from: ItemType;
  to: ItemType;
  type: RelationType;
}> = [
  { from: "business_objective", to: "business_requirement", type: "supports" },
  { from: "business_requirement", to: "functional_requirement", type: "implemented_by" },
  { from: "functional_requirement", to: "user_story", type: "expressed_as" },
  { from: "user_story", to: "acceptance_criterion", type: "validated_by" },
];
