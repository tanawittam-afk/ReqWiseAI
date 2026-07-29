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

export interface AiProvider {
  readonly name: ProviderKey;
  /** True when the same input always produces byte-identical output. */
  readonly deterministic: boolean;
  generate(input: AnalysisInput): Promise<ProviderGeneration>;
}
