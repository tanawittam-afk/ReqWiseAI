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
