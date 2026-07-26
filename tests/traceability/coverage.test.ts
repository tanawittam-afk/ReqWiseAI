/**
 * The coverage rules.
 *
 * Each test names the defect it is looking for and asserts the *exact* set of items
 * flagged, not just a count — a rule that flagged everything would pass a count
 * assertion and be useless.
 */

import { describe, expect, it } from "vitest";
import { COVERAGE_DISCLAIMER, COVERAGE_KEYS, computeCoverage } from "../../lib/traceability/coverage";
import { findExistingCycles, incoming, linkedItemIds, outgoing, spineChildren } from "../../lib/traceability/graph";
import { legacyGraph, sampleGraph, traceItem, traceRelation } from "./fixtures";
import type { TraceGraph } from "../../lib/traceability/types";

function flagged(graph: TraceGraph, key: (typeof COVERAGE_KEYS)[number]): string[] {
  return [...computeCoverage(graph).findings[key].itemIds].sort();
}

describe("coverage", () => {
  it("states plainly that it is not a verdict", () => {
    expect(COVERAGE_DISCLAIMER).toBe(
      "Coverage indicators assist review and do not replace human judgment.",
    );
  });

  it("defines a finding for every declared key", () => {
    const report = computeCoverage(sampleGraph());
    for (const key of COVERAGE_KEYS) {
      expect(report.findings[key]).toBeDefined();
      expect(report.findings[key].key).toBe(key);
      expect(report.findings[key].meaning.length).toBeGreaterThan(0);
    }
  });

  it("finds objectives with no business requirement beneath them", () => {
    expect(flagged(sampleGraph(), "objective_without_requirement")).toEqual(["obj2"]);
  });

  it("finds business requirements with no functional requirement beneath them", () => {
    // br1 and br4 have one; br2 has only a `related_to`, which is not the spine; br3
    // has only a question pointing at it.
    expect(flagged(sampleGraph(), "requirement_without_functional")).toEqual(["br2", "br3"]);
  });

  it("finds functional requirements with no user story", () => {
    expect(flagged(sampleGraph(), "functional_without_story")).toEqual(["fr2", "fr3"]);
  });

  it("finds user stories with no acceptance criterion", () => {
    expect(flagged(sampleGraph(), "story_without_criterion")).toEqual(["us2"]);
  });

  it("finds requirements with no source evidence, and only requirements", () => {
    // fr3 is the only uncited requirement. An assumption with no citation is correct,
    // not a gap, so nothing else appears here.
    expect(flagged(sampleGraph(), "requirement_without_evidence")).toEqual(["fr3"]);
  });

  it("finds orphans, exempting the types that are context rather than links", () => {
    // obj2 and risk1 are the unlinked items that are not exempt. ps1 and stk1 are
    // unlinked too, and are deliberately not reported: a problem statement and a
    // stakeholder are context, and counting them would make the number rise when the
    // analysis is doing its job.
    expect(flagged(sampleGraph(), "orphan")).toEqual(["obj2", "risk1"]);
  });

  it("reports an item under every rule it actually breaks", () => {
    // obj2 has no requirement beneath it *and* no relation at all. Both are true, and
    // suppressing one because the other fired would hide a finding from whichever
    // filter the reviewer happened to open.
    const report = computeCoverage(sampleGraph());
    expect(report.findings.objective_without_requirement.itemIds).toContain("obj2");
    expect(report.findings.orphan.itemIds).toContain("obj2");
  });

  it("finds an approved item linked to a rejected one, in either direction", () => {
    expect(flagged(sampleGraph(), "approved_linked_to_rejected")).toEqual(["br4"]);
  });

  it("finds an unresolved question hanging off an approved item", () => {
    expect(flagged(sampleGraph(), "open_question_on_approved")).toEqual(["q1"]);
  });

  it("finds an unresolved finding on a reviewed item", () => {
    expect(flagged(sampleGraph(), "unresolved_finding_on_reviewed")).toEqual(["qf1"]);
  });

  it("does not flag a question that has been answered", () => {
    const graph = sampleGraph();
    const q1 = graph.items.find((item) => item.id === "q1");
    if (q1) q1.workflowState = "answered";
    expect(flagged(graph, "open_question_on_approved")).toEqual([]);
  });

  it("does not flag a finding that has been resolved", () => {
    const graph = sampleGraph();
    const qf1 = graph.items.find((item) => item.id === "qf1");
    if (qf1) qf1.workflowState = "resolved";
    expect(flagged(graph, "unresolved_finding_on_reviewed")).toEqual([]);
  });

  it("counts totals that agree with the findings they summarise", () => {
    const report = computeCoverage(sampleGraph());
    expect(report.totals.items).toBe(18);
    expect(report.totals.orphans).toBe(report.findings.orphan.itemIds.length);
    expect(report.totals.missingAcceptanceCriteria).toBe(
      report.findings.story_without_criterion.itemIds.length,
    );
    // Four items carry no relation at all: obj2, risk1, ps1, stk1.
    expect(report.totals.linked + 4).toBe(report.totals.items);
    expect(report.totals.openQuestions).toBe(1);
    expect(report.totals.unresolvedQualityFindings).toBe(1);
  });

  it("makes every summary figure filter to exactly the set it counts", () => {
    // The bug this pins: the "Open questions" figure counted every unresolved question
    // and then filtered to the subset sitting on an approved item, so a row reading
    // "15" opened a view of 0. A number and the view it opens must describe one set.
    const report = computeCoverage(sampleGraph());
    expect(report.totals.orphans).toBe(report.findings.orphan.itemIds.length);
    expect(report.totals.missingAcceptanceCriteria).toBe(
      report.findings.story_without_criterion.itemIds.length,
    );
    expect(report.totals.openQuestions).toBe(report.findings.unresolved_question.itemIds.length);
    expect(report.totals.unresolvedQualityFindings).toBe(
      report.findings.unresolved_finding.itemIds.length,
    );
  });

  it("keeps the plain outstanding lists distinct from the status-conflict lists", () => {
    const graph = sampleGraph();
    // A second open question, on a draft item — outstanding, but no conflict.
    graph.items.push({
      id: "q2",
      displayId: "Q-002",
      type: "open_question",
      title: "second question",
      status: "draft",
      priority: "unassigned",
      workflowState: "open",
      analysisRunId: "run-a",
      hasSourceEvidence: false,
    });
    graph.relations.push({
      fromItemId: "q2",
      toItemId: "br1",
      type: "raises_question",
      legacy: false,
    });
    const report = computeCoverage(graph);
    expect(report.findings.unresolved_question.itemIds.sort()).toEqual(["q1", "q2"]);
    // Only q1 hangs off an approved item.
    expect(report.findings.open_question_on_approved.itemIds).toEqual(["q1"]);
  });

  it("reads a fully legacy derives_from chain as covered, not as a wall of gaps", () => {
    // The direction is the opposite of an authored run's; canonicalising is what makes
    // a pre-6B project readable rather than reported as entirely unlinked.
    const report = computeCoverage(legacyGraph());
    expect(report.findings.objective_without_requirement.itemIds).toEqual([]);
    expect(report.findings.requirement_without_functional.itemIds).toEqual([]);
    expect(report.findings.functional_without_story.itemIds).toEqual([]);
    expect(report.findings.story_without_criterion.itemIds).toEqual([]);
    expect(report.findings.orphan.itemIds).toEqual([]);
  });

  it("reports a pre-existing cycle instead of repairing it", () => {
    const graph = legacyGraph();
    // A legacy row that contradicts the chain: BR derives_from FR *and* FR derives_from BR.
    graph.relations.push(traceRelation("br1", "fr1", "derives_from", true));
    const report = computeCoverage(graph);
    expect(report.findings.existing_cycle.itemIds.sort()).toEqual(["br1", "fr1"]);
    // Nothing was changed: the offending rows are all still there.
    expect(graph.relations.length).toBe(5);
  });

  it("reports no cycle for a clean graph", () => {
    expect(computeCoverage(sampleGraph()).findings.existing_cycle.itemIds).toEqual([]);
  });
});

