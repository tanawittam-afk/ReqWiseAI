import { describe, expect, it } from "vitest";
import {
  PROVIDER_SCHEMA_VERSION,
  providerOutputSchema,
} from "../../lib/contracts/provider-output";
import { bookingValidOutput } from "../../lib/providers/mock/fixtures/booking-smart-space.valid";
import {
  providerSuppliedDisplayId,
  providerSuppliedStatus,
  unknownField,
  unknownItemType,
} from "../../lib/providers/mock/fixtures/booking-smart-space.invalid";

describe("provider output schema", () => {
  it("accepts the valid Booking and Smart Space fixture", () => {
    const result = providerOutputSchema.safeParse(bookingValidOutput);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown field (strict object)", () => {
    const result = providerOutputSchema.safeParse(unknownField);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
  });

  it("rejects a provider-supplied status", () => {
    const result = providerOutputSchema.safeParse(providerSuppliedStatus);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
  });

  it("rejects a provider-supplied display id", () => {
    const result = providerOutputSchema.safeParse(providerSuppliedDisplayId);
    expect(result.success).toBe(false);
  });

  it("rejects an unknown item type", () => {
    const result = providerOutputSchema.safeParse(unknownItemType);
    expect(result.success).toBe(false);
  });

  it("rejects an empty items array", () => {
    const result = providerOutputSchema.safeParse({
      schema_version: PROVIDER_SCHEMA_VERSION,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a provider claiming origin 'manual' (Phase 2, Slice 4 — that value is reserved for add_manual_requirement())", () => {
    const result = providerOutputSchema.safeParse({
      schema_version: PROVIDER_SCHEMA_VERSION,
      items: [
        {
          key: "br-1",
          type: "business_requirement",
          title: "t",
          description: "d",
          evidence_class: "stated",
          origin: "manual",
          confidence: 0.5,
          source_references: [],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects attributes on an item type that does not allow them", () => {
    const result = providerOutputSchema.safeParse({
      schema_version: PROVIDER_SCHEMA_VERSION,
      items: [
        {
          key: "br-1",
          type: "business_requirement",
          title: "t",
          description: "d",
          evidence_class: "assumed",
          origin: "source_analysis",
          confidence: 0.5,
          rationale: "r",
          source_references: [],
          attributes: { foo: "bar" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
