/**
 * Editing and reviewing a requirement.
 *
 * Both operations are a single RPC call each, on a **user-scoped** client. There is no
 * service-role client in this file and there must not be: `edit_analysis_item` and
 * `review_item` are SECURITY DEFINER precisely so they can write audit rows the caller
 * could not write directly, and they re-derive membership, project status, item type,
 * transition legality and version from the database. Passing the service role here
 * would hand a browser request the one identity that answers to nobody.
 *
 * Why one call and not several: an edit is a content update, a version snapshot, a
 * possible status reset and a possible activity row. Four statements from Node can
 * succeed in part. One function call is a transaction — Postgres already guarantees
 * what a sequence of round trips cannot.
 *
 * This layer's own job is small and specific: parse what the form sent, refuse what
 * the contract forbids, and turn a Postgres refusal into a sentence a person can act
 * on. The user never sees a SQLSTATE, a function name, a table, a trigger or a policy.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  activityTypeFor,
  itemEditSchema,
  reviewActionSchema,
  reviewFieldErrors,
  type ItemEditInput,
  type ItemStatus,
  type ReviewActionInput,
} from "../contracts/review";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type EditResult = { itemId: string; versionNo: number; status: ItemStatus; statusReset: boolean };
export type ReviewResult = { itemId: string; fromStatus: ItemStatus; toStatus: ItemStatus };

/**
 * Every sentence a refusal can produce, in one place.
 *
 * Named rather than inlined so the runtime tests can assert that a given database
 * refusal reaches the user as a given sentence, without matching prose in two files.
 */
export const REVIEW_MESSAGES = {
  unavailable: "This requirement is unavailable.",
  readOnlyProject: "This project is archived and read-only. Restore it to make changes.",
  versionConflict:
    "This requirement changed while you were editing. Reload the latest version before saving.",
  statusConflict: "This requirement changed while you were reviewing it. Reload and try again.",
  transition: "This status transition is not allowed.",
  noteRequired: "A clarification note is required.",
  wrongWorkflow: "This item type uses a different workflow.",
  terminal: "This requirement has been approved or rejected and is read-only.",
  editFailed: "The requirement could not be saved. Try again.",
  reviewFailed: "The review action could not be completed.",
  invalid: "Some fields need attention.",
  expired: "Your session has expired. Sign in again.",
} as const;

/** Postgres errors are for the log. The user gets a sentence, never a policy name. */
function failure(context: string, detail: string, message: string): ServiceResult<never> {
  console.error(`[review] ${context}: ${detail}`);
  return { ok: false, error: message };
}

/**
 * A refusal that came from the database, translated.
 *
 * The message text is matched rather than the SQLSTATE, for the same reason
 * `lib/sources/service.ts` does: several distinct rules share `restrict_violation`, so
 * the code says "a rule stopped you" and only the text says which. The two conflicts
 * do carry a distinguishing code (`serialization_failure`, 40001) and are matched on
 * text as well, so a driver that reshapes the error still lands on the right sentence.
 */
export function translateReviewError(detail: string, fallback: string): string {
  if (/version conflict/i.test(detail)) return REVIEW_MESSAGES.versionConflict;
  if (/status conflict/i.test(detail)) return REVIEW_MESSAGES.statusConflict;
  if (/archived/i.test(detail)) return REVIEW_MESSAGES.readOnlyProject;
  if (/different workflow/i.test(detail)) return REVIEW_MESSAGES.wrongWorkflow;
  if (/read-only/i.test(detail)) return REVIEW_MESSAGES.terminal;
  if (/note is required/i.test(detail)) return REVIEW_MESSAGES.noteRequired;
  if (/invalid status transition/i.test(detail)) return REVIEW_MESSAGES.transition;
  if (/not found|not visible/i.test(detail)) return REVIEW_MESSAGES.unavailable;
  if (/authentication required/i.test(detail)) return REVIEW_MESSAGES.expired;
  return fallback;
}

/**
 * Save an edit.
 *
 * The status reset that may follow (reviewed → draft) is decided by the database, not
 * here, and comes back in the result so the UI can say what happened rather than
 * guess. Nothing about the item's identity, evidence or status travels in the payload.
 */
export async function editItem(
  client: SupabaseClient,
  itemId: string,
  rawInput: ItemEditInput | unknown,
): Promise<ServiceResult<EditResult>> {
  const parsed = itemEditSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: REVIEW_MESSAGES.invalid, fieldErrors: reviewFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const { data, error } = await client.rpc("edit_analysis_item", {
    p_item_id: itemId,
    p_expected_version: input.expectedVersion,
    p_title: input.title,
    p_description: input.description,
    p_priority: input.priority,
    p_change_reason: input.changeReason,
  });

  if (error) {
    return failure("edit", error.message, translateReviewError(error.message, REVIEW_MESSAGES.editFailed));
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      itemId,
      versionNo: Number(row.version_no ?? 0),
      status: (row.status as ItemStatus) ?? "draft",
      statusReset: row.status_reset === true,
    },
  };
}

/**
 * Record a review decision.
 *
 * `expectedStatus` is the reviewer's half of the bargain: they judged the item as it
 * appeared on screen. If somebody else moved it since, the decision is refused rather
 * than applied to a state nobody looked at.
 */
export async function reviewItem(
  client: SupabaseClient,
  itemId: string,
  rawInput: ReviewActionInput | unknown,
): Promise<ServiceResult<ReviewResult>> {
  const parsed = reviewActionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: REVIEW_MESSAGES.invalid, fieldErrors: reviewFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const { data, error } = await client.rpc("review_item", {
    p_item_id: itemId,
    p_activity_type: activityTypeFor(input.toStatus),
    p_to_status: input.toStatus,
    p_comment: input.note,
    p_expected_status: input.expectedStatus,
  });

  if (error) {
    return failure("review", error.message, translateReviewError(error.message, REVIEW_MESSAGES.reviewFailed));
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      itemId,
      fromStatus: (row.from_status as ItemStatus) ?? input.expectedStatus,
      toStatus: (row.to_status as ItemStatus) ?? input.toStatus,
    },
  };
}