describe("graph helpers", () => {
  it("lists outgoing and incoming relations from the right end", () => {
    const graph = sampleGraph();
    expect(outgoing(graph, "br1").map((end) => end.other?.id)).toEqual(["fr1"]);
    expect(incoming(graph, "br1").map((end) => end.other?.id)).toEqual(["obj1"]);
  });

  it("counts an item as linked when a relation reaches it in either direction", () => {
    const linked = linkedItemIds(sampleGraph());
    expect(linked.has("ac1")).toBe(true); // only ever a target
    expect(linked.has("obj1")).toBe(true); // only ever a source
    expect(linked.has("risk1")).toBe(false);
  });

  it("excludes non-hierarchical relations from the spine", () => {
    const children = spineChildren(sampleGraph());
    // br2 → us2 is `related_to`, which carries no parent/child claim.
    expect(children.get("br2")).toBeUndefined();
  });

  it("finds no cycle where only related_to points both ways", () => {
    const graph: TraceGraph = {
      projectId: "p",
      items: [
        traceItem("a", "BR-001", "business_requirement"),
        traceItem("b", "BR-002", "business_requirement"),
      ],
      relations: [
        traceRelation("a", "b", "related_to"),
        traceRelation("b", "a", "related_to"),
      ],
    };
    expect(findExistingCycles(graph)).toEqual([]);
  });
});
