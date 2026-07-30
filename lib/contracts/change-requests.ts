/**
 * What a human may propose against an already-approved or already-rejected requirement.
 *
 * The fourth contract in the family started by `review.ts` and `workflow.ts`: strict
 * objects, transitions that mirror the database, and a note rule per outcome. The
 * difference here is that a change request never touches the item directly — it is a
 * proposal that references one, with its own lifecycle (`pending` -> `approved` /
 * `rejected` / `withdrawn`). Approving one *does* eventually rewrite the item's content
 * through `edit_analysis_item`'s sibling RPC, but the item's `status` never moves:
 * "approved" stays "approved". A change request is the new object; the item keeps one
 * continuous identity.
 *
 * Mirrors `change_request_status`, `is_valid_change_request_transition()` and the
 * `change_requests` table (migration 20260727000021 / 022 / 023).
 */

import { z } from "zod";
import { PRIORITIES } from "./item-types.ts";

export const CHANGE_REQUEST_STATUSES = ["pending", "approved", "rejected", "withdrawn"] as const;
export type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number];

/** Only ever out of `pending`; nothing transitions out of a terminal change request. */
export const CHANGE_REQUEST_TRANSITIONS: Record<ChangeRequestStatus, readonly ChangeRequestStatus[]> = {
  pending: ["approved", "rejected", "withdrawn"],
  approved: [],
  rejected: [],
  withdrawn: [],
};

export function isAllowedChangeRequestTransition(from: string, to: string): boolean {
  const allowed = CHANGE_REQUEST_TRANSITIONS[from as ChangeRequestStatus];
  return allowed !== undefined && (allowed as readonly string[]).includes(to);
}

export function isPendingChangeRequest(status: string): boolean {
  return status === "pending";
}

export const CR_TITLE_MAX = 300;
export const CR_DESCRIPTION_MAX = 4000;
export const CR_REASON_MAX = 2000;
export const CR_RESOLUTION_NOTE_MAX = 2000;

/**
 * Opening a change request. Deliberately absent: `targetItemId`, `actorId`,
 * `projectId` — the target comes from the route/action, not the form, and the actor
 * and project are re-derived server-side from the authenticated session. A form that
 * also sent them would get a parse error, not a silent no-op, because this is a
 * `strictObject`.
 *
 * `sourceQuestionId` is nullable: a change request raised directly from an approved
 * item's own inspector has no motivating question at all.
 */
export const openChangeRequestSchema = z.strictObject({
  proposedTitle: z
    .string()
    .trim()
    .min(1, "A requirement needs a statement")
    .max(CR_TITLE_MAX, `Keep the statement under ${CR_TITLE_MAX} characters`),
  proposedDescription: z
    .string()
    .trim()
    .min(1, "Describe what this requirement should say")
    .max(CR_DESCRIPTION_MAX, `Keep the description under ${CR_DESCRIPTION_MAX} characters`),
  proposedPriority: z.enum(PRIORITIES, { message: "Choose a priority" }),
  reason: z
    .string()
    .trim()
    .min(1, "Explain why this requirement should change")
    .max(CR_REASON_MAX, `Keep the reason under ${CR_REASON_MAX} characters`),
  sourceQuestionId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null)
    .refine((value) => value === null || z.uuid().safeParse(value).success, "Not a valid question reference"),
});

export type OpenChangeRequestInput = z.infer<typeof openChangeRequestSchema>;

/**
 * Resolving one. `changeRequestId` identifies which proposal; there is no
 * `expectedVersion`-style field because the concurrency guard here is the change
 * request's own status — the database refuses a second resolution the instant the
 * first one lands, the same idea `expectedStatus` carries elsewhere, just held by the
 * proposal's row rather than a version number.
 */
export const resolveChangeRequestSchema = z
  .strictObject({
    changeRequestId: z.uuid("This change request could not be identified. Reload and try again."),
    decision: z.enum(["approved", "rejected"], { message: "Choose an outcome" }),
    resolutionNote: z
      .string()
      .trim()
      .max(CR_RESOLUTION_NOTE_MAX, `Keep the note under ${CR_RESOLUTION_NOTE_MAX} characters`)
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
  })
  .refine((value) => value.decision !== "rejected" || value.resolutionNote !== null, {
    message: "A note is required when rejecting a change request",
    path: ["resolutionNote"],
  });

export type ResolveChangeRequestInput = z.infer<typeof resolveChangeRequestSchema>;

export const withdrawChangeRequestSchema = z.strictObject({
  changeRequestId: z.uuid("This change request could not be identified. Reload and try again."),
});

export type WithdrawChangeRequestInput = z.infer<typeof withdrawChangeRequestSchema>;

/** Reads only the fields the "raise a change request" form owns. */
export function readOpenChangeRequestForm(formData: FormData): unknown {
  const text = (field: string) => String(formData.get(field) ?? "");
  return {
    proposedTitle: text("proposedTitle"),
    proposedDescription: text("proposedDescription"),
    proposedPriority: text("proposedPriority"),
    reason: text("reason"),
    sourceQuestionId: text("sourceQuestionId"),
  };
}

export function readResolveChangeRequestForm(formData: FormData): unknown {
  const text = (field: string) => String(formData.get(field) ?? "");
  return {
    changeRequestId: text("changeRequestId"),
    decision: text("decision"),
    resolutionNote: text("resolutionNote"),
  };
}

export function readWithdrawChangeRequestForm(formData: FormData): unknown {
  return { changeRequestId: String(formData.get("changeRequestId") ?? "") };
}

/** Field-keyed messages, so the form can render each one next to its input. */
export function changeRequestFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}

/* ------------------------------------------------------------------- labels */

export const CHANGE_REQUEST_STATUS_LABEL: Record<ChangeRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/** The verb on the button, which is not the word for the state it produces. */
export const CHANGE_REQUEST_ACTION_LABEL: Record<ChangeRequestStatus, string> = {
  pending: "Raise a change request",
  approved: "Approve change",
  rejected: "Reject change",
  withdrawn: "Withdraw",
};

/** Mirrors `review_activity_type`'s four new labels. */
export const CHANGE_REQUEST_ACTIVITY_LABEL: Record<string, string> = {
  change_request_opened: "Raised a change request",
  change_request_approved: "Approved a change request",
  change_request_rejected: "Rejected a change request",
  change_request_withdrawn: "Withdrew a change request",
};
