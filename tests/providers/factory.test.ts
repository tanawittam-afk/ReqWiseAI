import { describe, expect, it, vi } from "vitest";
import type { ServerEnvironment } from "../../lib/config/env";
import { ProviderExecutionError } from "../../lib/providers/errors";
import { createProvider, providerSelectionSchema } from "../../lib/providers/factory";
import { bookingValidOutput } from "../../lib/providers/mock/fixtures/booking-smart-space.valid";
import { bookingInput } from "../helpers";

const noGeminiEnv: ServerEnvironment = {
  supabaseUrl: "https://project.supabase.co",
  supabaseAnonKey: "anon",
  applicationUrl: "http://localhost:3000",
  runtimeEnvironment: "test",
  defaultProvider: "mock",
  gemini: { available: false, apiKey: null, models: [] },
};

const geminiEnv: ServerEnvironment = {
  ...noGeminiEnv,
  gemini: {
    available: true,
    apiKey: "server-key",
    models: ["configured-model-a", "configured-model-b"],
  },
};

describe("provider factory", () => {
  it("creates mock without Gemini configuration", () => {
    expect(createProvider("mock", noGeminiEnv).name).toBe("mock");
  });

  it("refuses unavailable Gemini without leaking server configuration", () => {
    let error: unknown;
    try {
      createProvider("gemini", noGeminiEnv);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ProviderExecutionError);
    expect(error).toMatchObject({
      category: "unavailable",
      message: "This analysis provider is not configured.",
      metadata: { provider: "gemini", model: null, promptVersion: null },
    });
    expect(JSON.stringify(error)).not.toMatch(/server-key|configured-model/i);
  });

  it("creates Gemini with the ordered primary model and supplied fetch transport", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        void input;
        void init;
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(bookingValidOutput) }] } }],
          }),
          { status: 200 },
        );
      },
    );
    const provider = createProvider("gemini", geminiEnv, fetchImpl as typeof fetch);

    const generation = await provider.generate(bookingInput());

    expect(provider.name).toBe("gemini");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain(
      "/v1beta/models/configured-model-a:generateContent",
    );
    expect(generation.raw).toMatchObject({ schema_version: "1.0.0" });
    expect(generation.metadata).toEqual({
      provider: "gemini",
      model: "configured-model-a",
      promptVersion: "reqwise-gemini/1.0",
    });
  });

  it("rejects every unknown selection", () => {
    expect(providerSelectionSchema.safeParse("other").success).toBe(false);
  });
});
