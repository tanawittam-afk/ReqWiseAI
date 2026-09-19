/**
 * The deterministic mock provider.
 *
 * It is what makes the vertical slices buildable and testable with no key, no
 * network, and no cost. It is a pure function of its input: no `Date.now`, no
 * `Math.random`, no environment reads. The same input always returns the same raw
 * output.
 *
 * **It analyses the text it is given.** Until slice 4.1 it replayed a canned fixture,
 * which meant a real user's meeting notes produced citations into a document they had
 * never seen — an `invalid` run for every source but one. The generation rules now
 * live in `runtime/strategy.ts` and read the actual source text and the domain
 * profile that arrived on the analysis input.
 *
 * The contract fixture (`fixtures/booking-smart-space.valid.ts`) is **test-only**: it
 * exercises all 14 item types against the schema, evidence, relation and
 * normalization suites. It is deliberately no longer reachable at runtime — a fixture
 * standing in for an analysis is exactly the bug this file was changed to fix.
 *
 * Output is raw and untrusted like any provider's, and goes through the same
 * validation path. There is no fast path for the mock. A mock that bypassed
 * validation would test nothing.
 */

import type { AnalysisInput } from "../../contracts/analysis-input";
import type { AiProvider, GapCandidate, ProviderGeneration } from "../types";
import { filterGapCandidates } from "./runtime/gap-filter.ts";
import { generateRuntimeAnalysis } from "./runtime/strategy.ts";

export function createMockProvider(): AiProvider {
  return {
    name: "mock",
    deterministic: true,
    async generate(input: AnalysisInput): Promise<ProviderGeneration> {
      return {
        raw: generateRuntimeAnalysis(input),
        metadata: {
          provider: "mock",
          model: null,
          promptVersion: null,
        },
      };
    },
    async filterCoverageGaps(candidates: GapCandidate[]): Promise<ProviderGeneration> {
      return {
        raw: filterGapCandidates(candidates),
        metadata: {
          provider: "mock",
          model: null,
          promptVersion: null,
        },
      };
    },
  };
}
