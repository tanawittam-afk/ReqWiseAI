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
import { normalizeAnalysis } from "../normalization/normalize.ts";
import type { NormalizationPorts } from "../normalization/ports";
import {
  ProviderExecutionError,
  safeProviderMessage,
  type ProviderErrorCategory,
} from "../providers/errors.ts";
import type { AiProvider, ProviderMetadata } from "../providers/types";
import { validateAnalysis } from "../validation/validate-analysis.ts";

export type RunAnalysisResult =
  | { status: "valid"; raw: unknown; analysis: NormalizedAnalysis; metadata: ProviderMetadata }
  | { status: "invalid"; raw: unknown; issues: ValidationIssue[]; metadata: ProviderMetadata }
  | {
      status: "provider_error";
      error: { category: ProviderErrorCategory; message: string };
      metadata: ProviderMetadata;
    };

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
  let generation;
  try {
    generation = await provider.generate(input);
  } catch (error) {
    if (error instanceof ProviderExecutionError) {
      return {
        status: "provider_error",
        error: { category: error.category, message: safeProviderMessage(error.category) },
        metadata: error.metadata,
      };
    }

    return {
      status: "provider_error",
      error: { category: "unknown", message: safeProviderMessage("unknown") },
      metadata: { provider: provider.name, model: null, promptVersion: null },
    };
  }

  const validated = validateAnalysis(generation.raw, input.sourceDocuments);
  if (!validated.ok) {
    return {
      status: "invalid",
      raw: generation.raw,
      issues: validated.issues,
      metadata: generation.metadata,
    };
  }

  const analysis = normalizeAnalysis(validated.value, input.sourceDocuments, ports);
  return { status: "valid", raw: generation.raw, analysis, metadata: generation.metadata };
}
