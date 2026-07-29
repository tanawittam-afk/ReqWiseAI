import { z } from "zod";
import type { ServerEnvironment } from "../config/env";
import { ProviderExecutionError, safeProviderMessage } from "./errors";
import { createGeminiProvider } from "./gemini/provider";
import { createMockProvider } from "./mock/mock-provider";
import type { AiProvider } from "./types";

export const providerSelectionSchema = z.enum(["mock", "gemini"]);

export function createProvider(
  key: "mock" | "gemini",
  env: ServerEnvironment,
  fetchImpl?: typeof fetch,
): AiProvider {
  if (key === "mock") return createMockProvider();

  const [primaryModel, ...fallbackModels] = env.gemini.models;
  if (!env.gemini.available || env.gemini.apiKey === null || primaryModel === undefined) {
    throw new ProviderExecutionError("unavailable", safeProviderMessage("unavailable"), {
      provider: "gemini",
      model: null,
      promptVersion: null,
    });
  }

  return createGeminiProvider({
    apiKey: env.gemini.apiKey,
    models: [primaryModel, ...fallbackModels],
    timeoutMs: 30_000,
    fetchImpl,
  });
}
