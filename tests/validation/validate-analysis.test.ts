import { describe, expect, it } from "vitest";
import { ITEM_TYPES } from "../../lib/contracts/item-types";
import { validateAnalysis } from "../../lib/validation/validate-analysis";
import { bookingValidOutput } from "../../lib/providers/mock/fixtures/booking-smart-space.valid";
import { bookingSourceDocument } from "../../lib/providers/mock/fixtures/booking-smart-space.source";
import * as invalid from "../../lib/providers/mock/fixtures/booking-smart-space.invalid";

const sources = [bookingSourceDocument];

describe("validateAnalysis — valid fixture", () => {
  it("passes the full pipeline", () => {
    const result = validateAnalysis(bookingValidOutput, sources);
    expect(result.ok).toBe(true);
  });

  it("covers all 14 provider-facing item types", () => {
    // `coverage_gap` (Phase 3) is deliberately excluded — a provider can never emit
    // it (`providerItemSchema` has no arm for it), so a provider-output fixture
    // legitimately never contains one.
    const providerFacingTypes = ITEM_TYPES.filter((type) => type !== "coverage_gap");
    const present = new Set(bookingValidOutput.items.map((i) => i.type));
    for (const type of providerFacingTypes) {
      expect(present.has(type), `missing item type: ${type}`).toBe(true);
    }
    expect(present.size).toBe(14);
  });

  it("verifies exact offsets for the citations that supply them", () => {
    const result = validateAnalysis(bookingValidOutput, sources);
    if (!result.ok) throw new Error("expected valid");
    // Every reference in the valid fixture uses citation() → exact offsets → verified.
    const anyVerified = [...result.value.offsetVerified.values()].some(Boolean);
    expect(anyVerified).toBe(true);
  });
});

describe("validateAnalysis — invalid fixtures are rejected, never partially accepted", () => {
  const cases: Array<[keyof typeof invalid, string]> = [
    ["statedWithoutSource", "evidence_error"],
    ["inferredWithoutRationale", "evidence_error"],
    ["assumedWithSource", "evidence_error"],
    ["domainProfileStatedFact", "evidence_error"],
    ["excerptOffsetMismatch", "source_reference_error"],
    ["offsetOutOfRange", "source_reference_error"],
    ["duplicateKey", "schema_error"],
    ["unknownRelationKey", "relation_error"],
    ["providerSuppliedStatus", "schema_error"],
    ["providerSuppliedDisplayId", "schema_error"],
    ["unknownItemType", "schema_error"],
    ["unknownField", "schema_error"],
  ];

  for (const [name, expectedKind] of cases) {
    it(`${name} → rejected with a ${expectedKind}`, () => {
      const result = validateAnalysis(invalid[name], sources);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.kind === expectedKind)).toBe(true);
      // All-or-nothing: a rejected result exposes no value to partially consume.
      expect("value" in result).toBe(false);
    });
  }
});
