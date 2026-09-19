import { describe, expect, it, vi } from "vitest";
import type { ServerEnvironment } from "../../lib/config/env";
import { ProviderExecutionError } from "../../lib/providers/errors";
import { createProvider, providerSelectionSchema } from "../../lib/providers/factory";
import { GEMINI_PROMPT_VERSION } from "../../lib/providers/gemini/prompt";
import { bookingValidOutput } from "../../lib/providers/mock/fixtures/booking-smart-space.valid";
import { bookingInput } from "../helpers";

const noGeminiEnv: ServerEnvironment = {
  supabaseUrl: "https://project.supabase.co",
  supabaseAnonKey: "anon",
  applicationUrl: "http://localhost:3000",
  runtimeEnvironment: "test",
  defaultProvider: "mock",
  gemini: { available: false, apiKey: null, models: [] },
  geminiKeyEncryption: { available: false, secret: null },
  adminEmail: { available: false, email: null },
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
      promptVersion: GEMINI_PROMPT_VERSION,
    });
  });

  it("rejects every unknown selection", () => {
    expect(providerSelectionSchema.safeParse("other").success).toBe(false);
  });

  describe("apiKeyOverride (Phase 1, Slice 3 — own-Gemini-key bypass)", () => {
    it("uses the override key instead of the env-sourced one, even when the server has no key at all", async () => {
      const fetchImpl = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          void input;
          expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("own-key");
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: JSON.stringify(bookingValidOutput) }] } }],
            }),
            { status: 200 },
          );
        },
      );
      // env.gemini has a model chain but no server-wide key/availability — only a
      // model chain is a server-config fact; an own key never needs to bring its own.
      const envWithModelsOnly: ServerEnvironment = {
        ...noGeminiEnv,
        gemini: { available: false, apiKey: null, models: ["configured-model-a"] },
      };

      const provider = createProvider(
        "gemini",
        envWithModelsOnly,
        fetchImpl as typeof fetch,
        "own-key",
      );
      await provider.generate(bookingInput());

      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("still refuses when the model chain is empty, even with an override key", () => {
      let error: unknown;
      try {
        createProvider("gemini", noGeminiEnv, undefined, "own-key");
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(ProviderExecutionError);
      expect(JSON.stringify(error)).not.toMatch(/own-key/);
    });

    it("refuses an empty-string override the same as a missing key", () => {
      expect(() => createProvider("gemini", geminiEnv, undefined, "")).toThrow(ProviderExecutionError);
    });

    it("leaves 3-arg call sites unaffected — the override is fully optional and backward compatible", () => {
      expect(createProvider("mock", noGeminiEnv).name).toBe("mock");
    });
  });
});
