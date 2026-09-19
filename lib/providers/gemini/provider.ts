import type { AnalysisInput } from "../../contracts/analysis-input";
import { ProviderExecutionError, safeProviderMessage } from "../errors";
import type { AiProvider, GapCandidate, ProviderGeneration } from "../types";
import { createGeminiClient, type GeminiClientConfig } from "./client";
import { buildGapFilterPrompt, GEMINI_GAP_FILTER_PROMPT_VERSION } from "./gap-filter-prompt";
import { buildGeminiPrompt, GEMINI_PROMPT_VERSION } from "./prompt";

/** Shared by both calls — parses a Gemini text response as JSON, falling back to the
 *  raw string (still `unknown`, still untrusted) when it is not valid JSON, so the
 *  caller's schema validation reports the same "invalid" outcome either way rather
 *  than throwing on a parse error. */
function parseGeminiJson(
  text: string,
  model: string,
  promptVersion: string,
): ProviderGeneration {
  try {
    return { raw: JSON.parse(text), metadata: { provider: "gemini", model, promptVersion } };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { raw: text, metadata: { provider: "gemini", model, promptVersion } };
    }
    throw new ProviderExecutionError("unknown", safeProviderMessage("unknown"), {
      provider: "gemini",
      model,
      promptVersion,
    });
  }
}

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
    async filterCoverageGaps(
      candidates: GapCandidate[],
      input: AnalysisInput,
    ): Promise<ProviderGeneration> {
      let result;
      try {
        result = await client.generate(buildGapFilterPrompt(candidates, input));
      } catch (error) {
        if (error instanceof ProviderExecutionError) {
          throw new ProviderExecutionError(error.category, safeProviderMessage(error.category), {
            ...error.metadata,
            promptVersion: GEMINI_GAP_FILTER_PROMPT_VERSION,
          });
        }

        throw new ProviderExecutionError("unknown", safeProviderMessage("unknown"), {
          provider: "gemini",
          model: null,
          promptVersion: GEMINI_GAP_FILTER_PROMPT_VERSION,
        });
      }

      return parseGeminiJson(result.text, result.model, GEMINI_GAP_FILTER_PROMPT_VERSION);
    },
  };
}
