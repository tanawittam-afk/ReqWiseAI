/**
 * The typed relation contract itself: the vocabulary, the direction, the pair matrix,
 * and the labels.
 *
 * These are the tests that would catch the whole slice being subtly wrong — a label
 * that reads one way while the matrix stores the other, or a pair rule that quietly
 * admits everything.
 */

import { describe, expect, it } from "vitest";
import {
  ALLOWED_RELATION_PAIRS,
  AUTHORED_RELATION_TYPES,
  HIERARCHICAL_RELATION_TYPES,
  LEGACY_RELATION_TYPES,
  RELATION_INVERSE_LABEL_EN,
  RELATION_INVERSE_LABEL_TH,
  RELATION_LABEL_EN,
  RELATION_LABEL_TH,
  RELATION_TYPES,
  SPINE_STEP,
  TRACEABILITY_SPINE,
  canonicalHierarchyEdge,
  isAllowedRelationPair,
  isAuthoredRelationType,
  isHierarchicalRelationType,
  isLegacyRelationType,
  isRelationType,
  type RelationType,
} from "../../lib/contracts/relations";
import { ITEM_TYPES, type ItemType } from "../../lib/contracts/item-types";

describe("relation vocabulary", () => {
  it("splits every type into exactly one of authored or legacy", () => {
    const combined = [...AUTHORED_RELATION_TYPES, ...LEGACY_RELATION_TYPES].sort();
    expect(combined).toEqual([...RELATION_TYPES].sort());
    for (const type of AUTHORED_RELATION_TYPES) expect(isLegacyRelationType(type)).toBe(false);
    for (const type of LEGACY_RELATION_TYPES) expect(isAuthoredRelationType(type)).toBe(false);
  });

  it("treats derives_from as legacy and refuses it as an authored type", () => {
    expect(isLegacyRelationType("derives_from")).toBe(true);
    expect(isAuthoredRelationType("derives_from")).toBe(false);
    expect(isRelationType("derives_from")).toBe(true);
  });

  it("rejects a type that is not in the vocabulary", () => {
    expect(isRelationType("refines")).toBe(false);
    expect(isRelationType("totally_made_up")).toBe(false);
  });

  it("labels every type in both directions and both languages", () => {
    for (const type of RELATION_TYPES) {
      for (const map of [
        RELATION_LABEL_EN,
        RELATION_LABEL_TH,
        RELATION_INVERSE_LABEL_EN,
        RELATION_INVERSE_LABEL_TH,
      ]) {
        expect(map[type]?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("gives the forward and inverse label different words, except for the symmetric type", () => {
    for (const type of RELATION_TYPES) {
      if (type === "related_to") {
        // Genuinely symmetric: "is related to" reads correctly from either end.
        expect(RELATION_LABEL_EN[type]).toBe(RELATION_INVERSE_LABEL_EN[type]);
        continue;
      }
      expect(RELATION_LABEL_EN[type]).not.toBe(RELATION_INVERSE_LABEL_EN[type]);
    }
  });
});

describe("hierarchy direction", () => {
  it("marks exactly the spine types as hierarchical", () => {
    expect([...HIERARCHICAL_RELATION_TYPES].sort()).toEqual(
      ["derives_from", "expressed_as", "implemented_by", "supports", "validated_by"].sort(),
    );
  });

  it("does not treat related_to or the observation types as hierarchical", () => {
    for (const type of [
      "related_to",
      "raises_question",
      "flags_quality_issue",
      "constrained_by",
      "mitigates",
    ]) {
      expect(isHierarchicalRelationType(type)).toBe(false);
    }
  });

  it("reads an authored spine edge as parent → child, unchanged", () => {
    expect(canonicalHierarchyEdge("implemented_by", "br", "fr")).toEqual(["br", "fr"]);
    expect(canonicalHierarchyEdge("supports", "obj", "br")).toEqual(["obj", "br"]);
  });

  it("flips a legacy derives_from, which was written child → parent", () => {
    expect(canonicalHierarchyEdge("derives_from", "fr", "br")).toEqual(["br", "fr"]);
  });

  it("returns null for a non-hierarchical type rather than guessing a direction", () => {
    expect(canonicalHierarchyEdge("related_to", "a", "b")).toBeNull();
    expect(canonicalHierarchyEdge("raises_question", "q", "br")).toBeNull();
  });

  it("keeps every spine step consistent with the spine order", () => {
    SPINE_STEP.forEach((step, index) => {
      expect(TRACEABILITY_SPINE[index]).toBe(step.from);
      expect(TRACEABILITY_SPINE[index + 1]).toBe(step.to);
      expect(isHierarchicalRelationType(step.type)).toBe(true);
    });
  });
});

describe("allowed pair matrix", () => {
  it("accepts each canonical spine step", () => {
    for (const step of SPINE_STEP) {
      expect(isAllowedRelationPair(step.type, step.from, step.to)).toBe(true);
    }
  });

  it("refuses every spine step written backwards", () => {
    for (const step of SPINE_STEP) {
      expect(isAllowedRelationPair(step.type, step.to, step.from)).toBe(false);
    }
  });

  it("refuses a spine edge between two items of the same type", () => {
    expect(isAllowedRelationPair("implemented_by", "business_requirement", "business_requirement")).toBe(
      false,
    );
    expect(isAllowedRelationPair("supports", "business_objective", "business_objective")).toBe(false);
  });

  it("lets a non-functional requirement implement a business requirement", () => {
    expect(
      isAllowedRelationPair("implemented_by", "business_requirement", "non_functional_requirement"),
    ).toBe(true);
  });

  it("allows validated_by from a requirement as well as from a story", () => {
    for (const from of [
      "user_story",
      "business_requirement",
      "functional_requirement",
      "non_functional_requirement",
    ] as ItemType[]) {
      expect(isAllowedRelationPair("validated_by", from, "acceptance_criterion")).toBe(true);
    }
    expect(isAllowedRelationPair("validated_by", "risk", "acceptance_criterion")).toBe(false);
  });

  it("constrains only requirements, and only by a constraint or a business rule", () => {
    expect(isAllowedRelationPair("constrained_by", "functional_requirement", "constraint")).toBe(true);
    expect(isAllowedRelationPair("constrained_by", "functional_requirement", "business_rule")).toBe(true);
    expect(isAllowedRelationPair("constrained_by", "functional_requirement", "risk")).toBe(false);
    expect(isAllowedRelationPair("constrained_by", "risk", "constraint")).toBe(false);
  });

  it("puts the question on the from side and never on the to side", () => {
    expect(isAllowedRelationPair("raises_question", "open_question", "business_requirement")).toBe(true);
    expect(isAllowedRelationPair("raises_question", "business_requirement", "open_question")).toBe(false);
    expect(isAllowedRelationPair("raises_question", "open_question", "open_question")).toBe(false);
  });

  it("puts the finding on the from side and never on the to side", () => {
    expect(isAllowedRelationPair("flags_quality_issue", "quality_finding", "user_story")).toBe(true);
    expect(isAllowedRelationPair("flags_quality_issue", "user_story", "quality_finding")).toBe(false);
    expect(isAllowedRelationPair("flags_quality_issue", "quality_finding", "quality_finding")).toBe(
      false,
    );
  });

  it("points mitigates at the risk, from the thing doing the mitigating", () => {
    expect(isAllowedRelationPair("mitigates", "business_rule", "risk")).toBe(true);
    expect(isAllowedRelationPair("mitigates", "functional_requirement", "risk")).toBe(true);
    expect(isAllowedRelationPair("mitigates", "risk", "business_rule")).toBe(false);
  });

  it("lets related_to join any two types — it is the deliberate fallback", () => {
    for (const from of ITEM_TYPES) {
      for (const to of ITEM_TYPES) {
        expect(isAllowedRelationPair("related_to", from, to)).toBe(true);
      }
    }
  });

  it("applies no pair rule to the legacy type, because it cannot be re-derived", () => {
    expect(ALLOWED_RELATION_PAIRS.derives_from).toBe("any");
    expect(isAllowedRelationPair("derives_from", "acceptance_criterion", "business_objective")).toBe(
      true,
    );
  });

  it("defines a rule for every relation type — no type falls through undefined", () => {
    for (const type of RELATION_TYPES) {
      expect(ALLOWED_RELATION_PAIRS[type as RelationType]).toBeDefined();
    }
  });
});
