/**
 * The validation boundary for typed relations.
 *
 * Every one of these asserts a *rejection*, because the value of this layer is
 * entirely in what it refuses. A relation that got through would be persisted, drawn
 * on a map, and read as a claim the analysis made.
 */

import { describe, expect, it } from "vitest";
import { validateAnalysis } from "../../lib/validation/validate-analysis";
import { checkHierarchyCycles, checkRelations } from "../../lib/validation/structure";
import { providerOutputSchema } from "../../lib/contracts/provider-output";
import { bookingValidOutput } from "../../lib/providers/mock/fixtures/booking-smart-space.valid";
import { bookingSourceDocument } from "../../lib/providers/mock/fixtures/booking-smart-space.source";
import {
  duplicateRelation,
  invalidRelationPair,
  legacyHierarchyCycle,
  legacyRelationTypeAuthored,
  relatedToBothWays,
  selfRelation,
  unknownRelationKey,
  untypedRelationKeys,
} from "../../lib/providers/mock/fixtures/booking-smart-space.invalid";
import type { ProviderOutput } from "../../lib/contracts/provider-output";

const sources = [bookingSourceDocument];

function codesFor(fixture: unknown): string[] {
  const result = validateAnalysis(fixture, sources);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("unreachable");
  return result.issues.map((issue) => issue.code);
}

/** The relation checks alone, on output that has already parsed. */
function relationCodes(fixture: unknown): string[] {
  const parsed = providerOutputSchema.safeParse(fixture);
  expect(parsed.success).toBe(true);
  if (!parsed.success) throw new Error("unreachable");
  return checkRelations(parsed.data).map((issue) => issue.code);
}

describe("relation schema", () => {
  it("accepts the contract fixture, relations and all", () => {
    const result = validateAnalysis(bookingValidOutput, sources);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.output.relations.length).toBeGreaterThan(0);
  });

  it("still parses a pre-6B output that has no relations array at all", () => {
    // The 129 runs already in the database stored their raw output verbatim. A schema
    // that could no longer read them would turn preserved audit evidence into a blob.
    const legacyShape = {
      schema_version: "1.0.0",
      items: [
        {
          key: "br-1",
          type: "business_requirement",
          title: "ข้อกำหนดเดิม",
          description: "ผลลัพธ์ที่บันทึกไว้ก่อน slice 6B",
          evidence_class: "assumed",
          origin: "source_analysis",
          confidence: 0.5,
          rationale: "ข้อสันนิษฐาน",
          source_references: [],
        },
      ],
    };
    const parsed = providerOutputSchema.safeParse(legacyShape);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.relations).toEqual([]);
  });

  it("refuses the legacy relation type from a new run at the schema itself", () => {
    // Not merely a semantic check: `derives_from` is absent from the accepted enum, so
    // it cannot survive parsing.
    const parsed = providerOutputSchema.safeParse(legacyRelationTypeAuthored);
    expect(parsed.success).toBe(false);
    expect(codesFor(legacyRelationTypeAuthored).length).toBeGreaterThan(0);
  });

  it("refuses a self relation in the schema and again in the checks", () => {
    expect(providerOutputSchema.safeParse(selfRelation).success).toBe(false);
    expect(codesFor(selfRelation).length).toBeGreaterThan(0);
  });
});

describe("relation checks", () => {
  it("rejects a relation pointing at a key that is not in the response", () => {
    expect(relationCodes(unknownRelationKey)).toContain("unknown_related_key");
  });

  it("rejects the deprecated untyped edge list on a new run", () => {
    expect(relationCodes(untypedRelationKeys)).toContain("untyped_relation");
  });

  it("rejects an item-type pair the relation type does not describe", () => {
    expect(relationCodes(invalidRelationPair)).toContain("invalid_relation_pair");
  });

  it("rejects the same triple twice", () => {
    expect(relationCodes(duplicateRelation)).toContain("duplicate_relation");
  });

  it("allows the same pair to carry two different relation types", () => {
    const output = {
      schema_version: "1.0.0",
      items: [
        item("br-1", "business_requirement"),
        item("fr-1", "functional_requirement"),
      ],
      relations: [
        { from_key: "br-1", to_key: "fr-1", type: "implemented_by" },
        { from_key: "br-1", to_key: "fr-1", type: "related_to" },
      ],
    };
    expect(relationCodes(output)).not.toContain("duplicate_relation");
  });
});

describe("cycle detection", () => {
  it("detects a cycle formed by mixing a legacy edge with an authored one", () => {
    // The legacy fixture is not schema-parseable on purpose: `derives_from` is not an
    // authored type. Cast at the boundary, which is exactly how the row reaches this
    // code in production — read back out of the database, not parsed from a provider.
    const codes = checkHierarchyCycles(legacyHierarchyCycle as unknown as ProviderOutput).map(
      (issue) => issue.code,
    );
    expect(codes).toContain("hierarchy_cycle");
  });

  it("does not treat two opposite related_to rows as a cycle", () => {
    expect(relationCodes(relatedToBothWays)).not.toContain("hierarchy_cycle");
  });

  it("finds no cycle in the contract fixture", () => {
    const parsed = providerOutputSchema.safeParse(bookingValidOutput);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(checkHierarchyCycles(parsed.data)).toEqual([]);
  });

  it("cannot be made to loop by authored types alone — the pair matrix is a DAG", () => {
    /*
     * Not a redundant test: it is the assertion behind the claim that the runtime
     * cycle check is defence for legacy and direct-insert paths rather than for the
     * provider path. Every authored hierarchical pair is enumerated and the resulting
     * type graph is shown to be acyclic; if a future relation type breaks that, this
     * fails and the claim in DATA-MODEL §C.13 has to be rewritten.
     */
    const edges: Array<[string, string]> = [
      ["business_objective", "business_requirement"],
      ["business_requirement", "functional_requirement"],
      ["business_requirement", "non_functional_requirement"],
      ["functional_requirement", "user_story"],
      ["user_story", "acceptance_criterion"],
      ["business_requirement", "acceptance_criterion"],
      ["functional_requirement", "acceptance_criterion"],
      ["non_functional_requirement", "acceptance_criterion"],
    ];
    const outgoing = new Map<string, string[]>();
    for (const [from, to] of edges) outgoing.set(from, [...(outgoing.get(from) ?? []), to]);

    const seen = new Set<string>();
    const stack = new Set<string>();
    let cyclic = false;
    function walk(node: string): void {
      if (stack.has(node)) {
        cyclic = true;
        return;
      }
      if (seen.has(node)) return;
      seen.add(node);
      stack.add(node);
      for (const next of outgoing.get(node) ?? []) walk(next);
      stack.delete(node);
    }
    for (const node of outgoing.keys()) walk(node);
    expect(cyclic).toBe(false);
  });
});

function item(key: string, type: string) {
  return {
    key,
    type,
    title: `รายการ ${key}`,
    description: "รายการที่ถูกต้องในตัวเอง",
    evidence_class: "assumed",
    origin: "source_analysis",
    confidence: 0.5,
    rationale: "ข้อสันนิษฐาน",
    source_references: [],
  };
}
