import { describe, expect, it } from "vitest";
import { checkEvidence } from "../../lib/validation/evidence";
import type { ProviderOutput } from "../../lib/contracts/provider-output";

/** Build a single-item output around evidence-relevant fields. */
function output(item: Record<string, unknown>): ProviderOutput {
  return {
    schema_version: "1.0.0",
    items: [
      {
        key: "x-1",
        type: "business_requirement",
        title: "t",
        description: "d",
        confidence: 0.5,
        source_references: [],
        related_item_keys: [],
        ...item,
      },
    ],
  } as unknown as ProviderOutput;
}

const oneRef = [
  { source_document_key: "s", excerpt: "e" }, // shape only; evidence checks don't read text
];

describe("evidence rules — stated", () => {
  it("requires at least one source reference", () => {
    const issues = checkEvidence(output({ evidence_class: "stated", origin: "source_analysis" }));
    expect(issues.some((i) => i.code === "stated_without_source")).toBe(true);
  });

  it("passes with a reference and no rationale", () => {
    const issues = checkEvidence(
      output({ evidence_class: "stated", origin: "source_analysis", source_references: oneRef }),
    );
    expect(issues).toHaveLength(0);
  });
});

describe("evidence rules — inferred", () => {
  it("requires a reference and a rationale", () => {
    const issues = checkEvidence(
      output({ evidence_class: "inferred", origin: "source_analysis", source_references: oneRef }),
    );
    expect(issues.some((i) => i.code === "inferred_without_rationale")).toBe(true);
  });

  it("rejects an empty (whitespace) rationale", () => {
    const issues = checkEvidence(
      output({
        evidence_class: "inferred",
        origin: "source_analysis",
        source_references: oneRef,
        rationale: "   ",
      }),
    );
    expect(issues.some((i) => i.code === "inferred_without_rationale")).toBe(true);
  });

  it("passes with both", () => {
    const issues = checkEvidence(
      output({
        evidence_class: "inferred",
        origin: "source_analysis",
        source_references: oneRef,
        rationale: "because",
      }),
    );
    expect(issues).toHaveLength(0);
  });
});

describe("evidence rules — assumed", () => {
  it("must not carry a source reference — the core failure mode", () => {
    const issues = checkEvidence(
      output({
        evidence_class: "assumed",
        origin: "source_analysis",
        source_references: oneRef,
        rationale: "guess",
      }),
    );
    expect(issues.some((i) => i.code === "assumed_with_source")).toBe(true);
  });

  it("requires a rationale", () => {
    const issues = checkEvidence(output({ evidence_class: "assumed", origin: "source_analysis" }));
    expect(issues.some((i) => i.code === "assumed_without_rationale")).toBe(true);
  });

  it("passes with a rationale and no references", () => {
    const issues = checkEvidence(
      output({ evidence_class: "assumed", origin: "source_analysis", rationale: "guess" }),
    );
    expect(issues).toHaveLength(0);
  });
});

describe("origin rules", () => {
  it("a domain_profile item may not be stated", () => {
    const issues = checkEvidence(
      output({ evidence_class: "stated", origin: "domain_profile", source_references: oneRef }),
    );
    expect(issues.some((i) => i.code === "domain_profile_cannot_state_fact")).toBe(true);
  });

  it("a quality_rule item must be quality_finding or open_question", () => {
    const issues = checkEvidence(
      output({
        type: "functional_requirement",
        evidence_class: "assumed",
        origin: "quality_rule",
        rationale: "r",
      }),
    );
    expect(issues.some((i) => i.code === "quality_rule_invalid_type")).toBe(true);
  });

  it("allows an open_question raised from ambiguity to carry a source reference", () => {
    // Regression guard for the explicit spec rule: not every open question is unsourced.
    const issues = checkEvidence(
      output({
        type: "open_question",
        evidence_class: "stated",
        origin: "source_analysis",
        source_references: oneRef,
        attributes: { category: "c", blocks_keys: [] },
      }),
    );
    expect(issues).toHaveLength(0);
  });
});
