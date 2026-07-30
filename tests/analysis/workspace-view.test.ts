/**
 * How an analysis run is shaped for the three-panel workspace: tab partition, grouping,
 * search and the counts a group header is allowed to claim.
 *
 * The rules worth protecting here are the honest ones — issues never appear among the
 * requirements, uncited items sort last instead of being guessed into place, and an
 * empty group reports no confidence rather than zero.
 */

import { describe, expect, it } from "vitest";
import type { AnalysisItemView, AnalysisRunDetail } from "../../lib/analysis/queries";
import {
  EMPTY_FILTERS,
  filterItems,
  firstCitedOffset,
  groupItems,
  groupStats,
  hasActiveFilter,
  hasSourceEvidence,
  partitionItems,
  runSummary,
  tabForType,
  toAnalysisWorkspaceRun,
} from "../../lib/analysis/workspace-view";
import type { ItemType } from "../../lib/contracts/item-types";

let seq = 0;

function item(overrides: Partial<AnalysisItemView> & { type: ItemType }): AnalysisItemView {
  seq += 1;
  return {
    id: `id-${seq}`,
    displayId: `X-${String(seq).padStart(3, "0")}`,
    providerKey: `key-${seq}`,
    title: "A requirement",
    description: "",
    priority: "medium",
    status: "draft",
    evidenceClass: "stated",
    origin: "source_analysis",
    confidence: 0.8,
    rationale: null,
    attributes: null,
    versionNo: 1,
    updatedAt: "2026-07-25T00:00:00.000Z",
    workflowState: null,
    resolutionText: null,
    resolvedAt: null,
    resolvedBy: null,
    followUpOn: null,
    sourceReferences: [],
    relatedDisplayIds: [],
    changeRequests: [],
    changeRequestCandidateItemIds: [],
    ...overrides,
  };
}

function citedAt(start: number, excerpt = "excerpt"): AnalysisItemView["sourceReferences"] {
  return [{ excerpt, startOffset: start, endOffset: start + 5, evidenceStrength: null, offsetVerified: true }];
}

describe("partitionItems", () => {
  it("routes open questions and quality findings to the issues tab", () => {
    const items = [
      item({ type: "functional_requirement" }),
      item({ type: "open_question" }),
      item({ type: "quality_finding" }),
      item({ type: "risk" }),
    ];
    const { requirements, questions, findings } = partitionItems(items);
    expect(requirements.map((entry) => entry.type)).toEqual(["functional_requirement", "risk"]);
    expect(questions.map((entry) => entry.type)).toEqual(["open_question"]);
    expect(findings.map((entry) => entry.type)).toEqual(["quality_finding"]);
  });

  it("keeps a risk as a requirement — it is a finding, not a defect in the analysis", () => {
    const { requirements, questions, findings } = partitionItems([item({ type: "risk" })]);
    expect(requirements).toHaveLength(1);
    expect(questions).toHaveLength(0);
    expect(findings).toHaveLength(0);
  });
});

describe("groupItems", () => {
  it("groups by type in the canonical ITEM_TYPES order, not insertion order", () => {
    const groups = groupItems(
      [
        item({ type: "user_story" }),
        item({ type: "problem_statement" }),
        item({ type: "functional_requirement" }),
      ],
      "type",
    );
    expect(groups.map((g) => g.key)).toEqual([
      "problem_statement",
      "functional_requirement",
      "user_story",
    ]);
    expect(groups[0].label).toBe("Problem statements");
  });

  it("drops empty groups", () => {
    const groups = groupItems([item({ type: "risk" })], "type");
    expect(groups).toHaveLength(1);
  });

  it("orders priority groups critical → unassigned", () => {
    const groups = groupItems(
      [
        item({ type: "risk", priority: "low" }),
        item({ type: "risk", priority: "critical" }),
        item({ type: "risk", priority: "unassigned" }),
      ],
      "priority",
    );
    expect(groups.map((g) => g.key)).toEqual(["critical", "low", "unassigned"]);
  });

  it("orders review-status groups along the workflow", () => {
    const groups = groupItems(
      [
        item({ type: "risk", status: "approved" }),
        item({ type: "risk", status: "draft" }),
        item({ type: "risk", status: "needs_clarification" }),
      ],
      "review_status",
    );
    expect(groups.map((g) => g.label)).toEqual(["Draft", "Needs clarification", "Approved"]);
  });

  it("sorts source order by first verified offset and puts uncited items in their own group", () => {
    const late = item({ type: "risk", sourceReferences: citedAt(90) });
    const early = item({ type: "risk", sourceReferences: citedAt(10) });
    const uncited = item({ type: "assumption" });
    const groups = groupItems([late, uncited, early], "source_order");

    expect(groups.map((g) => g.key)).toEqual(["cited", "uncited"]);
    expect(groups[0].items.map((i) => i.id)).toEqual([early.id, late.id]);
    expect(groups[1].items.map((i) => i.id)).toEqual([uncited.id]);
  });

  it("does not treat an unverified offset as a position in the source", () => {
    const unverified = item({
      type: "risk",
      sourceReferences: [
        { excerpt: "x", startOffset: 3, endOffset: 8, evidenceStrength: null, offsetVerified: false },
      ],
    });
    expect(firstCitedOffset(unverified)).toBe(Number.POSITIVE_INFINITY);
    expect(groupItems([unverified], "source_order").map((g) => g.key)).toEqual(["uncited"]);
  });
});

