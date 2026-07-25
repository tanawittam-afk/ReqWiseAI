"use server";

/**
 * Requirement editing and review.
 *
 * The item id arrives from the form as an *address* and is never trusted as an
 * authorization: `edit_analysis_item` and `review_item` both re-derive the project,
 * the membership, the project's status, the item's type and its current version from
 * the database under `auth.uid()`. An id belonging to another tenant resolves to
 * "unavailable", which is why submitting somebody else's id achieves nothing rather
 * than something bad.
 *
 * Neither action takes a status as an instruction it will simply obey — the database
 * decides whether the move is legal from where the item actually is, not from where
 * the page thought it was when it rendered.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readItemEditForm, readReviewActionForm } from "@/lib/contracts/review";
import { editItem, reviewItem, REVIEW_MESSAGES } from "@/lib/review/service";
import { resolveQuestion, updateFinding, WORKFLOW_MESSAGES } from "@/lib/review/workflow-service";
import { readFindingActionForm, readQuestionActionForm } from "@/lib/contracts/workflow";
import { EMPTY_REVIEW_STATE, type ReviewFormState } from "./form-state";

function revalidateRun(projectId: string, runId: string): void {
  revalidatePath(`/workspace/projects/${projectId}/analyses/${runId}`);
}

export async function editItemAction(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const runId = String(formData.get("runId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { ...EMPTY_REVIEW_STATE, error: REVIEW_MESSAGES.unavailable };

  const supabase = await createClient();
  const result = await editItem(supabase, itemId, readItemEditForm(formData));

  if (!result.ok) {
    return { ok: false, message: null, error: result.error, fieldErrors: result.fieldErrors ?? {} };
  }

  revalidateRun(projectId, runId);
  return {
    ok: true,
    // The reset is reported because it is a consequence the reviewer did not ask for
    // and must not discover later: their own review no longer describes this text.
    message: result.data.statusReset
      ? `Saved as version ${result.data.versionNo}. The review was cleared, so this requirement is a draft again.`
      : `Saved as version ${result.data.versionNo}.`,
    error: null,
    fieldErrors: {},
  };
}

export async function reviewItemAction(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const runId = String(formData.get("runId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { ...EMPTY_REVIEW_STATE, error: REVIEW_MESSAGES.unavailable };

  const supabase = await createClient();
  const result = await reviewItem(supabase, itemId, readReviewActionForm(formData));

  if (!result.ok) {
    return { ok: false, message: null, error: result.error, fieldErrors: result.fieldErrors ?? {} };
  }

  revalidateRun(projectId, runId);
  return {
    ok: true,
    message: OUTCOME_MESSAGE[result.data.toStatus] ?? "Review recorded.",
    error: null,
    fieldErrors: {},
  };
}

const OUTCOME_MESSAGE: Record<string, string> = {
  reviewed: "Marked as reviewed.",
  needs_clarification: "Clarification requested.",
  approved: "Approved. This requirement is now read-only.",
  rejected: "Rejected. This requirement is now read-only.",
};

/**
 * Record a decision about a stakeholder question.
 *
 * Deliberately does **not** touch any requirement. An answer is evidence a requirement
 * may need to change; turning it into that change is a change-request workflow with its
 * own audit trail, and is not this slice.
 */
export async function resolveQuestionAction(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const runId = String(formData.get("runId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { ...EMPTY_REVIEW_STATE, error: WORKFLOW_MESSAGES.questionUnavailable };

  const supabase = await createClient();
  const result = await resolveQuestion(supabase, itemId, readQuestionActionForm(formData));

  if (!result.ok) {
    return { ok: false, message: null, error: result.error, fieldErrors: result.fieldErrors ?? {} };
  }

  revalidateRun(projectId, runId);
  return {
    ok: true,
    message: QUESTION_OUTCOME[result.data.toState] ?? "Question updated.",
    error: null,
    fieldErrors: {},
  };
}

export async function updateFindingAction(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const runId = String(formData.get("runId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { ...EMPTY_REVIEW_STATE, error: WORKFLOW_MESSAGES.findingUnavailable };

  const supabase = await createClient();
  const result = await updateFinding(supabase, itemId, readFindingActionForm(formData));

  if (!result.ok) {
    return { ok: false, message: null, error: result.error, fieldErrors: result.fieldErrors ?? {} };
  }

  revalidateRun(projectId, runId);
  return {
    ok: true,
    message: FINDING_OUTCOME[result.data.toState] ?? "Finding updated.",
    error: null,
    fieldErrors: {},
  };
}

const QUESTION_OUTCOME: Record<string, string> = {
  answered: "Answer recorded.",
  deferred: "Question deferred.",
  not_applicable: "Marked as not applicable.",
  open: "Question reopened.",
};

const FINDING_OUTCOME: Record<string, string> = {
  acknowledged: "Finding acknowledged. It is still open until it is resolved or dismissed.",
  resolved: "Finding resolved.",
  dismissed: "Finding dismissed.",
  open: "Finding reopened.",
};
