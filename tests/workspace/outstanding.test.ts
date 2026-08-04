/**
 * What counts as outstanding work across the whole workspace.
 *
 * The rules worth protecting here are the ones a `WHERE` clause would quietly get
 * wrong: an archived project is never work (nothing may be written to one), a
 * `needs_clarification` requirement is still waiting on somebody, an `acknowledged`
 * quality finding is *not* resolved, and a question that was deferred or marked not
 * applicable has been decided even though it was never answered.
 */

import { describe, expect, it } from "vitest";
import {
  BUCKET_ANCHOR,
  OUTSTANDING_BUCKETS,
  isAwaitingReview,
  isOpenFinding,
  isUnansweredQuestion,
  itemHref,
  outstandingCounts,
  partitionOutstanding,
  totalOutstanding,
} from "../../lib/workspace/outstanding";
import type { ItemType } from "../../lib/contracts/item-types";
import type {
  WorkspaceChangeRequestRow,
  WorkspaceItemRow,
  WorkspaceProjectRef,
} from "../../lib/workspace/types";

const ACTIVE: WorkspaceProjectRef = { id: "p1", name: "Active project", status: "active" };
const ARCHIVED: WorkspaceProjectRef = { id: "p2", name: "Archived project", status: "archived" };

let seq = 0;

function item(overrides: Partial<WorkspaceItemRow> & { type: ItemType }): WorkspaceItemRow {
  seq += 1;
  return {
    id: `item-${seq}`,
    displayId: `X-${String(seq).padStart(3, "0")}`,
    title: "A requirement",
    priority: "unassigned",
    status: "draft",
    evidenceClass: "stated",
    confidence: 0.8,
    updatedAt: "2026-08-01T00:00:00.000Z",
    workflowState: null,
    analysisRunId: "run-1",
    project: ACTIVE,
    hasSourceEvidence: true,
    ...overrides,
  };
}

function changeRequest(
  project: WorkspaceProjectRef = ACTIVE,
): WorkspaceChangeRequestRow {
  seq += 1;
  return {
    id: `cr-${seq}`,
    proposedTitle: "A better statement",
    reason: "The approved wording contradicts the answer",
    requestedAt: "2026-08-01T00:00:00.000Z",
    targetItemId: "item-1",
    targetDisplayId: "BR-001",
    targetTitle: "Original statement",
    analysisRunId: "run-1",
    project,
  };
}

describe("isAwaitingReview", () => {
  it("counts a draft requirement", () => {
    expect(isAwaitingReview(item({ type: "business_requirement", status: "draft" }))).toBe(true);
  });

  it("counts one sent back for clarification — it is still waiting on somebody", () => {
    expect(
      isAwaitingReview(item({ type: "functional_requirement", status: "needs_clarification" })),
    ).toBe(true);
  });

  it.each(["reviewed", "approved", "rejected"])("does not count %s", (status) => {
    expect(isAwaitingReview(item({ type: "business_requirement", status }))).toBe(false);
  });

  it("never counts a question or a finding — those are not reviewed, they are answered", () => {
    expect(isAwaitingReview(item({ type: "open_question", status: "draft" }))).toBe(false);
    expect(isAwaitingReview(item({ type: "quality_finding", status: "draft" }))).toBe(false);
  });

  it("never counts anything in an archived project", () => {
    expect(
      isAwaitingReview(item({ type: "business_requirement", status: "draft", project: ARCHIVED })),
    ).toBe(false);
  });
});

describe("isUnansweredQuestion", () => {
  it("counts an open question", () => {
    expect(isUnansweredQuestion(item({ type: "open_question", workflowState: "open" }))).toBe(true);
  });

  it.each(["answered", "deferred", "not_applicable"])(
    "does not count a %s question — it was decided, answered or not",
    (workflowState) => {
      expect(isUnansweredQuestion(item({ type: "open_question", workflowState }))).toBe(false);
    },
  );

  it("never counts anything in an archived project", () => {
    expect(
      isUnansweredQuestion(
        item({ type: "open_question", workflowState: "open", project: ARCHIVED }),
      ),
    ).toBe(false);
  });
});

describe("isOpenFinding", () => {
  it("counts an open finding", () => {
    expect(isOpenFinding(item({ type: "quality_finding", workflowState: "open" }))).toBe(true);
  });

  it("counts an acknowledged one — seeing a finding is not resolving it", () => {
    expect(isOpenFinding(item({ type: "quality_finding", workflowState: "acknowledged" }))).toBe(
      true,
    );
  });

  it.each(["resolved", "dismissed"])("does not count a %s finding", (workflowState) => {
    expect(isOpenFinding(item({ type: "quality_finding", workflowState }))).toBe(false);
  });

  it("never counts anything in an archived project", () => {
    expect(
      isOpenFinding(item({ type: "quality_finding", workflowState: "open", project: ARCHIVED })),
    ).toBe(false);
  });
});

describe("partitionOutstanding", () => {
  it("puts every row in exactly one bucket, and nothing archived in any", () => {
    const items = [
      item({ type: "business_requirement", status: "draft" }),
      item({ type: "business_requirement", status: "approved" }),
      item({ type: "open_question", workflowState: "open" }),
      item({ type: "open_question", workflowState: "answered" }),
      item({ type: "quality_finding", workflowState: "acknowledged" }),
      item({ type: "business_requirement", status: "draft", project: ARCHIVED }),
    ];
    const work = partitionOutstanding(items, [changeRequest(), changeRequest(ARCHIVED)]);

    expect(work.awaitingReview).toHaveLength(1);
    expect(work.unansweredQuestions).toHaveLength(1);
    expect(work.openFindings).toHaveLength(1);
    expect(work.pendingChangeRequests).toHaveLength(1);
    for (const list of Object.values(work)) {
      for (const row of list) expect(row.project.status).toBe("active");
    }
  });

  it("counts an empty workspace as zero, not as a missing number", () => {
    const counts = outstandingCounts(partitionOutstanding([], []));
    for (const bucket of OUTSTANDING_BUCKETS) expect(counts[bucket]).toBe(0);
    expect(totalOutstanding(counts)).toBe(0);
  });

  it("totals the four buckets and nothing else", () => {
    const work = partitionOutstanding(
      [
        item({ type: "business_requirement", status: "draft" }),
        item({ type: "open_question", workflowState: "open" }),
      ],
      [changeRequest()],
    );
    expect(totalOutstanding(outstandingCounts(work))).toBe(3);
  });
});

describe("anchors and links", () => {
  it("gives every bucket a distinct anchor, so a count and its section cannot drift", () => {
    const anchors = OUTSTANDING_BUCKETS.map((bucket) => BUCKET_ANCHOR[bucket]);
    expect(new Set(anchors).size).toBe(OUTSTANDING_BUCKETS.length);
    for (const anchor of anchors) expect(anchor).toMatch(/^[a-z-]+$/);
  });

  it("builds the same workspace URL shape the traceability matrix links to", () => {
    expect(itemHref("proj", "run", "item")).toBe(
      "/workspace/projects/proj/analyses/run?item=item",
    );
  });
});
