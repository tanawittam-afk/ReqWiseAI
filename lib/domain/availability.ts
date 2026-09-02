/**
 * Which domains a project may actually be created against today.
 *
 * This is an **application** concern, not an engine one: the Core Requirement Engine
 * must never branch on a profile key (ARCHITECTURE §B.2). Here the question is only
 * "is this domain finished enough to offer" — Booking and Smart Space and General
 * Software both now carry real content (Phase 8, ARCHITECTURE §A.3/§B.3). Any others
 * are listed so the layer is visible, and disabled so nobody starts work the product
 * cannot yet support.
 */

export const SUPPORTED_DOMAIN_PROFILE_KEYS: readonly string[] = [
  "booking_smart_space",
  "general_software",
];

export function isDomainSupported(key: string): boolean {
  return SUPPORTED_DOMAIN_PROFILE_KEYS.includes(key);
}

/** Not a database row — the custom-domain editor is out of scope for this slice. */
export const CUSTOM_DOMAIN_PLACEHOLDER = {
  key: "custom_domain",
  name: "Custom Domain",
  description:
    "Describe your own business context — terminology, workflows and the questions worth asking.",
} as const;
