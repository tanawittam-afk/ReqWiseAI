import { describe, expect, it } from "vitest";
import { createGeminiProvider } from "../../lib/providers/gemini/provider";
import { bookingValidOutput } from "../../lib/providers/mock/fixtures/booking-smart-space.valid";
import { bookingInput } from "../helpers";

const responseFor = (text: string): typeof fetch =>
  (async () =>
    new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
      { status: 200 },
    )) as typeof fetch;

describe("Gemini provider", () => {
  it("returns parsed candidate data with Gemini metadata", async () => {
    const provider = createGeminiProvider({
      apiKey: "server-key",
      models: ["configured-model-a"],
      timeoutMs: 1_000,
      fetchImpl: responseFor(JSON.stringify(bookingValidOutput)),
    });

    const generation = await provider.generate(bookingInput());

    expect(generation.raw).toMatchObject({ schema_version: "1.0.0" });
    expect(generation.metadata).toEqual({
      provider: "gemini",
      model: "configured-model-a",
      promptVersion: "reqwise-gemini/1.0",
    });
  });

  it("returns malformed candidate text unchanged for validation to reject", async () => {
    const provider = createGeminiProvider({
      apiKey: "server-key",
      models: ["configured-model-a"],
      timeoutMs: 1_000,
      fetchImpl: responseFor("not-json"),
    });

    const generation = await provider.generate(bookingInput());

    expect(generation.raw).toBe("not-json");
  });
});
