/**
 * What a human may say when adding a requirement directly (Phase 2, Slice 4 of the
 * "Usable Product" master plan) — the manual counterpart to `edit_analysis_item()`'s
 * `itemEditSchema` in `review.ts`, and the same `strictObject` discipline: a field this
 * schema does not name is a field no client can smuggle in (`status`, `origin`,
 * `analysisRunId` are all absent on purpose — `add_manual_requirement()` hardcodes them
 * the same way).
 *
 * The database enforces the same rules again (`20260920000029_manual_requirement.sql`).
 * That is not duplication for its own sake: this layer produces a sentence a person can
 * act on next to the right input, and the database produces the guarantee.
 */

import { z } from "zod";
import { EVIDENCE_CLASSES, PRIORITIES } from "./item-types.ts";
import { ITEM_DESCRIPTION_MAX, ITEM_TITLE_MAX, REVIEWABLE_ITEM_TYPES, reviewFieldErrors } from "./review.ts";

export { reviewFieldErrors as manualRequirementFieldErrors };

/** Mirrors `sourceReferenceSchema.excerpt`'s ceiling in `provider-output.ts` — a manual
 * citation is the same kind of thing a provider's citation is, just typed by a person. */
export const MANUAL_EXCERPT_MAX = 2000;

export const addManualRequirementSchema = z
  .strictObject({
    itemType: z.enum(REVIEWABLE_ITEM_TYPES as [string, ...string[]], {
      message: "Choose a requirement type",
    }),
    title: z
      .string()
      .trim()
      .min(1, "A requirement needs a statement")
      .max(ITEM_TITLE_MAX, `Keep the statement under ${ITEM_TITLE_MAX} characters`),
    description: z
      .string()
      .trim()
      .min(1, "Describe what this requirement means")
      .max(ITEM_DESCRIPTION_MAX, `Keep the description under ${ITEM_DESCRIPTION_MAX} characters`),
    priority: z.enum(PRIORITIES, { message: "Choose a priority" }),
    evidenceClass: z.enum(EVIDENCE_CLASSES, { message: "Choose how this is supported" }),
    sourceId: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
    excerpt: z
      .string()
      .trim()
      .max(MANUAL_EXCERPT_MAX, `Keep the excerpt under ${MANUAL_EXCERPT_MAX} characters`)
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
  })
  .refine((value) => (value.sourceId === null) === (value.excerpt === null), {
    message: "Provide both a source and an excerpt, or neither",
    path: ["excerpt"],
  })
  .refine((value) => !(value.evidenceClass === "assumed" && value.excerpt !== null), {
    message: "An assumed item may not cite a source excerpt",
    path: ["evidenceClass"],
  });

export type AddManualRequirementInput = z.infer<typeof addManualRequirementSchema>;

/** Reads only these six fields — an injected `status` or `origin` never reaches the schema. */
export function readAddManualRequirementForm(formData: FormData): unknown {
  const text = (field: string) => String(formData.get(field) ?? "");
  return {
    itemType: text("itemType"),
    title: text("title"),
    description: text("description"),
    priority: text("priority"),
    evidenceClass: text("evidenceClass"),
    sourceId: text("sourceId"),
    excerpt: text("excerpt"),
  };
}
