import { describe, expect, it } from "vitest";
import { gapFilterOutputSchema } from "../../lib/contracts/gap-filter-output";

describe("gapFilterOutputSchema", () => {
  it("accepts a well-formed mix of gap and non-gap results", () => {
    const result = gapFilterOutputSchema.safeParse({
      results: [
        { key: "gap-0", is_gap: true, title: "A gap", description: "A real gap description." },
        { key: "gap-1", is_gap: false },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a gap (is_gap: true) missing title or description", () => {
    const missingBoth = gapFilterOutputSchema.safeParse({
      results: [{ key: "gap-0", is_gap: true }],
    });
    expect(missingBoth.success).toBe(false);

    const missingDescription = gapFilterOutputSchema.safeParse({
      results: [{ key: "gap-0", is_gap: true, title: "A title" }],
    });
    expect(missingDescription.success).toBe(false);
  });

  it("accepts a non-gap result carrying no title or description", () => {
    const result = gapFilterOutputSchema.safeParse({
      results: [{ key: "gap-0", is_gap: false }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown field (strict object)", () => {
    const result = gapFilterOutputSchema.safeParse({
      results: [{ key: "gap-0", is_gap: false, extra: "not allowed" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty key", () => {
    const result = gapFilterOutputSchema.safeParse({
      results: [{ key: "", is_gap: false }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing results field entirely (strict object)", () => {
    const result = gapFilterOutputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
