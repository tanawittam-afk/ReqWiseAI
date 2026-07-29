import {
  ProviderExecutionError,
  safeProviderMessage,
  type ProviderErrorCategory,
} from "../errors";
import type { ProviderMetadata } from "../types";

export type GeminiClientConfig = {
  apiKey: string;
  models: readonly [string, ...string[]];
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export type GeminiTextResult = {
  text: string;
  model: string;
  requestId: string | null;
};

type AttemptResult =
  | { kind: "success"; result: GeminiTextResult }
  | { kind: "retry"; category: ProviderErrorCategory }
  | { kind: "terminal"; category: ProviderErrorCategory };

function metadataFor(model: string): ProviderMetadata {
  return { provider: "gemini", model, promptVersion: null };
}

function providerError(category: ProviderErrorCategory, model: string): ProviderExecutionError {
  return new ProviderExecutionError(category, safeProviderMessage(category), metadataFor(model));
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function categoryForStatus(status: number): ProviderErrorCategory {
  if (status === 401 || status === 403) return "authentication_failed";
  if (status === 429) return "rate_limited";
  return "unknown";
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function hasSafetyRefusal(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const record = payload as {
    promptFeedback?: { blockReason?: unknown };
    candidates?: Array<{ finishReason?: unknown }>;
  };
  return (
    record.promptFeedback?.blockReason !== undefined ||
    record.candidates?.some((candidate) => candidate.finishReason === "SAFETY") === true
  );
}

function candidateText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return null;

  const firstCandidate = candidates[0];
  if (typeof firstCandidate !== "object" || firstCandidate === null) return null;
  const content = (firstCandidate as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return null;
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return null;

  const part = parts.find(
    (value): value is { text: string } =>
      typeof value === "object" && value !== null && typeof (value as { text?: unknown }).text === "string",
  );
  return part?.text ?? null;
}

async function runAttempt(
  fetchImpl: typeof fetch,
  config: GeminiClientConfig,
  model: string,
  prompt: string,
): Promise<AttemptResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${encodeURIComponent(model)}:generateContent`;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (isRetryableStatus(response.status)) {
        return {
          kind: "retry",
          category: response.status === 429 ? "rate_limited" : "unavailable",
        };
      }
      return { kind: "terminal", category: categoryForStatus(response.status) };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      return isAbortError(error)
        ? { kind: "retry", category: "timeout" }
        : { kind: "terminal", category: "unknown" };
    }

    if (hasSafetyRefusal(payload)) return { kind: "terminal", category: "safety_refusal" };

    const text = candidateText(payload);
    if (text === null) return { kind: "terminal", category: "unknown" };

    return {
      kind: "success",
      result: {
        text,
        model,
        requestId: response.headers.get("x-request-id"),
      },
    };
  } catch (error) {
    return isAbortError(error)
      ? { kind: "retry", category: "timeout" }
      : { kind: "retry", category: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

export function createGeminiClient(
  config: GeminiClientConfig,
): { generate(prompt: string): Promise<GeminiTextResult> } {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async generate(prompt: string): Promise<GeminiTextResult> {
      let lastRetryable: { category: ProviderErrorCategory; model: string } | null = null;

      for (const model of config.models) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const result = await runAttempt(fetchImpl, config, model, prompt);
          if (result.kind === "success") return result.result;
          if (result.kind === "terminal") throw providerError(result.category, model);
          lastRetryable = { category: result.category, model };
        }
      }

      if (lastRetryable !== null) {
        throw providerError(lastRetryable.category, lastRetryable.model);
      }

      throw providerError("unknown", config.models[0]);
    },
  };
}
