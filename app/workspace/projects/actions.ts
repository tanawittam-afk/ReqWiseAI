"use server";

/**
 * Project mutations. Every one of them runs on the user-scoped Supabase client, so
 * RLS decides what is reachable — there is no service-role client in this path.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  archiveProjectInputSchema,
  createProjectInputSchema,
  fieldErrors,
  readCreateProjectForm,
} from "@/lib/contracts/project";
import { archiveProject, createProject, restoreProject } from "@/lib/projects/service";
import type { ProjectFormState } from "./form-state";

/** Only the fields the form owns are echoed back — never a client-supplied extra. */
function echo(formData: FormData): Record<string, string> {
  const keys = [
    "name",
    "domainProfileId",
    "outputLang",
    "description",
    "businessObjective",
    "knownStakeholders",
  ];
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")]));
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const values = echo(formData);
  const parsed = createProjectInputSchema.safeParse(readCreateProjectForm(formData));

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values,
    };
  }

  const supabase = await createClient();
  const result = await createProject(supabase, parsed.data);
  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors ?? {}, values };
  }

  revalidatePath("/workspace/projects");
  redirect(`/workspace/projects/${result.data.projectId}`);
}

export async function archiveProjectAction(formData: FormData): Promise<void> {
  const parsed = archiveProjectInputSchema.safeParse({
    projectId: String(formData.get("projectId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) redirect("/workspace/projects");

  const supabase = await createClient();
  const result = await archiveProject(supabase, parsed.data);

  revalidatePath("/workspace/projects");
  revalidatePath(`/workspace/projects/${parsed.data.projectId}`);
  redirect(
    result.ok
      ? `/workspace/projects/${parsed.data.projectId}`
      : `/workspace/projects/${parsed.data.projectId}?error=archive`,
  );
}

export async function restoreProjectAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) redirect("/workspace/projects");

  const supabase = await createClient();
  const result = await restoreProject(supabase, projectId);

  revalidatePath("/workspace/projects");
  revalidatePath(`/workspace/projects/${projectId}`);
  redirect(
    result.ok
      ? `/workspace/projects/${projectId}`
      : `/workspace/projects/${projectId}?error=restore`,
  );
}
