/**
 * The edit and review contracts.
 *
 * The interesting assertions here are the *refusals*. A schema that accepts what it
 * should reject fails silently in production: the extra key is dropped, the write
 * succeeds, and nobody learns that a client has been trying to set `status` by hand
 * for six weeks. `strictObject` is what turns that into an error, and these tests are
 * what keep it strict when somebody later "simplifies" it to `z.object`.
 */

import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  CHANGE_REASON_MAX,
  DEFERRED_WORKFLOW_LABEL,
  ITEM_TITLE_MAX,
  REVIEWABLE_ITEM_TYPES,
  activityTypeFor,
  isAllowedTransition,
  isReviewableItemType,
  isTerminalStatus,
  itemEditSchema,
  readItemEditForm,
  readReviewActionForm,
  requiresNote,
  reviewActionSchema,
  reviewFieldErrors,
} from "../../lib/contracts/review";
import { ITEM_TYPES } from "../../lib/contracts/item-types";

const validEdit = {
  expectedVersion: 3,
  title: "ระบบต้องแสดงห้องว่างแบบเรียลไทม์",
  description: "Availability must reflect confirmed reservations in real time.",
  priority: "high",
  changeReason: "Clarified after the stakeholder call",
};

describe("itemEditSchema", () => {
  it("accepts the three editable fields plus an optional reason", () => {
    const parsed = itemEditSchema.safeParse(validEdit);
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const parsed = itemEditSchema.safeParse({ ...validEdit, title: "" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a whitespace-only title", () => {
    const parsed = itemEditSchema.safeParse({ ...validEdit, title: "   \n  " });
    expect(parsed.success).toBe(false);
  });

  it("trims the title and description rather than storing the padding", () => {
    const parsed = itemEditSchema.parse({
      ...validEdit,
      title: "  A requirement  ",
      description: "  Its meaning  ",
    });
    expect(parsed.title).toBe("A requirement");
    expect(parsed.description).toBe("Its meaning");
  });

  it("rejects an empty description", () => {
    expect(itemEditSchema.safeParse({ ...validEdit, description: "  " }).success).toBe(false);
  });

  it("rejects a title over the limit", () => {
    const parsed = itemEditSchema.safeParse({ ...validEdit, title: "x".repeat(ITEM_TITLE_MAX + 1) });
    expect(parsed.success).toBe(false);
  });

  it("rejects an invalid priority", () => {
    expect(itemEditSchema.safeParse({ ...validEdit, priority: "urgent" }).success).toBe(false);
  });

  it("rejects a change reason over the limit", () => {
    const parsed = itemEditSchema.safeParse({
      ...validEdit,
      changeReason: "x".repeat(CHANGE_REASON_MAX + 1),
    });
    expect(parsed.success).toBe(false);
  });

  it("turns an empty change reason into null rather than an empty string", () => {
    expect(itemEditSchema.parse({ ...validEdit, changeReason: "   " }).changeReason).toBeNull();
  });

  it("refuses a client-supplied status", () => {
    expect(itemEditSchema.safeParse({ ...validEdit, status: "approved" }).success).toBe(false);
  });

  it("refuses a client-supplied version override", () => {
    expect(itemEditSchema.safeParse({ ...validEdit, versionNo: 99 }).success).toBe(false);
  });

  it("refuses a client-supplied evidence class", () => {
    expect(itemEditSchema.safeParse({ ...validEdit, evidenceClass: "stated" }).success).toBe(false);
  });

  it("refuses client-supplied source references", () => {
    const parsed = itemEditSchema.safeParse({
      ...validEdit,
      sourceReferences: [{ excerpt: "forged", startOffset: 0, endOffset: 6 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses a client-supplied item type, confidence or display id", () => {
    for (const forged of [{ itemType: "risk" }, { confidence: 1 }, { displayId: "FR-999" }]) {
      expect(itemEditSchema.safeParse({ ...validEdit, ...forged }).success).toBe(false);
    }
  });

  it("requires a positive integer expectedVersion", () => {
    expect(itemEditSchema.safeParse({ ...validEdit, expectedVersion: 0 }).success).toBe(false);
    expect(itemEditSchema.safeParse({ ...validEdit, expectedVersion: -1 }).success).toBe(false);
    expect(itemEditSchema.safeParse({ ...validEdit, expectedVersion: 1.5 }).success).toBe(false);
  });

  it("coerces the version the form submits as a string", () => {
    expect(itemEditSchema.parse({ ...validEdit, expectedVersion: "4" }).expectedVersion).toBe(4);
  });

  it("keys its errors by field so the form can render them in place", () => {
    const parsed = itemEditSchema.safeParse({ ...validEdit, title: "", priority: "urgent" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const errors = reviewFieldErrors(parsed.error);
    expect(Object.keys(errors).sort()).toEqual(["priority", "title"]);
  });
});

describe("reviewActionSchema", () => {
  const base = { toStatus: "reviewed", expectedStatus: "draft", note: "" };

  it("accepts a decision with no note when none is required", () => {
    const parsed = reviewActionSchema.parse(base);
    expect(parsed.note).toBeNull();
  });

  it("requires a note when rejecting", () => {
    const parsed = reviewActionSchema.safeParse({ ...base, toStatus: "rejected" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(reviewFieldErrors(parsed.error).note).toBe("A note is required");
  });

  it("requires a note when requesting clarification", () => {
    expect(
      reviewActionSchema.safeParse({ ...base, toStatus: "needs_clarification" }).success,
    ).toBe(false);
    expect(
      reviewActionSchema.safeParse({
        ...base,
        toStatus: "needs_clarification",
        note: "Which branches does this apply to?",
      }).success,
    ).toBe(true);
  });

  it("refuses an unknown status and a client-supplied actor", () => {
    expect(reviewActionSchema.safeParse({ ...base, toStatus: "implemented" }).success).toBe(false);
    expect(reviewActionSchema.safeParse({ ...base, actorId: "someone-else" }).success).toBe(false);
  });
});

describe("status workflow", () => {
  it("matches the product's transition table exactly", () => {
    expect(ALLOWED_TRANSITIONS.draft).toEqual(["reviewed", "needs_clarification", "rejected"]);
    expect(ALLOWED_TRANSITIONS.needs_clarification).toEqual(["reviewed", "rejected"]);
    expect(ALLOWED_TRANSITIONS.reviewed).toEqual(["approved", "needs_clarification", "rejected"]);
  });

  it("treats approved and rejected as terminal", () => {
    expect(ALLOWED_TRANSITIONS.approved).toEqual([]);
    expect(ALLOWED_TRANSITIONS.rejected).toEqual([]);
    expect(isTerminalStatus("approved")).toBe(true);
    expect(isTerminalStatus("rejected")).toBe(true);
    expect(isTerminalStatus("reviewed")).toBe(false);
  });

  it("forbids returning an approved or rejected item to draft", () => {
    expect(isAllowedTransition("approved", "draft")).toBe(false);
    expect(isAllowedTransition("rejected", "draft")).toBe(false);
  });

  it("does not offer a return to draft as a review decision", () => {
    // Returning to draft is what EDITING does to a stale review, not a menu item.
    for (const from of ["draft", "needs_clarification", "reviewed"]) {
      expect(isAllowedTransition(from, "draft")).toBe(false);
    }
  });

  it("forbids skipping review on the way to approval", () => {
    expect(isAllowedTransition("draft", "approved")).toBe(false);
    expect(isAllowedTransition("needs_clarification", "approved")).toBe(false);
  });

  it("requires a note for exactly the two instruction-bearing outcomes", () => {
    expect(requiresNote("rejected")).toBe(true);
    expect(requiresNote("needs_clarification")).toBe(true);
    expect(requiresNote("reviewed")).toBe(false);
    expect(requiresNote("approved")).toBe(false);
  });

  it("records the decision as the right activity type", () => {
    expect(activityTypeFor("approved")).toBe("approve");
    expect(activityTypeFor("rejected")).toBe("reject");
    expect(activityTypeFor("needs_clarification")).toBe("request_clarification");
    expect(activityTypeFor("reviewed")).toBe("status_change");
  });
});

describe("reviewable item types", () => {
  it("covers the twelve requirement types and excludes the two deferred ones", () => {
    expect(REVIEWABLE_ITEM_TYPES).toHaveLength(12);
    expect(ITEM_TYPES).toHaveLength(14);
    expect(isReviewableItemType("functional_requirement")).toBe(true);
    expect(isReviewableItemType("risk")).toBe(true);
  });

  it("excludes open questions and quality findings", () => {
    expect(isReviewableItemType("open_question")).toBe(false);
    expect(isReviewableItemType("quality_finding")).toBe(false);
    expect(REVIEWABLE_ITEM_TYPES).not.toContain("open_question");
    expect(REVIEWABLE_ITEM_TYPES).not.toContain("quality_finding");
  });

  it("names the workflow each deferred type is waiting for", () => {
    expect(DEFERRED_WORKFLOW_LABEL.open_question).toBe("Question workflow coming next");
    expect(DEFERRED_WORKFLOW_LABEL.quality_finding).toBe("Quality review workflow coming next");
  });
});

describe("form readers", () => {
  it("reads only the fields the edit form owns", () => {
    const form = new FormData();
    form.set("title", "A");
    form.set("description", "B");
    form.set("priority", "low");
    form.set("expectedVersion", "2");
    form.set("changeReason", "");
    form.set("status", "approved");
    form.set("itemId", "not-this-one");

    const read = readItemEditForm(form) as Record<string, unknown>;
    expect(Object.keys(read).sort()).toEqual([
      "changeReason",
      "description",
      "expectedVersion",
      "priority",
      "title",
    ]);
    // The injected status never even reaches the schema.
    expect(itemEditSchema.safeParse(read).success).toBe(true);
  });

  it("reads only the fields the review form owns", () => {
    const form = new FormData();
    form.set("toStatus", "approved");
    form.set("expectedStatus", "reviewed");
    form.set("note", "");
    form.set("actorId", "someone-else");

    const read = readReviewActionForm(form) as Record<string, unknown>;
    expect(Object.keys(read).sort()).toEqual(["expectedStatus", "note", "toStatus"]);
    expect(reviewActionSchema.safeParse(read).success).toBe(true);
  });
});
