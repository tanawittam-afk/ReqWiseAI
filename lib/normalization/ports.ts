/**
 * Injected dependencies.
 *
 * Normalization must be a pure function of its inputs, so everything
 * non-deterministic — identity, time, sequence allocation — arrives through a
 * port. Production supplies real implementations; tests supply the deterministic
 * ones below and assert on exact output.
 *
 * The allocator in particular is designed to be swapped for a database-backed
 * sequence later without touching a line of normalization code.
 */

import type { ItemType } from "../contracts/item-types";
import { DISPLAY_ID_PREFIX } from "../contracts/item-types";

export interface IdFactory {
  /** `kind` is a namespace hint (`item`, `source_reference`), not a type system. */
  newId(kind: string): string;
}

export interface Clock {
  /** ISO-8601 string. */
  now(): string;
}

export interface DisplayIdAllocator {
  /** Next display ID for this type, e.g. `BR-001`. Never reused, never renumbered. */
  allocate(type: ItemType): string;
}

export type NormalizationPorts = {
  ids: IdFactory;
  clock: Clock;
  displayIds: DisplayIdAllocator;
};

// --- deterministic implementations -----------------------------------------

/** Sequential ids: `item-1`, `item-2`, … Deterministic by construction. */
export function createSequentialIdFactory(prefixSeparator = "-"): IdFactory {
  const counters = new Map<string, number>();
  return {
    newId(kind: string): string {
      const next = (counters.get(kind) ?? 0) + 1;
      counters.set(kind, next);
      return `${kind}${prefixSeparator}${next}`;
    },
  };
}

export function createFixedClock(iso: string): Clock {
  return { now: () => iso };
}

/**
 * In-memory display-ID allocator, scoped to one project.
 *
 * `startAt` seeds the per-type counters from what the project already has, which
 * is how the database-backed implementation will behave: numbering continues, a
 * rejected `FR-004` leaves a permanent gap, and nothing is ever reused.
 */
export function createDisplayIdAllocator(
  options: { padding?: number; startAt?: Partial<Record<ItemType, number>> } = {},
): DisplayIdAllocator {
  const padding = options.padding ?? 3;
  const counters = new Map<ItemType, number>(
    Object.entries(options.startAt ?? {}).map(([type, n]) => [type as ItemType, n as number]),
  );

  return {
    allocate(type: ItemType): string {
      const next = (counters.get(type) ?? 0) + 1;
      counters.set(type, next);
      return `${DISPLAY_ID_PREFIX[type]}-${String(next).padStart(padding, "0")}`;
    },
  };
}
