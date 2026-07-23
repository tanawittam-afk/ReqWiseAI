import { describe, expect, it } from "vitest";
import { createMockProvider } from "../../lib/providers/mock/mock-provider";
import { runAnalysis } from "../../lib/analysis/run-analysis";
import { bookingInput, testPorts } from "../helpers";

describe("mock provider — determinism", () => {
  it("returns byte-identical raw output for the same input", async () => {
    const provider = createMockProvider();
    const a = await provider.generate(bookingInput());
    const b = await provider.generate(bookingInput());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("declares itself deterministic", () => {
    expect(createMockProvider().deterministic).toBe(true);
  });

  it("returns a fresh copy each call (a caller cannot mutate the shared fixture)", async () => {
    const provider = createMockProvider();
    const a = (await provider.generate(bookingInput())) as { items: unknown[] };
    a.items.pop();
    const b = (await provider.generate(bookingInput())) as { items: unknown[] };
    expect(b.items.length).toBeGreaterThan(a.items.length);
  });
});

describe("mock provider — through the real validation + normalization path", () => {
  it("produces a valid, normalized analysis with no fast path", async () => {
    const provider = createMockProvider();
    const input = bookingInput();
    const result = await runAnalysis(provider, input, testPorts());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.analysis.items).toHaveLength(15); // 14 types, open_question twice

    expect(result.analysis.items.every((i) => i.status === "draft")).toBe(true);
  });

  it("is deterministic end to end", async () => {
    const provider = createMockProvider();
    const a = await runAnalysis(provider, bookingInput(), testPorts());
    const b = await runAnalysis(provider, bookingInput(), testPorts());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
