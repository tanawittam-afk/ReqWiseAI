/**
 * Human words for the vocabulary in `lib/contracts/item-types.ts`.
 *
 * Presentation only, and singular — an item is "Functional requirement"; a group of
 * them is "Functional requirements", which `workspace-view.ts` owns because grouping
 * is where plurals are needed. Every status and priority appears as a word, never as a
 * colour alone (CLAUDE.md → Accessibility).
 *
 * Lives at workspace scope rather than inside the analysis run's `_components`, where
 * it started: the traceability views already reached across route trees to import it,
 * and Phase 5's workspace-wide Requirements, Reviews and Dashboard views are a third
 * consumer. Promoted rather than copied — a second definition of "Functional
 * requirement" is exactly the drift these tables exist to prevent.
 */

import type { ItemType } from "@/lib/contracts/item-types";

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
};

/** Short forms for the compact row, where a full type name would crowd the title out. */
export const TYPE_SHORT_LABEL: Record<ItemType, string> = {
  problem_statement: "Problem",
  business_objective: "Objective",
  stakeholder: "Stakeholder",
  business_requirement: "Business",
  functional_requirement: "Functional",
  non_functional_requirement: "Non-functional",
  user_story: "User story",
  acceptance_criterion: "Acceptance",
  business_rule: "Rule",
  assumption: "Assumption",
  risk: "Risk",
  constraint: "Constraint",
  open_question: "Question",
  quality_finding: "Finding",
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
};

export const PRIORITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  unassigned: "Unassigned",
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  needs_clarification: "Needs clarification",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
  implemented: "Implemented",
};

export function labelFor(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

/** Confidence reads as a percentage everywhere it appears — one rounding rule, here. */
export function confidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
