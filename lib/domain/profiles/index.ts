/**
 * Every domain profile the system ships with.
 *
 * This list is the authoring source of truth. `supabase/seed.sql` is generated from
 * it (`npm run seed:profiles`) and the database is what the running app reads — see
 * `lib/domain/load-profile.ts`.
 *
 * Imports carry an explicit `.ts` extension so `scripts/generate-profile-seed.mts` can
 * load this module directly under Node's native type stripping, which resolves ESM
 * specifiers literally.
 */

import type { DomainProfile } from "../types";
import { bookingSmartSpaceProfile } from "./booking-smart-space.ts";
import { generalSoftwareProfile } from "./general-software.ts";

export { bookingSmartSpaceProfile, generalSoftwareProfile };

/** Ordered: the demonstration domain first. Order is what the seed file preserves. */
export const ALL_PROFILES: DomainProfile[] = [
  bookingSmartSpaceProfile,
  generalSoftwareProfile,
];
