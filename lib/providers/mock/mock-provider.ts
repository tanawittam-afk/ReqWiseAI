/**
 * The deterministic mock provider.
 *
 * It is what makes the entire first vertical slice buildable and testable with no
 * key, no network, and no cost. It is a pure function of its input: no `Date.now`,
 * no `Math.random`, no environment reads. The same input always returns the same
 * raw output.
 *
 * It returns raw, untrusted output like any provider, and that output goes through
 * the exact same validation path — there is no fast path for the mock. A mock that
 * bypassed validation would test nothing.
 */

import type { AnalysisInput } from "../../contracts/analysis-input";
import type { AiProvider } from "../types";
import { bookingValidOutput } from "./fixtures/booking-smart-space.valid";

/**
 * Deep clone so a caller cannot mutate the shared fixture between runs and quietly
 * break determinism for the next one. `structuredClone` is available on Node 18+.
 */
function freshCopy<T>(value: T): T {
  return structuredClone(value);
}

export function createMockProvider(): AiProvider {
  return {
    name: "mock",
    deterministic: true,
    async generate(input: AnalysisInput): Promise<unknown> {
      // The mock only has a scripted analysis for Booking and Smart Space. For any
      // other profile it returns an empty-but-valid-shaped envelope rather than
      // pretending to understand a domain it has no fixture for. (An empty `items`
      // array fails the schema's `.min(1)`, surfacing honestly as "no analysis" —
      // the mock does not fabricate content for domains it cannot speak to.)
      if (input.domainProfile.key === "booking_smart_space") {
        return freshCopy(bookingValidOutput);
      }
      return { schema_version: bookingValidOutput.schema_version, items: [] };
    },
  };
}
