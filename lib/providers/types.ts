/**
 * The provider boundary.
 *
 * A provider knows nothing about React, Next.js, Supabase, PostgreSQL, database
 * entities, display IDs, or review status. It receives an analysis input and
 * returns raw output.
 *
 * `generate` returns `unknown` on purpose. That is the strongest available
 * statement that the result is untrusted: a caller cannot read a field off it
 * without going through `validateAnalysis` first.
 */

import type { AnalysisInput } from "../contracts/analysis-input";

export interface AiProvider {
  readonly name: string;
  /** True when the same input always produces byte-identical output. */
  readonly deterministic: boolean;
  generate(input: AnalysisInput): Promise<unknown>;
}
