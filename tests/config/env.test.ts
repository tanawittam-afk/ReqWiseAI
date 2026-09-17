import { describe, expect, it } from "vitest";
import { readServerEnvironment, toProviderOptions } from "../../lib/config/env";

const requiredSource = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
};

describe("server environment", () => {
  it("keeps Gemini optional", () => {
    const env = readServerEnvironment({ ...requiredSource, AI_PROVIDER: "mock" });

    expect(env.gemini).toEqual({ available: false, apiKey: null, models: [] });
    expect(toProviderOptions(env)).toEqual([
      { key: "mock", label: "Deterministic Mock", available: true },
      { key: "gemini", label: "Gemini", available: false },
    ]);
  });

  it("parses an ordered model chain without exposing the key", () => {
    const env = readServerEnvironment({
      ...requiredSource,
      GEMINI_API_KEY: "secret",
      GEMINI_MODEL: "configured-model-a",
      GEMINI_FALLBACK_MODELS: "configured-model-b,configured-model-c",
    });

    expect(env.gemini.models).toEqual([
      "configured-model-a",
      "configured-model-b",
      "configured-model-c",
    ]);
    const serializedOptions = JSON.stringify(toProviderOptions(env));
    expect(serializedOptions).not.toContain("secret");
    expect(serializedOptions).not.toContain("configured-model-a");
    expect(serializedOptions).not.toContain("configured-model-b");
    expect(serializedOptions).not.toContain("configured-model-c");
  });

  it("removes blank models and de-duplicates the fallback chain in order", () => {
    const env = readServerEnvironment({
      ...requiredSource,
      GEMINI_API_KEY: "  server-key  ",
      GEMINI_MODEL: " configured-model-a ",
      GEMINI_FALLBACK_MODELS: " , configured-model-b, configured-model-a, , configured-model-b ",
    });

    expect(env.gemini).toEqual({
      available: true,
      apiKey: "server-key",
      models: ["configured-model-a", "configured-model-b"],
    });
  });

  it("keeps Gemini unavailable for whitespace-only credentials or models", () => {
    const env = readServerEnvironment({
      ...requiredSource,
      GEMINI_API_KEY: "   ",
      GEMINI_MODEL: "  ",
      GEMINI_FALLBACK_MODELS: " , ",
    });

    expect(env.gemini).toEqual({ available: false, apiKey: null, models: [] });
  });

  it.each([
    ["key only", { GEMINI_API_KEY: "server-key", GEMINI_MODEL: "   " }],
    ["model only", { GEMINI_API_KEY: "   ", GEMINI_MODEL: "configured-model-a" }],
  ])("keeps Gemini unavailable with %s partial configuration", (_case, partial) => {
    const env = readServerEnvironment({ ...requiredSource, ...partial });

    expect(env.gemini.available).toBe(false);
    expect(toProviderOptions(env)[1]).toEqual({ key: "gemini", label: "Gemini", available: false });
  });

  it.each([
    ["NEXT_PUBLIC_SUPABASE_URL", undefined, "neighbor-anon-value"],
    ["NEXT_PUBLIC_SUPABASE_URL", "   ", "neighbor-anon-value"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined, "https://neighbor-project.supabase.co"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "   ", "https://neighbor-project.supabase.co"],
  ] as const)(
    "rejects missing or blank %s without echoing neighboring values",
    (variable, value, neighboringValue) => {
      const source = {
        ...requiredSource,
        NEXT_PUBLIC_SUPABASE_URL:
          variable === "NEXT_PUBLIC_SUPABASE_URL" ? value : neighboringValue,
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
          variable === "NEXT_PUBLIC_SUPABASE_ANON_KEY" ? value : neighboringValue,
      };

      let error: unknown;
      try {
        readServerEnvironment(source);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(variable);
      expect((error as Error).message).not.toContain(neighboringValue);
    },
  );

  it.each([
    ["NODE_ENV", { NODE_ENV: "preview" }],
    ["AI_PROVIDER", { AI_PROVIDER: "other" }],
  ])("rejects an invalid %s", (variable, override) => {
    expect(() => readServerEnvironment({ ...requiredSource, ...override })).toThrow(variable);
  });

  describe("geminiKeyEncryption (Phase 1, Slice 3)", () => {
    it("is unavailable, not a throw, when the secret is entirely unset", () => {
      const env = readServerEnvironment(requiredSource);

      expect(env.geminiKeyEncryption).toEqual({ available: false, secret: null });
    });

    it("is available once a valid 32-byte base64 secret is set", () => {
      const secret = Buffer.alloc(32, 3).toString("base64");
      const env = readServerEnvironment({ ...requiredSource, GEMINI_KEY_ENCRYPTION_SECRET: secret });

      expect(env.geminiKeyEncryption).toEqual({ available: true, secret });
    });

    it("throws loudly when the secret is present but the wrong length", () => {
      const tooShort = Buffer.alloc(16, 3).toString("base64");

      expect(() =>
        readServerEnvironment({ ...requiredSource, GEMINI_KEY_ENCRYPTION_SECRET: tooShort }),
      ).toThrow(/32 bytes/);
    });

    it("treats a whitespace-only secret the same as unset", () => {
      const env = readServerEnvironment({ ...requiredSource, GEMINI_KEY_ENCRYPTION_SECRET: "   " });

      expect(env.geminiKeyEncryption).toEqual({ available: false, secret: null });
    });
  });
});
