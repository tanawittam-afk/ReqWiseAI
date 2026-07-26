/**
 * Traceability coverage — derived, never stored.
 *
 * **These are indicators, not a verdict.** Every function here answers a mechanical
 * question about the shape of the graph ("does this business requirement have a
 * functional requirement beneath it?"), and none of them answers the question a
 * reviewer actually has ("is this analysis any good?"). A requirement with no
 * acceptance criterion may be perfectly fine; an objective with six may be six bad
 * ones. The UI must say so, and `COVERAGE_DISCLAIMER` is the sentence it says it with.
 *
 * Nothing is persisted. A stored coverage number would be a second copy of a fact the
 * relations already hold, free to drift the moment somebody edits an item — the same
 * argument that keeps `source_document_is_locked()` derived (DATA-MODEL §C.3).
 *
 * Pure: no database, no React, no clock.
 */

import type { ItemType } from "../contracts/item-types";
import { childrenOfType, findExistingCycles, linkedItemIds, spineChildren } from "./graph";
import {
  APPROVED_STATUS,
  REJECTED_STATUS,
  REVIEWED_STATUS,
  UNRESOLVED_FINDING_STATES,
  UNRESOLVED_QUESTION_STATES,
  type TraceGraph,
  type TraceItem,
} from "./types";

export const COVERAGE_DISCLAIMER =
  "Coverage indicators assist review and do not replace human judgment.";

/** One coverage rule's result: which items it flagged, and how to say what it found. */
export type CoverageFinding = {
  /** Stable id — also the filter key the summary row links to. */
  key: CoverageKey;
  label: string;
  /** What being on this list means, in one sentence. Shown next to the count. */
  meaning: string;
  itemIds: string[];
};

export const COVERAGE_KEYS = [
  "objective_without_requirement",
  "requirement_without_functional",
  "functional_without_story",
  "story_without_criterion",
  "requirement_without_evidence",
  "orphan",
  "approved_linked_to_rejected",
  // The plain outstanding-observation lists. Separate from the two status-conflict
  // rules below, and not a duplicate of them: the summary row shows a count and then
  // filters to it, so the set the number describes and the set the filter selects have
  // to be the same set. Filtering "15 open questions" down to the 0 that happen to sit
  // on an approved item is a number and a view disagreeing in public.
  "unresolved_question",
  "unresolved_finding",
  "open_question_on_approved",
  "unresolved_finding_on_reviewed",
  "existing_cycle",
] as const;

export type CoverageKey = (typeof COVERAGE_KEYS)[number];

export type CoverageReport = {
  totals: {
    items: number;
    linked: number;
    orphans: number;
    missingAcceptanceCriteria: number;
    openQuestions: number;
    unresolvedQualityFindings: number;
  };
  findings: Record<CoverageKey, CoverageFinding>;
};

/**
 * Items that may sit alone without it meaning anything is missing.
 *
 * A problem statement and a stakeholder are context, not links in the chain; an
 * assumption's job is to be visible, not to be implemented. Counting them as orphans
 * would produce a number that goes up when the analysis does its job properly, which
 * is the definition of a misleading metric.
 */
const ORPHAN_EXEMPT: readonly ItemType[] = ["problem_statement", "stakeholder"];

function ids(items: readonly TraceItem[]): string[] {
  return items.map((item) => item.id);
}

function itemsOfType(graph: TraceGraph, type: ItemType): TraceItem[] {
  return graph.items.filter((item) => item.type === type);
}

/**
 * Every spine level that has nothing beneath it.
 *
 * `childrenOfType` follows the canonical parent → child direction, so a legacy
 * `derives_from` chain counts as coverage exactly as a typed `implemented_by` chain
 * does. A legacy run is not reported as uncovered merely for being legacy.
 */
function missingBeneath(
  graph: TraceGraph,
  children: Map<string, string[]>,
  parentType: ItemType,
  childTypes: readonly ItemType[],
): TraceItem[] {
  return itemsOfType(graph, parentType).filter((parent) =>
    childTypes.every((type) => childrenOfType(graph, children, parent.id, type).length === 0),
  );
}

