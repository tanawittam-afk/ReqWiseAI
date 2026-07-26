/**
 * A hand-built `TraceGraph`, small enough to reason about by eye.
 *
 * Built by hand rather than derived from the provider fixture on purpose: these tests
 * are about what the coverage rules *say*, so the graph has to be readable at a glance
 * and has to contain the exact defects each rule looks for. A graph produced by the
 * mock would be a moving target.
 *
 * Shape:
 *
 *   OBJ-001 ──supports──► BR-001 ──implemented_by──► FR-001 ──expressed_as──► US-001
 *                                                          └─validated_by──► AC-001 (from US-001)
 *   OBJ-002                       (no requirement beneath it)
 *                         BR-002  (no functional requirement beneath it)
 *                                  FR-002 (no user story)
 *                                                     US-002 (no acceptance criterion)
 *   RISK-001                      orphan
 *   Q-001 ──raises_question──► BR-003 (approved)      unresolved question on an approved item
 *   QF-001 ──flags_quality_issue──► FR-003 (reviewed) unresolved finding on a reviewed item
 *   BR-004 (approved) ──related_to──► CON-001 (rejected)
 */

import type { TraceGraph, TraceItem, TraceRelation } from "../../lib/traceability/types";
import type { ItemType } from "../../lib/contracts/item-types";
import type { RelationType } from "../../lib/contracts/relations";

export const RUN_A = "run-a";
export const RUN_B = "run-b";

export function traceItem(
  id: string,
  displayId: string,
  type: ItemType,
  overrides: Partial<TraceItem> = {},
): TraceItem {
  return {
    id,
    displayId,
    type,
    title: `${displayId} title`,
    status: "draft",
    priority: "unassigned",
    workflowState: null,
    analysisRunId: RUN_A,
    hasSourceEvidence: true,
    ...overrides,
  };
}

export function traceRelation(
  fromItemId: string,
  toItemId: string,
  type: RelationType,
  legacy = false,
): TraceRelation {
  return { fromItemId, toItemId, type, legacy };
}

export function sampleGraph(): TraceGraph {
  const items: TraceItem[] = [
    traceItem("obj1", "OBJ-001", "business_objective"),
    traceItem("obj2", "OBJ-002", "business_objective"),
    traceItem("br1", "BR-001", "business_requirement"),
    traceItem("br2", "BR-002", "business_requirement"),
    traceItem("br3", "BR-003", "business_requirement", { status: "approved" }),
    traceItem("br4", "BR-004", "business_requirement", { status: "approved" }),
    traceItem("fr1", "FR-001", "functional_requirement"),
    traceItem("fr2", "FR-002", "functional_requirement"),
    traceItem("fr3", "FR-003", "functional_requirement", {
      status: "reviewed",
      hasSourceEvidence: false,
    }),
    traceItem("us1", "US-001", "user_story"),
    traceItem("us2", "US-002", "user_story"),
    traceItem("ac1", "AC-001", "acceptance_criterion"),
    traceItem("con1", "CON-001", "constraint", { status: "rejected" }),
    traceItem("risk1", "RISK-001", "risk", { analysisRunId: RUN_B }),
    traceItem("q1", "Q-001", "open_question", { workflowState: "open" }),
    traceItem("qf1", "QF-001", "quality_finding", { workflowState: "acknowledged" }),
    // Exempt from the orphan rule: context, not a link in the chain.
    traceItem("ps1", "PS-001", "problem_statement"),
    traceItem("stk1", "STK-001", "stakeholder"),
  ];

  const relations: TraceRelation[] = [
    traceRelation("obj1", "br1", "supports"),
    traceRelation("br1", "fr1", "implemented_by"),
    traceRelation("fr1", "us1", "expressed_as"),
    traceRelation("us1", "ac1", "validated_by"),
    traceRelation("br2", "us2", "related_to"),
    traceRelation("q1", "br3", "raises_question"),
    traceRelation("qf1", "fr3", "flags_quality_issue"),
    traceRelation("br4", "con1", "related_to"),
    traceRelation("br4", "fr2", "implemented_by"),
  ];

  return { projectId: "project-1", items, relations };
}

/**
 * The same spine written the pre-6B way: every edge a `derives_from` pointing from the
 * child up at its parent. Used to prove a legacy run still reads as covered.
 */
export function legacyGraph(): TraceGraph {
  const items: TraceItem[] = [
    traceItem("obj1", "OBJ-001", "business_objective"),
    traceItem("br1", "BR-001", "business_requirement"),
    traceItem("fr1", "FR-001", "functional_requirement"),
    traceItem("us1", "US-001", "user_story"),
    traceItem("ac1", "AC-001", "acceptance_criterion"),
  ];
  const relations: TraceRelation[] = [
    traceRelation("br1", "obj1", "derives_from", true),
    traceRelation("fr1", "br1", "derives_from", true),
    traceRelation("us1", "fr1", "derives_from", true),
    traceRelation("ac1", "us1", "derives_from", true),
  ];
  return { projectId: "project-legacy", items, relations };
}
