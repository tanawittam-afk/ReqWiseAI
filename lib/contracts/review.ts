/**
 * What a human may say about a requirement — and nothing else.
 *
 * The same discipline as `contracts/source.ts`, applied to a surface where the
 * temptation is stronger: an edit form sits right next to the item's status, version,
 * confidence and evidence, and every one of those is a field somebody will eventually
 * try to submit. `z.strictObject` refuses the payload outright rather than quietly
 * dropping the extra key, so a client that sends `status` gets an error instead of a
 * silent no-op it might mistake for success.
 *
 * The database enforces the same rules again (20260725000013). That is not
 * duplication for its own sake: this layer produces a sentence a person can act on
 * next to the right input, and the database produces the guarantee.
 */

import { z } from "zod";
import { ITEM_TYPES, PRIORITIES, type ItemType } from "./item-types.ts";

/** Mirrors the `item_status` enum. `implemented` exists in the database but is */
/** unreachable in the MVP — approved is terminal (migration 20260725000013). */
export const ITEM_STATUSES = [
  "draft",
  "needs_clarification",
  "reviewed",
  "approved",
  "rejected",
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/**
 * Types the requirement review workflow applies to.
 *
 * `open_question` and `quality_finding` are observations *about* the analysis, not
 * claims it makes: a question is answered and a finding is acknowledged, neither is
 * "approved". Their workflows are a later slice; until then they are read-only and
 * say so. Mirrors `is_reviewable_item_type()`.
 */
export const REVIEWABLE_ITEM_TYPES: readonly ItemType[] = ITEM_TYPES.filter(
  (type) => type !== "open_question" && type !== "quality_finding",
);

export function isReviewableItemType(type: string): type is ItemType {
  return (REVIEWABLE_ITEM_TYPES as readonly string[]).includes(type);
}

/** The label a deferred type carries instead of review actions. */
export const DEFERRED_WORKFLOW_LABEL: Partial<Record<ItemType, string>> = {
  open_question: "Question workflow coming next",
  quality_finding: "Quality review workflow coming next",
};

/**
 * Transitions a person may choose from a menu.
 *
 * Deliberately absent: anything out of `approved` or `rejected` (both terminal in the
 * MVP) and anything *into* `draft`. Returning to draft is not a review decision — it
 * is what editing does to a review that no longer describes the text, and that reset
 * belongs to the edit path, not this table. Mirrors `is_valid_status_transition()`.
 */
export const ALLOWED_TRANSITIONS: Record<ItemStatus, readonly ItemStatus[]> = {
  draft: ["reviewed", "needs_clarification", "rejected"],
  needs_clarification: ["reviewed", "rejected"],
  reviewed: ["approved", "needs_clarification", "rejected"],
  approved: [],
  rejected: [],
};

export function isAllowedTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from as ItemStatus];
  return allowed !== undefined && (allowed as readonly string[]).includes(to);
}

/** An item nobody may change any more, for any reason, in this slice. */
export function isTerminalStatus(status: string): boolean {
  return status === "approved" || status === "rejected";
}

/**
 * A refusal and a request for clarification are instructions to somebody. An
 * instruction with no words is a dead end for whoever picks the item up next, so the
 * note is required — in the form, in the service, and in the RPC.
 */
export function requiresNote(to: string): boolean {
  return to === "rejected" || to === "needs_clarification";
}

// --- editing ---------------------------------------------------------------

export const ITEM_TITLE_MAX = 300;
export const ITEM_DESCRIPTION_MAX = 4000;
export const CHANGE_REASON_MAX = 500;
export const REVIEW_NOTE_MAX = 2000;

/**
 * Three editable fields. Everything a form might also carry — `status`, `versionNo`,
 * `evidenceClass`, `origin`, `confidence`, `itemType`, `displayId`, `sourceReferences`
 * — is simply not in this object, and `strictObject` turns "also sent" into a parse
 * error rather than an ignored key.
 *
 * `expectedVersion` is the exception that proves the rule: it is a *read* the client
 * reports back, never a value it gets to choose, and the database refuses the write
 * if the row has moved on.
 */
export const itemEditSchema = z.strictObject({
  expectedVersion: z.coerce
    .number()
    .int("This requirement could not be identified. Reload and try again.")
    .positive("This requirement could not be identified. Reload and try again."),
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
  changeReason: z
    .string()
    .trim()
    .max(CHANGE_REASON_MAX, `Keep the reason under ${CHANGE_REASON_MAX} characters`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null),
});

export type ItemEditInput = z.infer<typeof itemEditSchema>;

/**
 * A review decision. `note` is validated against the action rather than in isolation,
 * because "required" depends on which button was pressed.
 */
export const reviewActionSchema = z
  .strictObject({
    toStatus: z.enum(ITEM_STATUSES, { message: "Choose a review outcome" }),
    expectedStatus: z.enum(ITEM_STATUSES, { message: "Reload this requirement and try again" }),
    note: z
      .string()
      .trim()
      .max(REVIEW_NOTE_MAX, `Keep the note under ${REVIEW_NOTE_MAX} characters`)
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
  })
  .refine((value) => !requiresNote(value.toStatus) || value.note !== null, {
    message: "A note is required",
    path: ["note"],
  });

export type ReviewActionInput = z.infer<typeof reviewActionSchema>;

/**
 * The `review_activity_type` the database records for a decision. `status_change` is
 * the honest fallback: "reviewed" is a state, not a verb the enum has a word for.
 */
export function activityTypeFor(to: ItemStatus): "approve" | "reject" | "request_clarification" | "status_change" {
  if (to === "approved") return "approve";
  if (to === "rejected") return "reject";
  if (to === "needs_clarification") return "request_clarification";
  return "status_change";
}

/** Reads only these five fields, so an injected `itemId` or `status` never reaches a schema. */
export function readItemEditForm(formData: FormData): unknown {
  const text = (field: string) => String(formData.get(field) ?? "");
  return {
    expectedVersion: text("expectedVersion"),
    title: text("title"),
    description: text("description"),
    priority: text("priority"),
    changeReason: text("changeReason"),
  };
}

export function readReviewActionForm(formData: FormData): unknown {
  const text = (field: string) => String(formData.get(field) ?? "");
  return {
    toStatus: text("toStatus"),
    expectedStatus: text("expectedStatus"),
    note: text("note"),
  };
}

/** Field-keyed messages, so the form can render each one next to its input. */
export function reviewFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}
