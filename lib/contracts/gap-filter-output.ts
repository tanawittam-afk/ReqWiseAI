/**
 * The gap-filter call's own contract (Phase 3, Slice 4) — a second, smaller provider
 * call, sibling to `provider-output.ts`'s main analysis contract, never merged into
 * it. Same discipline: model output is untrusted until it passes this schema.
 *
 * The provider sees only candidate statement texts (already located and segmented by
 * code — see `lib/analysis/coverage-gaps.ts`) and decides which are genuine gaps
 * worth a reviewer's attention, dropping chit-chat, logistics, and anything already
 * implied elsewhere. It never sees or touches `analysis_items` — persistence maps its
 * output back onto the candidates by `key`.
 */

import { z } from "zod";

function nonEmptyText(max: number) {
  return z.string().trim().min(1).max(max);
}

const gapFilterResultSchema = z
  .strictObject({
    key: nonEmptyText(64),
    is_gap: z.boolean(),
    /** Required only when `is_gap` is true — a rejected candidate needs no title. */
    title: nonEmptyText(160).optional(),
    description: nonEmptyText(1000).optional(),
  })
  .refine((result) => !result.is_gap || (result.title !== undefined && result.description !== undefined), {
    message: "a gap (is_gap: true) must carry both a title and a description",
    path: ["title"],
  });

export const gapFilterOutputSchema = z.strictObject({
  results: z.array(gapFilterResultSchema).max(200),
});

export type GapFilterResult = z.infer<typeof gapFilterResultSchema>;
export type GapFilterOutput = z.infer<typeof gapFilterOutputSchema>;

export const GAP_FILTER_SCHEMA_VERSION = "1.0.0";
