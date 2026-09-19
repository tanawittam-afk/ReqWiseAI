import { z } from "zod";
import type { AnalysisInput } from "../../contracts/analysis-input";
import { gapFilterOutputSchema } from "../../contracts/gap-filter-output";
import type { GapCandidate } from "../types";

export const GEMINI_GAP_FILTER_PROMPT_VERSION = "reqwise-gemini-gap-filter/1.0";

/**
 * A second, smaller prompt — sibling to `prompt.ts`'s main analysis prompt, never
 * merged into it (Phase 3, Slice 4). The candidates are already located spans of the
 * real source text (`lib/analysis/coverage-gaps.ts`'s code-only step); this call's
 * only job is judgment — which of them are genuine, unaddressed requirements content,
 * and which are chit-chat, logistics, or already implied elsewhere.
 */
export function buildGapFilterPrompt(candidates: GapCandidate[], input: AnalysisInput): string {
  const contract = z.toJSONSchema(gapFilterOutputSchema);

  return [
    "You are ReqWiseAI's gap-check filter.",
    "Return one JSON object and nothing else. Do not return markdown fences.",
    [
      "Each candidate below is a statement from a meeting-notes source that no requirement",
      "in this analysis currently cites. Decide, per candidate, whether it is a genuine gap —",
      "something discussed that a requirement should probably cover — or noise: chit-chat,",
      "scheduling logistics, attendee lists, or a restatement of something already implied",
      "elsewhere in the source. Judge meaning, not length.",
    ].join(" "),
    [
      "For every candidate, return exactly one result with the same `key`. When `is_gap` is",
      "true, `title` and `description` are required and must describe the gap in your own",
      "words — do not just copy the candidate text verbatim. When `is_gap` is false, omit",
      "`title` and `description` entirely.",
    ].join(" "),
    "Never invent a gap that is not grounded in the candidate text given.",
    `Output language: ${input.outputLang}.`,
    `Domain profile: ${JSON.stringify(input.domainProfile)}.`,
    `Candidates:\n${JSON.stringify(candidates)}`,
    `Exact JSON contract: ${JSON.stringify(contract)}.`,
  ].join("\n\n");
}