describe("filterItems", () => {
  const items = [
    item({ type: "functional_requirement", title: "Customer books a room", priority: "high" }),
    item({
      type: "open_question",
      title: "Refund policy is unresolved",
      sourceReferences: citedAt(20, "การคืนเงิน"),
      priority: "low",
      status: "needs_clarification",
      evidenceClass: "inferred",
    }),
  ];

  it("returns everything for empty filters", () => {
    expect(filterItems(items, EMPTY_FILTERS)).toHaveLength(2);
  });

  it("matches the title case-insensitively", () => {
    expect(filterItems(items, { ...EMPTY_FILTERS, query: "ROOM" })).toHaveLength(1);
  });

  it("matches an excerpt, so searching the evidence finds the item", () => {
    const hits = filterItems(items, { ...EMPTY_FILTERS, query: "คืนเงิน" });
    expect(hits.map((i) => i.type)).toEqual(["open_question"]);
  });

  it("matches a display id", () => {
    expect(filterItems(items, { ...EMPTY_FILTERS, query: items[0].displayId })).toHaveLength(1);
  });

  it("combines a query with a facet", () => {
    expect(
      filterItems(items, { ...EMPTY_FILTERS, query: "e", priority: "high" }).map((i) => i.priority),
    ).toEqual(["high"]);
  });

  it("filters by status and evidence class", () => {
    expect(filterItems(items, { ...EMPTY_FILTERS, status: "needs_clarification" })).toHaveLength(1);
    expect(filterItems(items, { ...EMPTY_FILTERS, evidenceClass: "assumed" })).toHaveLength(0);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(filterItems(items, { ...EMPTY_FILTERS, query: "   " })).toHaveLength(2);
  });
});

describe("hasActiveFilter", () => {
  it("ignores the free-text query — the search box shows its own state", () => {
    expect(hasActiveFilter({ ...EMPTY_FILTERS, query: "room" })).toBe(false);
    expect(hasActiveFilter({ ...EMPTY_FILTERS, priority: "high" })).toBe(true);
  });
});

describe("groupStats", () => {
  it("reports no confidence for an empty group rather than zero", () => {
    expect(groupStats([])).toEqual({ count: 0, averageConfidence: null, citedCount: 0 });
  });

  it("averages confidence and counts only exactly-located citations", () => {
    const stats = groupStats([
      item({ type: "risk", confidence: 0.9, sourceReferences: citedAt(0) }),
      item({ type: "risk", confidence: 0.5 }),
    ]);
    expect(stats.count).toBe(2);
    expect(stats.averageConfidence).toBeCloseTo(0.7);
    expect(stats.citedCount).toBe(1);
  });
});

describe("runSummary", () => {
  it("counts each honest quantity separately", () => {
    const summary = runSummary([
      item({ type: "functional_requirement", sourceReferences: citedAt(0) }),
      item({ type: "business_requirement" }),
      item({ type: "open_question", workflowState: "open" }),
      item({ type: "open_question", workflowState: "answered" }),
      item({ type: "risk" }),
      item({ type: "quality_finding", workflowState: "acknowledged" }),
    ]);
    expect(summary).toEqual({
      itemCount: 6,
      requirementCount: 3,
      openQuestions: 2,
      risks: 1,
      qualityFindings: 1,
      // one of the two questions has been answered; an acknowledged finding is
      // explicitly still unresolved (product spec §5)
      questionsUnresolved: 1,
      findingsUnresolved: 1,
      citedCount: 1,
    });
  });

  it("counts a resolved finding and a deferred question as no longer needing anybody", () => {
    const summary = runSummary([
      item({ type: "open_question", workflowState: "deferred" }),
      item({ type: "quality_finding", workflowState: "resolved" }),
      item({ type: "quality_finding", workflowState: "dismissed" }),
    ]);
    expect(summary.questionsUnresolved).toBe(0);
    expect(summary.findingsUnresolved).toBe(0);
  });
});

