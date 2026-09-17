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
import { decrementDailyUsage, incrementDailyUsage } from "@/lib/analysis/daily-usage";
import { getOwnGeminiApiKey, OWN_KEY_UNUSABLE_MESSAGE } from "@/lib/analysis/own-gemini-key";
import { DAILY_ANALYSIS_LIMIT } from "@/lib/config/limits";
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

  // Own-key bypass (Phase 1, Slice 3). Only looked up for a Gemini run — bringing your
  // own key bypasses the *Gemini* metering it corresponds to, never a free mock run's
  // limit; that would be a loophole, not a feature.
  let ownApiKey: string | undefined;
  if (providerKey === "gemini") {
    const ownKey = await getOwnGeminiApiKey(supabase, environment.geminiKeyEncryption.secret);
    if (!ownKey.ok) return { error: ownKey.error };
    ownApiKey = ownKey.apiKey ?? undefined;
  }
  const usingOwnKey = ownApiKey !== undefined;

  // Checked (and spent, atomically) only once the project/source are known valid, and
  // only when this run is not already paid for by the caller's own key — no point
  // spending a shared slot on a request that never touches the shared limit.
  if (!usingOwnKey) {
    const usage = await incrementDailyUsage(supabase, DAILY_ANALYSIS_LIMIT);
    if (!usage.ok) return { error: usage.error };
    if (!usage.data.allowed) {
      return {
        error:
          `You have reached today's limit of ${DAILY_ANALYSIS_LIMIT} analyses ` +
          `(${DAILY_ANALYSIS_LIMIT}/${DAILY_ANALYSIS_LIMIT} used). It resets at midnight, Bangkok time.`,
      };
    }
  }

  let provider: AiProvider;
  try {
    provider = createProvider(providerKey, environment, undefined, ownApiKey);
  } catch (error) {
    if (!usingOwnKey) await decrementDailyUsage(supabase);
    return { error: usingOwnKey ? OWN_KEY_UNUSABLE_MESSAGE : unavailableProviderMessage(error) };
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
  if (!outcome.ok) {
    if (!usingOwnKey) await decrementDailyUsage(supabase);
    return { error: outcome.error };
  }

  revalidatePath(`/workspace/projects/${projectId}/sources/${sourceId}`);
  revalidatePath(`/workspace/projects/${projectId}`);
  redirect(`/workspace/projects/${projectId}/analyses/${outcome.runId}`);
}
