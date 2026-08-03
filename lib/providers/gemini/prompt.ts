import { z } from "zod";
import type { AnalysisInput } from "../../contracts/analysis-input";
import { providerOutputSchema } from "../../contracts/provider-output";
import { ALLOWED_RELATION_PAIRS, AUTHORED_RELATION_TYPES } from "../../contracts/relations";

export const GEMINI_PROMPT_VERSION = "reqwise-gemini/1.1";

/**
 * `relations[i].from_key`'s item type must appear in the matching entry's `from`
 * list (or the entry must be `"any"`); same for `to_key` and `to`. Built from
 * `ALLOWED_RELATION_PAIRS`, restricted to the types a new run may actually emit,
 * so the model gets the same rule the database enforces (`relations.ts`
 * `ALLOWED_RELATION_PAIRS`, mirrored by `is_allowed_relation_pair()`).
 */
function relationPairMatrix(): Record<string, { from: readonly string[] | "any"; to: readonly string[] | "any" }> {
  return Object.fromEntries(
    AUTHORED_RELATION_TYPES.map((type) => {
      const rule = ALLOWED_RELATION_PAIRS[type];
      return [type, rule === "any" ? { from: "any" as const, to: "any" as const } : rule];
    }),
  );
}

export function buildGeminiPrompt(input: AnalysisInput): string {
  const contract = z.toJSONSchema(providerOutputSchema);
  const sources = input.sourceDocuments
    .map((source) => `Source key: ${source.key}\nTitle: ${source.title}\nrawText:\n${source.text}`)
    .join("\n\n");

  return [
    "You are ReqWiseAI's requirements-analysis provider.",
    "Return one JSON object and nothing else. Do not return markdown fences.",
    "Never approve a requirement. Every generated item starts as application-owned draft.",
    "Never fabricate evidence, offsets, or relations.",
    [
      "Every source_references entry must omit start_offset and end_offset — leave both fields",
      "out entirely. They are optional, and the analysis pipeline locates each citation itself",
      "by an exact substring search of excerpt inside rawText, which is reliable. Counting",
      "character positions yourself is not: rawText may use CRLF line endings (\\r\\n), where",
      "the \\r is an invisible character that is easy to miscount, and may contain Thai text,",
      "where a visible character does not always occupy one string index. Getting an offset",
      "wrong causes the whole citation to be rejected, so do not attempt one.",
      "excerpt itself must still be copied verbatim, character-for-character, from rawText —",
      "no paraphrasing, no translating, no fixing typos, no collapsing whitespace.",
    ].join(" "),
    "Domain guidance is context, not direct source evidence.",
    "assumed items have no source_references and include a rationale.",
    `Output language: ${input.outputLang}.`,
    [
      "Horizontal traceability between items in this response goes only in the top-level",
      "`relations` array, as `{ from_key, to_key, type }`. Leave every item's",
      "`related_item_keys` as an empty array — it is deprecated and a new run may not use it;",
      "putting an edge there instead of in `relations` is treated the same as inventing an",
      "unsupported relationship.",
      `Allowed relation types: ${AUTHORED_RELATION_TYPES.join(", ")}.`,
      "Each type is directional (always from_key -> to_key, never the reverse) and only",
      "allowed between specific item types, given as { from: [item types allowed as from_key],",
      `to: [item types allowed as to_key] } ("any" means no restriction on that side): ${JSON.stringify(relationPairMatrix())}.`,
      "Before emitting a relation, check that from_key's item.type is in that type's `from`",
      "list and to_key's item.type is in its `to` list; omit the relation entirely rather than",
      "emit one that does not fit the matrix.",
    ].join(" "),
    `Domain profile: ${JSON.stringify(input.domainProfile)}.`,
    `Project context: ${JSON.stringify(input.projectContext ?? {})}.`,
    `Sources:\n${sources}`,
    `Exact JSON contract: ${JSON.stringify(contract)}.`,
  ].join("\n\n");
}
