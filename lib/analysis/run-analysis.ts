/**
 * The pure core of an analysis run: provider → validate → normalize.
 *
 * No database, no auth, no HTTP. Persistence (writing the run and its items in one
 * transaction) is a later phase that wraps this. Keeping it pure is what lets the
 * whole thing be tested deterministically with the mock provider.
 */

import type { AnalysisInput } from "../contracts/analysis-input";
import type { NormalizedAnalysis } from "../contracts/normalized";
import type { ValidationIssue } from "../contracts/validation-result";
import { normalizeAnalysis } from "../normalization/normalize";
import type { NormalizationPorts } from "../normalization/ports";
import type { AiProvider } from "../providers/types";
import { validateAnalysis } from "../validation/validate-analysis";

export type RunAnalysisResult =
  | { status: "valid"; raw: unknown; analysis: NormalizedAnalysis }
  | { status: "invalid"; raw: unknown; issues: ValidationIssue[] }
  | { status: "provider_error"; error: string };

/**
 * Note the three distinct outcomes, mirroring `analysis_runs.validation_status`:
 *
 *  - `provider_error`  the provider never returned usable output (thrown/timeout)
 *  - `invalid`         output arrived but failed validation — kept as evidence
 *  - `valid`           output passed; a normalized analysis is produced
 *
 * `raw` is returned in both non-error cases so the caller can persist exactly what
 * the provider said, whatever happened afterwards.
 */
export async function runAnalysis(
  provider: AiProvider,
  input: AnalysisInput,
  ports: NormalizationPorts,
): Promise<RunAnalysisResult> {
  let raw: unknown;
  try {
    raw = await provider.generate(input);
  } catch (err) {
    return { status: "provider_error", error: err instanceof Error ? err.message : String(err) };
  }

  const validated = validateAnalysis(raw, input.sourceDocuments);
  if (!validated.ok) {
    return { status: "invalid", raw, issues: validated.issues };
  }

  const analysis = normalizeAnalysis(validated.value, input.sourceDocuments, ports);
  return { status: "valid", raw, analysis };
}