export function computeCoverage(graph: TraceGraph): CoverageReport {
  const children = spineChildren(graph);
  const linked = linkedItemIds(graph);
  const byId = new Map(graph.items.map((item) => [item.id, item]));

  // --- spine gaps -----------------------------------------------------------
  const objectiveGaps = missingBeneath(graph, children, "business_objective", [
    "business_requirement",
  ]);
  const requirementGaps = missingBeneath(graph, children, "business_requirement", [
    "functional_requirement",
    "non_functional_requirement",
  ]);
  const functionalGaps = missingBeneath(graph, children, "functional_requirement", ["user_story"]);
  const storyGaps = missingBeneath(graph, children, "user_story", ["acceptance_criterion"]);

  // --- evidence -------------------------------------------------------------
  // Only requirement-shaped items. An assumption with no citation is *correct* — an
  // unsupported claim may not cite evidence (AI-OUTPUT-CONTRACT §D.6) — so listing it
  // here would flag the contract working as intended.
  const evidenceGaps = graph.items.filter(
    (item) =>
      (item.type === "business_requirement" ||
        item.type === "functional_requirement" ||
        item.type === "non_functional_requirement") &&
      !item.hasSourceEvidence,
  );

  // --- orphans --------------------------------------------------------------
  const orphans = graph.items.filter(
    (item) => !ORPHAN_EXEMPT.includes(item.type) && !linked.has(item.id),
  );

  // --- status conflicts -----------------------------------------------------
  // An approved item wired to a rejected one. Not automatically wrong — a requirement
  // may legitimately be constrained by something the team rejected — but it is the
  // kind of thing a reviewer wants to see before shipping the document.
  const approvedToRejected = graph.items.filter((item) => {
    if (item.status !== APPROVED_STATUS) return false;
    return graph.relations.some((relation) => {
      const otherId =
        relation.fromItemId === item.id
          ? relation.toItemId
          : relation.toItemId === item.id
            ? relation.fromItemId
            : null;
      if (otherId === null) return false;
      return byId.get(otherId)?.status === REJECTED_STATUS;
    });
  });

  // An approved requirement with an unanswered question hanging off it: the item says
  // "settled", the question says "not settled", and both cannot be true.
  const questionOnApproved = graph.items.filter((item) => {
    if (item.type !== "open_question") return false;
    if (!UNRESOLVED_QUESTION_STATES.includes(item.workflowState ?? "")) return false;
    return graph.relations.some(
      (relation) =>
        relation.fromItemId === item.id &&
        byId.get(relation.toItemId)?.status === APPROVED_STATUS,
    );
  });

  const findingOnReviewed = graph.items.filter((item) => {
    if (item.type !== "quality_finding") return false;
    if (!UNRESOLVED_FINDING_STATES.includes(item.workflowState ?? "")) return false;
    return graph.relations.some((relation) => {
      if (relation.fromItemId !== item.id) return false;
      const status = byId.get(relation.toItemId)?.status;
      return status === REVIEWED_STATUS || status === APPROVED_STATUS;
    });
  });

  // --- pre-existing cycles --------------------------------------------------
  // Reported, never repaired. See `findExistingCycles`.
  const cycleItemIds = new Set<string>();
  for (const loop of findExistingCycles(graph)) for (const id of loop) cycleItemIds.add(id);

  const findings: Record<CoverageKey, CoverageFinding> = {
    objective_without_requirement: {
      key: "objective_without_requirement",
      label: "Objectives with no business requirement",
      meaning: "Nothing beneath this objective says how it will be met.",
      itemIds: ids(objectiveGaps),
    },
    requirement_without_functional: {
      key: "requirement_without_functional",
      label: "Business requirements with no functional requirement",
      meaning: "Nothing beneath this requirement says how the system delivers it.",
      itemIds: ids(requirementGaps),
    },
    functional_without_story: {
      key: "functional_without_story",
      label: "Functional requirements with no user story",
      meaning: "This capability has not been expressed from a user's point of view.",
      itemIds: ids(functionalGaps),
    },
    story_without_criterion: {
      key: "story_without_criterion",
      label: "User stories with no acceptance criterion",
      meaning: "There is no stated way to tell whether this story is done.",
      itemIds: ids(storyGaps),
    },
    requirement_without_evidence: {
      key: "requirement_without_evidence",
      label: "Requirements with no source evidence",
      meaning: "No citation ties this requirement to the text it came from.",
      itemIds: ids(evidenceGaps),
    },
    orphan: {
      key: "orphan",
      label: "Orphan items",
      meaning: "No relation reaches this item in either direction.",
      itemIds: ids(orphans),
    },
    approved_linked_to_rejected: {
      key: "approved_linked_to_rejected",
      label: "Approved items linked to rejected items",
      meaning: "An approved item is related to something the team rejected.",
      itemIds: ids(approvedToRejected),
    },
    unresolved_question: {
      key: "unresolved_question",
      label: "Unresolved questions",
      meaning: "This question is still open or deferred.",
      itemIds: ids(
        graph.items.filter(
          (item) =>
            item.type === "open_question" &&
            UNRESOLVED_QUESTION_STATES.includes(item.workflowState ?? ""),
        ),
      ),
    },
    unresolved_finding: {
      key: "unresolved_finding",
      label: "Unresolved quality findings",
      meaning: "This finding is still open or only acknowledged.",
      itemIds: ids(
        graph.items.filter(
          (item) =>
            item.type === "quality_finding" &&
            UNRESOLVED_FINDING_STATES.includes(item.workflowState ?? ""),
        ),
      ),
    },
    open_question_on_approved: {
      key: "open_question_on_approved",
      label: "Unresolved questions on approved items",
      meaning: "This question is still open against an item already approved.",
      itemIds: ids(questionOnApproved),
    },
    unresolved_finding_on_reviewed: {
      key: "unresolved_finding_on_reviewed",
      label: "Unresolved findings on reviewed or approved items",
      meaning: "A quality issue is still outstanding on an item already signed off.",
      itemIds: ids(findingOnReviewed),
    },
    existing_cycle: {
      key: "existing_cycle",
      label: "Items in a traceability cycle",
      meaning:
        "These items form a loop in the hierarchy. Stored before typed relations existed; nothing is changed automatically.",
      itemIds: [...cycleItemIds],
    },
  };

  return {
    totals: {
      items: graph.items.length,
      linked: graph.items.filter((item) => linked.has(item.id)).length,
      orphans: findings.orphan.itemIds.length,
      missingAcceptanceCriteria: findings.story_without_criterion.itemIds.length,
      // Read off the findings rather than recounted, so a total and the list its
      // figure filters to cannot drift apart.
      openQuestions: findings.unresolved_question.itemIds.length,
      unresolvedQualityFindings: findings.unresolved_finding.itemIds.length,
    },
    findings,
  };
}
