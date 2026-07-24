"use server";

/**
 * Source mutations.
 *
 * The project id and the source id come from the form only as *addresses*, and every
 * one of them is re-resolved against the database through the user-scoped client
 * before anything is written. An address a user cannot reach resolves to nothing,
 * which is why passing someone else's id achieves nothing rather than something bad.
 *
 * The save action does not take "edit" or "revise" as an instruction. It asks the
 * database whether the revision is locked and picks the path itself — a client that
 * claims a locked revision is editable is simply wrong, and being wrong should not
 * change the outcome.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  sourceContentSchema,
  readSourceForm,
  sourceFieldErrors,
} from "@/lib/contracts/source";
import { createSource, createSourceRevision, updateSource } from "@/lib/sources/service";
import { getSource } from "@/lib/sources/queries";
import type { SourceFormState } from "./form-state";

/** Only the fields the form owns are echoed back — never a client-supplied extra. */
function echo(formData: FormData): Record<string, string> {
  const keys = ["title", "kind", "rawText", "sourceDate", "stakeholder", "notes"];
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")]));
}

export async function createSourceAction(
  _prev: SourceFormState,
  formData: FormData,
): Promise<SourceFormState> {
  const values = echo(formData);
  const projectId = String(formData.get("projectId") ?? "");
  const parsed = sourceContentSchema.safeParse(readSourceForm(formData));

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: sourceFieldErrors(parsed.error),
      values,
    };
  }

  const supabase = await createClient();
  const result = await createSource(supabase, projectId, parsed.data);
  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors ?? {}, values };
  }

  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/workspace/projects/${projectId}/sources`);
  redirect(`/workspace/projects/${projectId}/sources/${result.data.sourceId}`);
}

export async function saveSourceAction(
  _prev: SourceFormState,
  formData: FormData,
): Promise<SourceFormState> {
  const values = echo(formData);
  const projectId = String(formData.get("projectId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  const parsed = sourceContentSchema.safeParse(readSourceForm(formData));

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: sourceFieldErrors(parsed.error),
      values,
    };
  }

  const supabase = await createClient();

  // Whether this becomes an edit or a new revision is a database fact, read now —
  // not the intention the page had when it was rendered.
  const current = await getSource(supabase, projectId, sourceId);
  if (!current) {
    return { error: "This source is not available.", fieldErrors: {}, values };
  }

  const result = current.locked
    ? await createSourceRevision(supabase, projectId, sourceId, parsed.data)
    : await updateSource(supabase, projectId, sourceId, parsed.data);

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors ?? {}, values };
  }

  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/workspace/projects/${projectId}/sources`);
  revalidatePath(`/workspace/projects/${projectId}/sources/${sourceId}`);
  redirect(`/workspace/projects/${projectId}/sources/${result.data.sourceId}`);
}
