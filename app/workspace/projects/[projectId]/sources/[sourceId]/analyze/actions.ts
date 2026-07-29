"use server";

/**
 * Runs the explicitly selected analysis provider over one source revision and
 * persists it.
 *
 * Every fact the pipeline runs on is re-read from the database here, through the
 * caller's own client — the confirmation form supplies only the route addresses and
 * an idempotency token, never source text, a domain profile, or an organization id.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readAnalysisActionInput } from "@/lib/analysis/action-input";
import { buildAnalysisInput } from "@/lib/analysis/input";
import { productionPorts } from "@/lib/analysis/production-ports";
import { persistAnalysisResult } from "@/lib/analysis/persist";
import { runAnalysis } from "@/lib/analysis/run-analysis";
import { readServerEnvironment } from "@/lib/config/env";
import { unavailableProviderMessage } from "@/lib/providers/errors";
import { createProvider } from "@/lib/providers/factory";
import type { AiProvider } from "@/lib/providers/types";
import type { AnalyzeFormState } from "./form-state";

export async function analyzeSourceAction(
  _prev: AnalyzeFormState,
  formData: FormData,
): Promise<AnalyzeFormState> {
  const parsed = readAnalysisActionInput(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { projectId, sourceId, requestKey, provider: providerKey } = parsed.value;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "Your session has expired. Sign in again." };
  }

  const built = await buildAnalysisInput(supabase, projectId, sourceId);
  if (!built.ok) return { error: built.error };

  const environment = readServerEnvironment();
  let provider: AiProvider;
  try {
    provider = createProvider(providerKey, environment);
  } catch (error) {
    return { error: unavailableProviderMessage(error) };
  }
  const result = await runAnalysis(provider, built.input, productionPorts());

  const outcome = await persistAnalysisResult(
    supabase,
    projectId,
    sourceId,
    requestKey,
    built.input,
    result,
  );
  if (!outcome.ok) return { error: outcome.error };

  revalidatePath(`/workspace/projects/${projectId}/sources/${sourceId}`);
  revalidatePath(`/workspace/projects/${projectId}`);
  redirect(`/workspace/projects/${projectId}/analyses/${outcome.runId}`);
}