describe("toAnalysisWorkspaceRun", () => {
  it("projects only the fields consumed by the client workspace", () => {
    const fullRun: AnalysisRunDetail = {
      id: "run-1",
      projectId: "project-1",
      sourceDocumentId: "source-1",
      provider: "gemini",
      model: "PRIVATE_MODEL",
      promptVersion: "PRIVATE_PROMPT_VERSION",
      validationStatus: "valid",
      outputLang: "th",
      schemaVersion: "1.0.0",
      createdAt: "2026-07-27T00:00:00.000Z",
      errorSummary: null,
      items: [item({ type: "business_requirement" })],
      summary: { itemCount: 1, byType: { business_requirement: 1 } },
    };

    const projection = toAnalysisWorkspaceRun(fullRun);

    expect(Object.keys(projection).sort()).toEqual([
      "createdAt",
      "id",
      "items",
      "projectId",
    ]);
    expect(projection.items).toHaveLength(1);
    expect(JSON.stringify(projection)).not.toMatch(
      /PRIVATE_MODEL|PRIVATE_PROMPT_VERSION|model|promptVersion/,
    );
  });
});

describe("workflow tabs and evidence (slice 6A)", () => {
  it("routes each type to its own tab, so one heading never covers two jobs", () => {
    expect(tabForType("open_question")).toBe("questions");
    expect(tabForType("quality_finding")).toBe("findings");
    expect(tabForType("functional_requirement")).toBe("requirements");
    expect(tabForType("risk")).toBe("requirements");
  });

  it("counts each tab from the partition, not from a hand-maintained total", () => {
    const items = [
      item({ type: "functional_requirement" }),
      item({ type: "open_question", workflowState: "open" }),
      item({ type: "open_question", workflowState: "answered" }),
      item({ type: "quality_finding", workflowState: "resolved" }),
    ];
    const { requirements, questions, findings } = partitionItems(items);
    expect([requirements.length, questions.length, findings.length]).toEqual([1, 2, 1]);
  });

  it("filters by workflow state", () => {
    const items = [
      item({ type: "open_question", workflowState: "open" }),
      item({ type: "open_question", workflowState: "deferred" }),
      item({ type: "open_question", workflowState: "answered" }),
    ];
    expect(filterItems(items, { ...EMPTY_FILTERS, workflowState: "deferred" })).toHaveLength(1);
    expect(filterItems(items, { ...EMPTY_FILTERS, workflowState: "open" })).toHaveLength(1);
    expect(filterItems(items, EMPTY_FILTERS)).toHaveLength(3);
  });

  it("counts a workflow-state filter as an active filter", () => {
    expect(hasActiveFilter({ ...EMPTY_FILTERS, workflowState: "answered" })).toBe(true);
  });

  it("searches the recorded answer, so a reader can find a question by what was said", () => {
    const items = [
      item({ type: "open_question", title: "Refund policy", resolutionText: "คืนเงินภายใน 24 ชั่วโมง" }),
      item({ type: "open_question", title: "Notification channel" }),
    ];
    expect(filterItems(items, { ...EMPTY_FILTERS, query: "24 ชั่วโมง" })).toHaveLength(1);
  });

  it("groups by workflow state with the states that still need somebody first", () => {
    const groups = groupItems(
      [
        item({ type: "open_question", workflowState: "answered" }),
        item({ type: "open_question", workflowState: "open" }),
        item({ type: "open_question", workflowState: "deferred" }),
      ],
      "workflow_state",
    );
    expect(groups.map((g) => g.label)).toEqual(["Open", "Deferred", "Answered"]);
  });

  it("reports evidence only when the database holds an exactly-located excerpt", () => {
    const cited = item({ type: "open_question", sourceReferences: citedAt(12) });
    const fromProfile = item({ type: "open_question", origin: "domain_profile", evidenceClass: "assumed" });
    const unverified = item({
      type: "open_question",
      sourceReferences: [
        { excerpt: "x", startOffset: 3, endOffset: 8, evidenceStrength: null, offsetVerified: false },
      ],
    });

    expect(hasSourceEvidence(cited)).toBe(true);
    // No excerpt at all, and no excerpt whose position was never proven — neither may
    // produce a highlight (product spec §14).
    expect(hasSourceEvidence(fromProfile)).toBe(false);
    expect(hasSourceEvidence(unverified)).toBe(false);
  });
});
