/**
 * Deterministic ports for the demo run — mirrors `lib/analysis/production-ports.ts`
 * except for the clock, which is fixed rather than real. A fixed clock is what lets a
 * server-rendered `updatedAt` and a client re-render agree byte-for-byte with no
 * hydration mismatch; the actual date has no meaning for a run nothing ever persists.
 *
 * Unlike the production port's `displayIds` (whose output is discarded — see that
 * file's own comment, real display ids come from `persist_analysis_result()`), the
 * demo never persists anything, so this allocator's output **is** the real display id
 * shown in the UI.
 */

import {
  createDisplayIdAllocator,
  createFixedClock,
  createSequentialIdFactory,
  type NormalizationPorts,
} from "../normalization/ports";

const DEMO_TIMESTAMP = "2026-08-01T00:00:00.000Z";

export function demoPorts(): NormalizationPorts {
  return {
    ids: createSequentialIdFactory(),
    clock: createFixedClock(DEMO_TIMESTAMP),
    displayIds: createDisplayIdAllocator(),
  };
}
