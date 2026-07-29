import { describe, expect, it } from "vitest";
import { runAnalysis } from "../../lib/analysis/run-analysis";
import { ProviderExecutionError } from "../../lib/providers/errors";
import type { AiProvider } from "../../lib/providers/types";
import { bookingInput, testPorts } from "../helpers";

describe("provider execution contract", () => {
  it("carries provider metadata on a valid generation", async () => {
    const provider: AiProvider = {
      name: "gemini",
      deterministic: false,
      async generate() {
        const { bookingValidOutput } = await import(
          "../../lib/providers/mock/fixtures/booking-smart-space.valid"
        );
        return {
          raw: bookingValidOutput,
          metadata: {
            provider: "gemini",
            model: "configured-model-a",
            promptVersion: "reqwise-gemini/1.0",
          },
        };
      },
    };

    const result = await runAnalysis(provider, bookingInput(), testPorts());
    expect(result.status).toBe("valid");
    expect(result.metadata).toEqual({
      provider: "gemini",
      model: "configured-model-a",
      promptVersion: "reqwise-gemini/1.0",
    });
  });

  it("turns a typed transport failure into a safe provider_error", async () => {
    const provider: AiProvider = {
      name: "gemini",
      deterministic: false,
      async generate() {
        throw new ProviderExecutionError(
          "rate_limited",
          "The analysis provider is busy. Try again later.",
          {
            provider: "gemini",
            model: "configured-model-a",
            promptVersion: "reqwise-gemini/1.0",
          },
        );
      },
    };

    const result = await runAnalysis(provider, bookingInput(), testPorts());
    expect(result).toMatchObject({
      status: "provider_error",
      error: {
        category: "rate_limited",
        message: "The analysis provider is busy. Try again later.",
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/api key|stack|response body/i);
  });

  it("never exposes sensitive typed provider failure details", async () => {
    const metadata = {
      provider: "gemini" as const,
      model: "configured-model-a",
      promptVersion: "reqwise-gemini/1.0",
    };
    const provider: AiProvider = {
      name: "gemini",
      deterministic: false,
      async generate() {
        throw new ProviderExecutionError(
          "rate_limited",
          "API key sk-live-secret; response body: prompt text from the source document",
          metadata,
        );
      },
    };

    const result = await runAnalysis(provider, bookingInput(), testPorts());
    expect(result).toMatchObject({
      status: "provider_error",
      error: {
        category: "rate_limited",
        message: "The analysis provider is busy. Try again later.",
      },
      metadata,
    });
    expect(JSON.stringify(result)).not.toMatch(/sk-live-secret|response body|prompt text/i);
  });
});
