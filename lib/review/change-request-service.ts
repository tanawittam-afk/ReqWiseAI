/**
 * Proposing, approving, rejecting and withdrawing a change against an already-approved
 * or already-rejected requirement.
 *
 * The same shape as `service.ts` and `workflow-service.ts`: one RPC call per operation,
 * on a **user-scoped** client, no service role anywhere in this file. `open_change_request`,
 * `resolve_change_request` and `withdraw_change_request` are SECURITY DEFINER precisely so
 * they can write the audit row the caller could not write directly, and each re-derives
 * membership, project status and the change request's own state from the database.
 *
 * Approving does eventually rewrite the target item's title/description/priority — but
 * through the RPC's own narrow, flag-gated exception in `guard_item_update()`, never
 * through this file writing to `analysis_items` directly. The item's `status` column is
 * never touched here at all.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  openChangeRequestSchema,
  resolveChangeRequestSchema,
  withdrawChangeRequestSchema,
  changeRequestFieldErrors,
  type ChangeRequestStatus,
  type OpenChangeRequestInput,
  type ResolveChangeRequestInput,
  type WithdrawChangeRequestInput,
} from "../contracts/change-requests.ts";
import type { ServiceResult } from "./service";

export type OpenChangeRequestResult = { changeRequestId: string; targetItemId: string; status: ChangeRequestStatus };
export type ResolveChangeRequestResult = {
  changeRequestId: string;
  decision: "approved" | "rejected";
  appliedVersionNo: number | null;
};
export type WithdrawChangeRequestResult = { changeRequestId: string; status: ChangeRequestStatus };

/** Every sentence a change-request refusal can produce, in one place. */
export const CHANGE_REQUEST_MESSAGES = {
  unavailable: "This requirement is unavailable.",
  questionUnavailable: "The source question could not be found.",
  readOnlyProject: "This project is archived and read-only. Restore it to make changes.",
  notTerminal: "A change request can only be raised against an approved or rejected requirement.",
  alreadyPending: "A change request is already pending against this requirement.",
  crUnavailable: "This change request is unavailable.",
  noLongerPending: "This change request is no longer pending.",
  noteRequired: "A resolution note is required when rejecting a change request.",
  openFailed: "The change request could not be submitted. Try again.",
  resolveFailed: "The change request could not be resolved. Try again.",
  withdrawFailed: "The change request could not be withdrawn. Try again.",
  invalid: "Some fields need attention.",
  expired: "Your session has expired. Sign in again.",
} as const;

function failure(context: string, detail: string, message: string): ServiceResult<never> {
  console.error(`[change-request] ${context}: ${detail}`);
  return { ok: false, error: message };
}

/**
 * A refusal from the database, translated.
 *
 * Matched on text rather than SQLSTATE for the same reason `review.ts` and
 * `workflow.ts` are: several distinct rules share `restrict_violation`, so the code
 * says "a rule stopped you" and only the text says which.
 */
export function translateChangeRequestError(detail: string, fallback: string): string {
  if (/already pending/i.test(detail)) return CHANGE_REQUEST_MESSAGES.alreadyPending;
  if (/no longer pending/i.test(detail)) return CHANGE_REQUEST_MESSAGES.noLongerPending;
  if (/no longer pending cannot be resolved/i.test(detail)) return CHANGE_REQUEST_MESSAGES.noLongerPending;
  if (/only a pending change request can be withdrawn/i.test(detail)) return CHANGE_REQUEST_MESSAGES.noLongerPending;
  if (/archived/i.test(detail)) return CHANGE_REQUEST_MESSAGES.readOnlyProject;
  if (/approved or rejected requirement/i.test(detail)) return CHANGE_REQUEST_MESSAGES.notTerminal;
  if (/source question|stakeholder question/i.test(detail)) return CHANGE_REQUEST_MESSAGES.questionUnavailable;
  if (/resolution note is required/i.test(detail)) return CHANGE_REQUEST_MESSAGES.noteRequired;
  if (/change request not found|change request .*not visible/i.test(detail)) {
    return CHANGE_REQUEST_MESSAGES.crUnavailable;
  }
  if (/requirement not found|requirement .*not visible/i.test(detail)) return CHANGE_REQUEST_MESSAGES.unavailable;
  if (/authentication required/i.test(detail)) return CHANGE_REQUEST_MESSAGES.expired;
  return fallback;
}

/**
 * Propose a change against a terminal item.
 *
 * `targetItemId` is a parameter, not a form field: the caller (the item's own
 * inspector, or the question that motivated it) already knows which item, and a form
 * that also sent one would be a value nobody asked it to choose.
 */
export async function openChangeRequest(
  client: SupabaseClient,
  targetItemId: string,
  rawInput: OpenChangeRequestInput | unknown,
): Promise<ServiceResult<OpenChangeRequestResult>> {
  const parsed = openChangeRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: CHANGE_REQUEST_MESSAGES.invalid, fieldErrors: changeRequestFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const { data, error } = await client.rpc("open_change_request", {
    p_target_item_id: targetItemId,
    p_proposed_title: input.proposedTitle,
    p_proposed_description: input.proposedDescription,
    p_proposed_priority: input.proposedPriority,
    p_reason: input.reason,
    p_source_question_id: input.sourceQuestionId,
  });

  if (error) {
    return failure("open", error.message, translateChangeRequestError(error.message, CHANGE_REQUEST_MESSAGES.openFailed));
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      changeRequestId: String(row.change_request_id ?? ""),
      targetItemId: String(row.target_item_id ?? targetItemId),
      status: (row.status as ChangeRequestStatus) ?? "pending",
    },
  };
}

/**
 * Approve or reject a pending change request.
 *
 * On approval, the item's title/description/priority move to the proposed values and
 * a new version is snapshotted — the item's `status` never changes. On rejection,
 * only the change request itself is touched.
 */
export async function resolveChangeRequest(
  client: SupabaseClient,
  rawInput: ResolveChangeRequestInput | unknown,
): Promise<ServiceResult<ResolveChangeRequestResult>> {
  const parsed = resolveChangeRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: CHANGE_REQUEST_MESSAGES.invalid, fieldErrors: changeRequestFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const { data, error } = await client.rpc("resolve_change_request", {
    p_change_request_id: input.changeRequestId,
    p_decision: input.decision,
    p_resolution_note: input.resolutionNote,
  });

  if (error) {
    return failure(
      "resolve",
      error.message,
      translateChangeRequestError(error.message, CHANGE_REQUEST_MESSAGES.resolveFailed),
    );
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      changeRequestId: String(row.change_request_id ?? input.changeRequestId),
      decision: (row.decision as "approved" | "rejected") ?? input.decision,
      appliedVersionNo: row.applied_version_no == null ? null : Number(row.applied_version_no),
    },
  };
}

/** Cancel one's own still-pending change request. Touches only the change request. */
export async function withdrawChangeRequest(
  client: SupabaseClient,
  rawInput: WithdrawChangeRequestInput | unknown,
): Promise<ServiceResult<WithdrawChangeRequestResult>> {
  const parsed = withdrawChangeRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: CHANGE_REQUEST_MESSAGES.invalid, fieldErrors: changeRequestFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const { data, error } = await client.rpc("withdraw_change_request", {
    p_change_request_id: input.changeRequestId,
  });

  if (error) {
    return failure(
      "withdraw",
      error.message,
      translateChangeRequestError(error.message, CHANGE_REQUEST_MESSAGES.withdrawFailed),
    );
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      changeRequestId: String(row.change_request_id ?? input.changeRequestId),
      status: (row.status as ChangeRequestStatus) ?? "withdrawn",
    },
  };
}
