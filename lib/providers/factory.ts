import { z } from "zod";
import type { ServerEnvironment } from "../config/env";
import { ProviderExecutionError, safeProviderMessage } from "./errors";
import { createGeminiProvider } from "./gemini/provider";
import { createMockProvider } from "./mock/mock-provider";
import type { AiProvider } from "./types";

export const providerSelectionSchema = z.enum(["mock", "gemini"]);

/**
 * `apiKeyOverride` (Phase 1, Slice 3): when supplied, a user's own decrypted Gemini key
 * is used instead of the env-sourced one, and the `env.gemini.available` gate (which is
 * only about whether the *server's* key is configured) is bypassed accordingly — the
 * model chain still comes from server config either way, since that isn't something a
 * user brings. Backward compatible: every existing 3-arg call site is unaffected.
 */
export function createProvider(
  key: "mock" | "gemini",
  env: ServerEnvironment,
  fetchImpl?: typeof fetch,
  apiKeyOverride?: string,
): AiProvider {
  if (key === "mock") return createMockProvider();

  const [primaryModel, ...fallbackModels] = env.gemini.models;
  const apiKey = apiKeyOverride ?? env.gemini.apiKey;
  const keyAvailable = apiKeyOverride !== undefined ? apiKeyOverride.length > 0 : env.gemini.available;

  if (!keyAvailable || apiKey === null || primaryModel === undefined) {
    throw new ProviderExecutionError("unavailable", safeProviderMessage("unavailable"), {
      provider: "gemini",
      model: null,
      promptVersion: null,
    });
  }

  return createGeminiProvider({
    apiKey,
    models: [primaryModel, ...fallbackModels],
    timeoutMs: 30_000,
    fetchImpl,
  });
}
