/**
 * Answering questions and resolving quality findings.
 *
 * The same shape as `lib/review/service.ts`, for the same reasons: one RPC call each on
 * a **user-scoped** client, no service role anywhere in this file, and a translation
 * layer whose only job is to turn a Postgres refusal into a sentence a person can act
 * on. The user never sees a SQLSTATE, a function name, a table, a trigger or a policy.
 *
 * Why one call and not several: a workflow move is a state change **and** an append to
 * the audit log. Two statements from Node can succeed in part, and an answer with no
 * activity beside it is precisely the hole an append-only log exists to prevent. One
 * function call is a transaction.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findingActionSchema,
  questionActionSchema,
  type FindingActionInput,
  type QuestionActionInput,
  type WorkflowState,
} from "../contracts/workflow";
import { reviewFieldErrors } from "../contracts/review";
import type { ServiceResult } from "./service";

export type WorkflowResult = {
  itemId: string;
  fromState: WorkflowState;
  toState: WorkflowState;
};

/** Every sentence a workflow refusal can produce, in one place. */
export const WORKFLOW_MESSAGES = {
  questionUnavailable: "This question is unavailable.",
  findingUnavailable: "This finding is unavailable.",
  readOnlyProject: "This project is archived and read-only. Restore it to make changes.",
  conflict: "This item changed while you were working. Reload the latest state before continuing.",
  transition: "This workflow transition is not allowed.",
  answerRequired: "An answer is required.",
  noteRequired: "A resolution note is required.",
  wrongType: "This item uses a different workflow.",
  followUp: "A follow-up date only applies to a deferred question.",
  failed: "The workflow action could not be completed.",
  invalid: "Some fields need attention.",
  expired: "Your session has expired. Sign in again.",
} as const;

function failure(context: string, detail: string, message: string): ServiceResult<never> {
  console.error(`[workflow] ${context}: ${detail}`);
  return { ok: false, error: message };
}

/**
 * A refusal from the database, translated.
 *
 * Matched on text rather than SQLSTATE for the same reason the review service is:
 * several distinct rules share `restrict_violation`, so the code says "a rule stopped
 * you" and only the text says which. The conflict also carries `PT409` and is matched
 * on text as well, so a driver that reshapes the error still lands on the right
 * sentence.
 */
export function translateWorkflowError(detail: string, fallback: string): string {
  if (/workflow conflict/i.test(detail)) return WORKFLOW_MESSAGES.conflict;
  if (/archived/i.test(detail)) return WORKFLOW_MESSAGES.readOnlyProject;
  if (/not a stakeholder question|not a quality finding/i.test(detail)) return WORKFLOW_MESSAGES.wrongType;
  if (/different workflow/i.test(detail)) return WORKFLOW_MESSAGES.wrongType;
  if (/follow-up date/i.test(detail)) return WORKFLOW_MESSAGES.followUp;
  if (/answer or reason is required/i.test(detail)) return WORKFLOW_MESSAGES.answerRequired;
  if (/resolution note is required/i.test(detail)) return WORKFLOW_MESSAGES.noteRequired;
  if (/invalid workflow transition/i.test(detail)) return WORKFLOW_MESSAGES.transition;
  if (/question not found|question .*not visible/i.test(detail)) return WORKFLOW_MESSAGES.questionUnavailable;
  if (/finding not found|finding .*not visible/i.test(detail)) return WORKFLOW_MESSAGES.findingUnavailable;
  if (/authentication required/i.test(detail)) return WORKFLOW_MESSAGES.expired;
  return fallback;
}

/**
 * Record a decision about a stakeholder question.
 *
 * The answer text is *not* written into the requirement it came from, and no
 * requirement is created, changed or re-statused by this call. That is the whole point
 * of the slice: an answer is evidence for a future change request, never the change.
 */
export async function resolveQuestion(
  client: SupabaseClient,
  itemId: string,
  rawInput: QuestionActionInput | unknown,
): Promise<ServiceResult<WorkflowResult>> {
  const parsed = questionActionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: WORKFLOW_MESSAGES.invalid, fieldErrors: reviewFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const { data, error } = await client.rpc("resolve_open_question", {
    p_item_id: itemId,
    p_expected_state: input.expectedState,
    p_to_state: input.toState,
    p_answer: input.answer,
    p_follow_up_on: input.followUpOn,
  });

  if (error) {
    return failure("question", error.message, translateWorkflowError(error.message, WORKFLOW_MESSAGES.failed));
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      itemId,
      fromState: (row.from_state as WorkflowState) ?? input.expectedState,
      toState: (row.to_state as WorkflowState) ?? input.toState,
    },
  };
}

export async function updateFinding(
  client: SupabaseClient,
  itemId: string,
  rawInput: FindingActionInput | unknown,
): Promise<ServiceResult<WorkflowResult>> {
  const parsed = findingActionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: WORKFLOW_MESSAGES.invalid, fieldErrors: reviewFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const { data, error } = await client.rpc("update_quality_finding", {
    p_item_id: itemId,
    p_expected_state: input.expectedState,
    p_to_state: input.toState,
    p_note: input.note,
  });

  if (error) {
    return failure("finding", error.message, translateWorkflowError(error.message, WORKFLOW_MESSAGES.failed));
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      itemId,
      fromState: (row.from_state as WorkflowState) ?? input.expectedState,
      toState: (row.to_state as WorkflowState) ?? input.toState,
    },
  };
}
