"use server";

/**
 * Project mutations. Every one of them runs on the user-scoped Supabase client, so
 * RLS decides what is reachable — there is no service-role client in this path.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  archiveProjectInputSchema,
  createProjectInputSchema,
  fieldErrors,
  readCreateProjectForm,
} from "@/lib/contracts/project";
import type { SourceContentInput } from "@/lib/contracts/source";
import { readStartForm } from "@/lib/contracts/start";
import { archiveProject, createProject, restoreProject } from "@/lib/projects/service";
import { createSource } from "@/lib/sources/service";
import { buildAnalysisInput } from "@/lib/analysis/input";
import { productionPorts } from "@/lib/analysis/production-ports";
import { persistAnalysisResult } from "@/lib/analysis/persist";
import { runAnalysis } from "@/lib/analysis/run-analysis";
import { availableDefaultProvider, readServerEnvironment } from "@/lib/config/env";
import { unavailableProviderMessage } from "@/lib/providers/errors";
import { createProvider } from "@/lib/providers/factory";
import { listDomainProfileOptions } from "@/lib/domain/load-profile";
import {
  bookingMeetingNotes,
  bookingSourceDocument,
} from "@/lib/providers/mock/fixtures/booking-smart-space.source";
import type { ProjectFormState } from "./form-state";

const PROJECT_FIELDS = [
  "name",
  "domainProfileId",
  "outputLang",
  "description",
  "businessObjective",
  "knownStakeholders",
];

const SOURCE_FIELDS = ["title", "kind", "rawText", "sourceDate", "stakeholder", "notes"];

/** Only the fields the form owns are echoed back — never a client-supplied extra. */
function echoFields(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")]));
}

function echo(formData: FormData): Record<string, string> {
  return echoFields(formData, PROJECT_FIELDS);
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

/**
 * Project, source and first analysis in one submission.
 *
 * This is the combined intake screen's action. It creates nothing that
 * `createProjectAction` + `createSourceAction` + `analyzeSourceAction` would not have
 * created one at a time — the same three services, the same schemas, the same
 * user-scoped client. What changes is that the user answers once.
 *
 * The provider is **not** read from the form. It is resolved server-side by
 * `availableDefaultProvider()`, because the intake screen offers no choice; the
 * explicit choice still lives on the re-run screen (`.../analyze`).
 *
 * **Once the project row exists, this action never returns to the form.** A returned
 * error would invite a resubmit, and a resubmit would create a second project — so
 * every failure after that point redirects to the furthest thing that does exist,
 * carrying an `?error=` the destination explains. Nothing is left stranded and nothing
 * is silently duplicated.
 */
export async function startProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const values = { ...echoFields(formData, PROJECT_FIELDS), ...echoFields(formData, SOURCE_FIELDS) };

  const parsed = readStartForm(formData);
  if (!parsed.ok) {
    return { error: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors, values };
  }

  const requestKey = String(formData.get("requestKey") ?? "");
  if (requestKey.length < 8) {
    return {
      error: "This page has expired. Reload it and try again.",
      fieldErrors: {},
      values,
    };
  }

  const supabase = await createClient();
  const created = await createProject(supabase, parsed.project);
  if (!created.ok) {
    return { error: created.error, fieldErrors: created.fieldErrors ?? {}, values };
  }

  // Past this line, redirect — never return.
  const destination = await createSourceAndAnalyse(
    supabase,
    created.data.projectId,
    parsed.source,
    requestKey,
    availableDefaultProvider(readServerEnvironment()),
  );
  redirect(destination);
}

/**
 * One click, no typing: the sample booking notes, analysed.
 *
 * The provider is **forced to `mock`** rather than resolved from the environment. This
 * is a button anyone signed in can press repeatedly, and pointing it at a metered model
 * would turn it into an unmetered spend endpoint. The mock provider genuinely analyses
 * the text it is given, so the result is real output, not a replayed fixture.
 */
export async function startExampleAction(): Promise<void> {
  const supabase = await createClient();

  const profiles = await listDomainProfileOptions(supabase);
  const booking = profiles.find((profile) => profile.key === "booking_smart_space");
  if (!booking) redirect("/workspace/projects/new?error=example");

  const created = await createProject(supabase, {
    name: "ตัวอย่าง: ระบบจองพื้นที่ Smart Space",
    domainProfileId: booking.id,
    outputLang: "th",
    description:
      "โปรเจกต์ตัวอย่าง สร้างอัตโนมัติจากบันทึกการประชุมตัวอย่างของ ReqWise AI — ลบหรือเก็บเข้าคลังได้ทุกเมื่อ",
    businessObjective: null,
    knownStakeholders: [],
  });
  if (!created.ok) redirect("/workspace/projects?error=example");

  const destination = await createSourceAndAnalyse(
    supabase,
    created.data.projectId,
    {
      title: bookingSourceDocument.title,
      kind: "meeting_notes",
      rawText: bookingMeetingNotes,
      sourceDate: null,
      stakeholder: null,
      notes: null,
    },
    crypto.randomUUID(),
    "mock",
  );
  redirect(destination);
}

/**
 * The shared tail of both intake paths: attach the source, run the analysis, and answer
 * with the URL to send the user to. Returns a destination rather than redirecting itself
 * — `redirect()` throws, and a throw from inside a helper is far easier to catch by
 * accident than one at the top of an action.
 */
async function createSourceAndAnalyse(
  supabase: SupabaseClient,
  projectId: string,
  source: SourceContentInput,
  requestKey: string,
  providerKey: "mock" | "gemini",
): Promise<string> {
  const projectHref = `/workspace/projects/${projectId}`;

  const attached = await createSource(supabase, projectId, source);
  if (!attached.ok) return `${projectHref}?error=source`;
  const sourceHref = `${projectHref}/sources/${attached.data.sourceId}`;

  const built = await buildAnalysisInput(supabase, projectId, attached.data.sourceId);
  if (!built.ok) return `${sourceHref}?error=analysis`;

  let result;
  try {
    result = await runAnalysis(
      createProvider(providerKey, readServerEnvironment()),
      built.input,
      productionPorts(),
    );
  } catch (error) {
    // An unavailable provider is a configuration fact, not something the user typed.
    // The source is saved; the re-run screen is where it can be tried again.
    console.error(`[projects] analyse: ${unavailableProviderMessage(error)}`);
    return `${sourceHref}?error=analysis`;
  }

  // An `invalid` or `provider_error` run is persisted with a run id and shown honestly —
  // that is designed behaviour, not a failure path.
  const outcome = await persistAnalysisResult(
    supabase,
    projectId,
    attached.data.sourceId,
    requestKey,
    built.input,
    result,
  );
  if (!outcome.ok) return `${sourceHref}?error=analysis`;

  revalidatePath("/workspace/projects");
  revalidatePath(projectHref);
  revalidatePath(`${projectHref}/sources`);
  return `${projectHref}/analyses/${outcome.runId}`;
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
