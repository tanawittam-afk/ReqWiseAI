/**
 * The words the **document** uses.
 *
 * Why this is not `app/workspace/.../_components/labels.ts`: that file is screen chrome,
 * free to shorten a type to "Functional" because a table column is narrow. These strings
 * are *content* — they are written into a Markdown file somebody will read in a year, in
 * a repository, with no application around it. A document's vocabulary is part of the
 * export contract, so it lives in `lib/` where it can be asserted without a browser, the
 * same reason `lib/traceability/labels.ts` exists.
 *
 * `tests/export/labels.test.ts` asserts that the two files agree wherever they overlap,
 * so the deliberate copy cannot become a silent drift.
 */

import type { ItemType } from "../contracts/item-types.ts";

export const TYPE_LABEL: Record<ItemType, string> = {
  problem_statement: "Problem statement",
  business_objective: "Business objective",
  stakeholder: "Stakeholder",
  business_requirement: "Business requirement",
  functional_requirement: "Functional requirement",
  non_functional_requirement: "Non-functional requirement",
  user_story: "User story",
  acceptance_criterion: "Acceptance criterion",
  business_rule: "Business rule",
  assumption: "Assumption",
  risk: "Risk",
  constraint: "Constraint",
  open_question: "Open question",
  quality_finding: "Quality finding",
  coverage_gap: "Coverage gap",
};

/**
 * Status words. `implemented` is here because the enum label still exists in the
 * database even though it is unreachable (DATA-MODEL §C.5) — a document that met one
 * should print the word, not the raw enum.
 */
export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  needs_clarification: "Needs clarification",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
  implemented: "Implemented",
};

export const PRIORITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  unassigned: "Unassigned",
};

export const EVIDENCE_LABEL: Record<string, string> = {
  stated: "Stated",
  inferred: "Inferred",
  assumed: "Assumed",
};

export const ORIGIN_LABEL: Record<string, string> = {
  source_analysis: "Source analysis",
  domain_profile: "Domain profile",
  quality_rule: "Quality rule",
  manual: "Added manually",
};

/**
 * Source kinds are **not** copied: `lib/contracts/source.ts` already owns them, and the
 * words a document uses for a document's type are the same words the form offered when
 * somebody chose it. Re-exported under the singular name the rest of this file uses.
 */
export { SOURCE_KIND_LABELS as SOURCE_KIND_LABEL } from "../contracts/source.ts";

/**
 * The five finding kinds the provider contract actually defines. Absent on purpose:
 * anything resembling a severity — the contract has none, and a document that printed
 * "High severity" would be asserting a measurement nobody took.
 */
export const FINDING_KIND_LABEL: Record<string, string> = {
  ambiguous: "Ambiguous",
  incomplete: "Incomplete",
  conflicting: "Conflicting",
  untestable: "Untestable",
  duplicate: "Duplicate",
};

export function labelFor(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

/** One rounding rule for confidence, everywhere it is printed. */
export function confidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
