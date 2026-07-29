import type { AnalysisInput } from "../../contracts/analysis-input";
import { ProviderExecutionError, safeProviderMessage } from "../errors";
import type { AiProvider, ProviderGeneration } from "../types";
import { createGeminiClient, type GeminiClientConfig } from "./client";
import { buildGeminiPrompt, GEMINI_PROMPT_VERSION } from "./prompt";

export type GeminiProviderConfig = GeminiClientConfig;

export function createGeminiProvider(config: GeminiProviderConfig): AiProvider {
  const client = createGeminiClient(config);

  return {
    name: "gemini",
    deterministic: false,
    async generate(input: AnalysisInput): Promise<ProviderGeneration> {
      let result;
      try {
        result = await client.generate(buildGeminiPrompt(input));
      } catch (error) {
        if (error instanceof ProviderExecutionError) {
          throw new ProviderExecutionError(error.category, safeProviderMessage(error.category), {
            ...error.metadata,
            promptVersion: GEMINI_PROMPT_VERSION,
          });
        }

        throw new ProviderExecutionError("unknown", safeProviderMessage("unknown"), {
          provider: "gemini",
          model: null,
          promptVersion: GEMINI_PROMPT_VERSION,
        });
      }

      try {
        return {
          raw: JSON.parse(result.text),
          metadata: {
            provider: "gemini",
            model: result.model,
            promptVersion: GEMINI_PROMPT_VERSION,
          },
        };
      } catch (error) {
        if (error instanceof SyntaxError) {
          return {
            raw: result.text,
            metadata: {
              provider: "gemini",
              model: result.model,
              promptVersion: GEMINI_PROMPT_VERSION,
            },
          };
        }

        throw new ProviderExecutionError("unknown", safeProviderMessage("unknown"), {
          provider: "gemini",
          model: result.model,
          promptVersion: GEMINI_PROMPT_VERSION,
        });
      }
    },
  };
}
