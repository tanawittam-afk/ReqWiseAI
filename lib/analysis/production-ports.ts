/**
 * Real (non-test) normalization ports.
 *
 * `displayIds` here is never actually consulted for a persisted id: real display ids
 * are allocated inside `persist_analysis_result()` under a project row lock, which
 * this pure, database-free layer cannot take (see lib/normalization/ports.ts and
 * lib/analysis/persist.ts). It is supplied only because `normalizeAnalysis` requires
 * an allocator to run at all — its output is discarded by `toItemPayload`.
 */

import {
  createDisplayIdAllocator,
  createSequentialIdFactory,
  type NormalizationPorts,
} from "../normalization/ports";

export function productionPorts(): NormalizationPorts {
  return {
    ids: createSequentialIdFactory(),
    clock: { now: () => new Date().toISOString() },
    displayIds: createDisplayIdAllocator(),
  };
}
