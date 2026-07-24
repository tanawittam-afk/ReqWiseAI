"use server";

/**
 * Runs a deterministic mock analysis over one source revision and persists it.
 *
 * Every fact the pipeline runs on is re-read from the database here, through the
 * caller's own client — the confirmation form supplies only the route addresses and
 * an idempotency token, never source text, a domain profile, or an organization id.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildAnalysisInput } from "@/lib/analysis/input";
import { productionPorts } from "@/lib/analysis/production-ports";
import { persistAnalysisResult } from "@/lib/analysis/persist";
import { runAnalysis } from "@/lib/analysis/run-analysis";
import { createMockProvider } from "@/lib/providers/mock/mock-provider";
import type { AnalyzeFormState } from "./form-state";

export async function analyzeSourceAction(
  _prev: AnalyzeFormState,
  formData: FormData,
): Promise<AnalyzeFormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  const requestKey = String(formData.get("requestKey") ?? "");

  if (requestKey.length < 8) {
    return { error: "This confirmation has expired. Reload the page and try again." };
  }

  const supabase = await createClient();

  const built = await buildAnalysisInput(supabase, projectId, sourceId);
  if (!built.ok) return { error: built.error };

  const provider = createMockProvider();
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
