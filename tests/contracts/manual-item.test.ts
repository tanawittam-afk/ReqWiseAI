/**
 * The manual "add requirement" contract (Phase 2, Slice 4/5).
 *
 * Same discipline as `review-input.test.ts`: the interesting assertions are the
 * refusals — `status`, `origin` and `analysisRunId` are all absent from this schema on
 * purpose, so a client sending them gets a parse error, not a silent drop.
 */

import { describe, expect, it } from "vitest";
import {
  addManualRequirementSchema,
  manualRequirementFieldErrors,
  readAddManualRequirementForm,
} from "../../lib/contracts/manual-item";

const valid = {
  itemType: "functional_requirement",
  title: "The system must show live availability",
  description: "Availability must reflect confirmed reservations in real time.",
  priority: "high",
  evidenceClass: "stated",
  sourceId: "",
  excerpt: "",
};

describe("addManualRequirementSchema", () => {
  it("accepts a plain requirement with no citation", () => {
    const parsed = addManualRequirementSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.sourceId).toBeNull();
      expect(parsed.data.excerpt).toBeNull();
    }
  });

  it("accepts a requirement citing a source and an excerpt together", () => {
    const parsed = addManualRequirementSchema.safeParse({
      ...valid,
      sourceId: "source-1",
      excerpt: "the exact quoted text",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a source with no excerpt", () => {
    const parsed = addManualRequirementSchema.safeParse({ ...valid, sourceId: "source-1", excerpt: "" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an excerpt with no source", () => {
    const parsed = addManualRequirementSchema.safeParse({ ...valid, sourceId: "", excerpt: "quoted text" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an assumed item that cites a source excerpt", () => {
    const parsed = addManualRequirementSchema.safeParse({
      ...valid,
      evidenceClass: "assumed",
      sourceId: "source-1",
      excerpt: "quoted text",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects open_question and quality_finding — they have their own doors", () => {
    expect(addManualRequirementSchema.safeParse({ ...valid, itemType: "open_question" }).success).toBe(false);
    expect(addManualRequirementSchema.safeParse({ ...valid, itemType: "quality_finding" }).success).toBe(false);
  });

  it("rejects an unknown field (strict object)", () => {
    const parsed = addManualRequirementSchema.safeParse({ ...valid, status: "approved" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty title and an empty description", () => {
    expect(addManualRequirementSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
    expect(addManualRequirementSchema.safeParse({ ...valid, description: "" }).success).toBe(false);
  });

  it("trims title, description and excerpt rather than storing the padding", () => {
    const parsed = addManualRequirementSchema.parse({
      ...valid,
      title: "  A requirement  ",
      description: "  Its meaning  ",
      sourceId: "source-1",
      excerpt: "  quoted  ",
    });
    expect(parsed.title).toBe("A requirement");
    expect(parsed.description).toBe("Its meaning");
    expect(parsed.excerpt).toBe("quoted");
  });
});

describe("readAddManualRequirementForm", () => {
  it("reads only the six form fields, ignoring an injected status", () => {
    const formData = new FormData();
    formData.set("itemType", "risk");
    formData.set("title", "t");
    formData.set("description", "d");
    formData.set("priority", "low");
    formData.set("evidenceClass", "inferred");
    formData.set("sourceId", "source-1");
    formData.set("excerpt", "quoted");
    formData.set("status", "approved");

    const result = readAddManualRequirementForm(formData);
    expect(result).toEqual({
      itemType: "risk",
      title: "t",
      description: "d",
      priority: "low",
      evidenceClass: "inferred",
      sourceId: "source-1",
      excerpt: "quoted",
    });
  });
});

describe("manualRequirementFieldErrors", () => {
  it("keys each issue by its field path", () => {
    const parsed = addManualRequirementSchema.safeParse({ ...valid, title: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(manualRequirementFieldErrors(parsed.error)).toHaveProperty("title");
    }
  });
});
