/**
 * The provider boundary.
 *
 * A provider knows nothing about React, Next.js, Supabase, PostgreSQL, database
 * entities, display IDs, or review status. It receives an analysis input and
 * returns a raw, untrusted output together with the execution metadata needed
 * to trace the provider boundary safely.
 *
 * `ProviderGeneration.raw` is `unknown` on purpose. That is the strongest
 * available statement that model output is untrusted: a caller cannot read a
 * field off it without going through `validateAnalysis` first.
 */

import type { AnalysisInput } from "../contracts/analysis-input";

export const PROVIDER_KEYS = ["mock", "gemini"] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

export type ProviderMetadata = {
  provider: ProviderKey;
  model: string | null;
  promptVersion: string | null;
};

export type ProviderGeneration = {
  raw: unknown;
  metadata: ProviderMetadata;
};

/** One candidate statement the code-only gap-check step found uncovered by any
 *  citation — text only; the provider never sees offsets or item ids. */
export type GapCandidate = { key: string; text: string };

export interface AiProvider {
  readonly name: ProviderKey;
  /** True when the same input always produces byte-identical output. */
  readonly deterministic: boolean;
  generate(input: AnalysisInput): Promise<ProviderGeneration>;
  /**
   * Phase 3's gap-filter step — a second, independent call, not a field on
   * `generate()`'s output. `raw` is validated against `gapFilterOutputSchema`
   * (`lib/contracts/gap-filter-output.ts`) by the caller, exactly like `generate()`'s
   * output is validated by `validateAnalysis` — no fast path for either provider.
   */
  filterCoverageGaps(candidates: GapCandidate[], input: AnalysisInput): Promise<ProviderGeneration>;
}
