import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "../../lib/normalization/normalize";
import { validateAnalysis } from "../../lib/validation/validate-analysis";
import { bookingValidOutput } from "../../lib/providers/mock/fixtures/booking-smart-space.valid";
import { bookingSourceDocument } from "../../lib/providers/mock/fixtures/booking-smart-space.source";
import { FIXED_TIME, testPorts } from "../helpers";

const sources = [bookingSourceDocument];

function normalizeValid() {
  const validated = validateAnalysis(bookingValidOutput, sources);
  if (!validated.ok) throw new Error("fixture should be valid");
  return normalizeAnalysis(validated.value, sources, testPorts());
}

describe("normalization", () => {
  it("assigns draft status to every item — a provider cannot set status", () => {
    const analysis = normalizeValid();
    expect(analysis.items.every((i) => i.status === "draft")).toBe(true);
  });

  it("assigns initial version 1 to every item", () => {
    const analysis = normalizeValid();
    expect(analysis.items.every((i) => i.versionNo === 1)).toBe(true);
  });

  it("allocates display ids by type prefix, sequentially and padded", () => {
    const analysis = normalizeValid();
    const br = analysis.items.find((i) => i.type === "business_requirement");
    const fr = analysis.items.find((i) => i.type === "functional_requirement");
    expect(br?.displayId).toBe("BR-001");
    expect(fr?.displayId).toBe("FR-001");
    // Two open questions in the fixture → sequential numbering within the type.
    const questions = analysis.items.filter((i) => i.type === "open_question").map((i) => i.displayId);
    expect(questions).toEqual(["Q-001", "Q-002"]);
  });

  it("uses the injected clock, not wall-clock time", () => {
    const analysis = normalizeValid();
    expect(analysis.items.every((i) => i.createdAt === FIXED_TIME && i.updatedAt === FIXED_TIME)).toBe(
      true,
    );
  });

  it("resolves both endpoints of every typed relation to ids in the output", () => {
    const analysis = normalizeValid();
    const allIds = new Set(analysis.items.map((i) => i.id));
    expect(analysis.relations.length).toBeGreaterThan(0);
    expect(
      analysis.relations.every((r) => allIds.has(r.fromItemId) && allIds.has(r.toItemId)),
    ).toBe(true);
  });

  it("keeps the authored direction — the BR is implemented_by the FR, not the reverse", () => {
    const analysis = normalizeValid();
    const br = analysis.items.find((i) => i.type === "business_requirement");
    const fr = analysis.items.find((i) => i.type === "functional_requirement");
    const edge = analysis.relations.find(
      (r) => r.type === "implemented_by" && r.toItemId === fr?.id,
    );
    expect(edge?.fromItemId).toBe(br?.id);
  });

  it("resolves source references to source document ids and carries offsetVerified", () => {
    const analysis = normalizeValid();
    const ps = analysis.items.find((i) => i.type === "problem_statement");
    expect(ps?.sourceReferences[0]?.sourceDocumentId).toBe(bookingSourceDocument.id);
    expect(ps?.sourceReferences[0]?.offsetVerified).toBe(true);
  });

  it("defaults missing priority to unassigned but keeps a provided one", () => {
    const analysis = normalizeValid();
    const ps = analysis.items.find((i) => i.type === "problem_statement");
    const br = analysis.items.find((i) => i.type === "business_requirement");
    expect(ps?.priority).toBe("unassigned"); // fixture omits it
    expect(br?.priority).toBe("high"); // fixture sets it
  });

  it("computes the summary", () => {
    const analysis = normalizeValid();
    // 14 types, one of which (open_question) appears twice → 15 items.
    expect(analysis.summary.itemCount).toBe(15);
    expect(analysis.summary.unresolvedQuestionCount).toBe(2);
    expect(analysis.summary.lowConfidenceCount).toBeGreaterThan(0);
  });

  it("is deterministic — same input, identical normalized output", () => {
    const a = normalizeValid();
    const b = normalizeValid();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
