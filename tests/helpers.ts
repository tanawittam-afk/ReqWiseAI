import type { AnalysisInput } from "../lib/contracts/analysis-input";
import { bookingSmartSpaceProfile } from "../lib/domain/profiles/booking-smart-space";
import { bookingSourceDocument } from "../lib/providers/mock/fixtures/booking-smart-space.source";
import {
  createDisplayIdAllocator,
  createFixedClock,
  createSequentialIdFactory,
  type NormalizationPorts,
} from "../lib/normalization/ports";

export const FIXED_TIME = "2026-07-24T00:00:00.000Z";

/** Deterministic ports for normalization tests. */
export function testPorts(): NormalizationPorts {
  return {
    ids: createSequentialIdFactory(),
    clock: createFixedClock(FIXED_TIME),
    displayIds: createDisplayIdAllocator(),
  };
}

/** The standard analysis input over the Booking and Smart Space fixture source. */
export function bookingInput(): AnalysisInput {
  return {
    domainProfile: bookingSmartSpaceProfile,
    sourceDocuments: [bookingSourceDocument],
    outputLang: "th",
  };
}
