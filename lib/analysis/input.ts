/**
 * Builds the `AnalysisInput` a provider runs over, entirely from server-side reads.
 *
 * Every fact in the input is re-read from the database through the caller's own
 * client — never accepted from the request that triggered the run. This is what
 * "the server loads source and project fresh every time" means in practice: even if
 * the confirmation form somehow carried a project name or a domain profile, this
 * module would not look at it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisInput } from "../contracts/analysis-input";
import { loadDomainProfileByKey } from "../domain/load-profile";
import { getProject } from "../projects/queries";
import { getSource } from "../sources/queries";
import { GATE_MESSAGES } from "../projects/guards";

/**
 * The provider-facing key for the single source document in this input. It never
 * leaves the server and carries no persisted meaning (SourceDocumentInput.key is
 * scoped to one analysis call). It is pinned to this literal because the shipped
 * mock provider is a scripted fixture for the Booking and Smart Space domain and
 * only cites this exact key — see lib/providers/mock/fixtures/booking-smart-space
 * .source.ts:15. A real provider would echo back whatever key it was given; this
 * one does not, which is a known limitation of a deterministic demo mock, not
 * something this layer should special-case around.
 */
const ANALYSIS_SOURCE_KEY = "meeting-notes-1";

export type AnalysisInputResult =
  | { ok: true; input: AnalysisInput; sourceTitle: string; projectName: string }
  | { ok: false; error: string };

/**
 * Loads project, source and domain profile and assembles them into an
 * `AnalysisInput`. Refuses (rather than throws) for every condition a confirmation
 * screen needs a sentence for: missing/invisible project or source, an archived
 * project, and a source with no text to analyse.
 */
export async function buildAnalysisInput(
  client: SupabaseClient,
  projectId: string,
  sourceId: string,
): Promise<AnalysisInputResult> {
  const [project, source] = await Promise.all([
    getProject(client, projectId),
    getSource(client, projectId, sourceId),
  ]);

  if (!project || !source) return { ok: false, error: "This source is not available." };
  if (project.status === "archived") return { ok: false, error: GATE_MESSAGES.archived };
  if (source.rawText.trim() === "") {
    return { ok: false, error: "This source has no text yet — add content before analysing it." };
  }
  if (!project.domain) return { ok: false, error: "This project has no domain profile set." };

  const domainProfile = await loadDomainProfileByKey(client, project.domain.key);

  return {
    ok: true,
    sourceTitle: source.title,
    projectName: project.name,
    input: {
      domainProfile,
      sourceDocuments: [
        { key: ANALYSIS_SOURCE_KEY, id: source.id, title: source.title, text: source.rawText },
      ],
      outputLang: project.outputLang,
      projectContext: { name: project.name, description: project.description ?? undefined },
    },
  };
}
