import { z } from "zod";
import type { AnalysisInput } from "../../contracts/analysis-input";
import { providerOutputSchema } from "../../contracts/provider-output";
import { AUTHORED_RELATION_TYPES } from "../../contracts/relations";

export const GEMINI_PROMPT_VERSION = "reqwise-gemini/1.0";

export function buildGeminiPrompt(input: AnalysisInput): string {
  const contract = z.toJSONSchema(providerOutputSchema);
  const sources = input.sourceDocuments
    .map((source) => `Source key: ${source.key}\nTitle: ${source.title}\nrawText:\n${source.text}`)
    .join("\n\n");

  return [
    "You are ReqWiseAI's requirements-analysis provider.",
    "Return one JSON object and nothing else. Do not return markdown fences.",
    "Never approve a requirement. Every generated item starts as application-owned draft.",
    "Never fabricate evidence or offsets.",
    "For every cited reference: rawText.slice(start_offset, end_offset) === excerpt.",
    "Domain guidance is context, not direct source evidence.",
    "assumed items have no source_references and include a rationale.",
    `Output language: ${input.outputLang}.`,
    `Allowed relation types: ${AUTHORED_RELATION_TYPES.join(", ")}.`,
    `Domain profile: ${JSON.stringify(input.domainProfile)}.`,
    `Project context: ${JSON.stringify(input.projectContext ?? {})}.`,
    `Sources:\n${sources}`,
    `Exact JSON contract: ${JSON.stringify(contract)}.`,
  ].join("\n\n");
}
