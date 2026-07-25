/**
 * How an analysis run is shaped for the three-panel workspace: tab partition, grouping,
 * search and the counts a group header is allowed to claim.
 *
 * The rules worth protecting here are the honest ones — issues never appear among the
 * requirements, uncited items sort last instead of being guessed into place, and an
 * empty group reports no confidence rather than zero.
 */

import { describe, expect, it } from "vitest";
import type { AnalysisItemView } from "../../lib/analysis/queries";
import {
  EMPTY_FILTERS,
  filterItems,
  firstCitedOffset,
  groupItems,
  groupStats,
  hasActiveFilter,
  partitionItems,
  runSummary,
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
    sourceReferences: [],
    relatedDisplayIds: [],
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
    const { requirements, issues } = partitionItems(items);
    expect(requirements.map((i) => i.type)).toEqual(["functional_requirement", "risk"]);
    expect(issues.map((i) => i.type)).toEqual(["open_question", "quality_finding"]);
  });

  it("keeps a risk as a requirement — it is a finding, not a defect in the analysis", () => {
    const { issues } = partitionItems([item({ type: "risk" })]);
    expect(issues).toHaveLength(0);
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
      item({ type: "open_question" }),
      item({ type: "open_question" }),
      item({ type: "risk" }),
      item({ type: "quality_finding" }),
    ]);
    expect(summary).toEqual({
      itemCount: 6,
      requirementCount: 3,
      openQuestions: 2,
      risks: 1,
      qualityFindings: 1,
      citedCount: 1,
    });
  });
});
