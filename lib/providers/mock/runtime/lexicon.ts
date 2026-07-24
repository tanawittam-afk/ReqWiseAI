/**
 * Concept detection for the runtime mock strategy.
 *
 * **This file is mock-provider strategy, not engine.** A real provider replaces it
 * with a model call. Nothing in `lib/validation`, `lib/normalization`, or
 * `lib/contracts` imports it, and nothing here decides whether output is valid — it
 * only decides what the mock *says*, which is then distrusted exactly like any other
 * provider's output.
 *
 * Two sources of vocabulary, deliberately:
 *
 *  1. A small bilingual TH/EN lexicon below. A mock has to recognise *something* to
 *     be input-aware at all, and Thai cannot be tokenised by spaces the way English
 *     can, so a keyword list is the honest minimum.
 *  2. The **domain profile loaded from the database**, via `profileVocabulary`. This
 *     is what makes the mock respond to profile data rather than to hardcoded domain
 *     knowledge: edit a profile's terminology and the mock's matching changes with no
 *     code change.
 */

import type { DomainProfile } from "../../../domain/types";
import type { Segment } from "./segments";

/** Concepts the mock can recognise. Domain-neutral names, bilingual triggers. */
export const CONCEPTS = [
  "booking",
  "staff",
  "customer",
  "payment",
  "cancellation",
  "refund",
  "notification",
  "checkin",
  "reporting",
  "unresolved",
  "obligation",
] as const;

export type Concept = (typeof CONCEPTS)[number];

/**
 * TH/EN triggers. Lowercased on both sides before comparison; Thai is caseless so
 * the fold is a no-op there.
 */
const TRIGGERS: Record<Concept, readonly string[]> = {
  booking: ["จอง", "การจอง", "reserv", "booking", "book a", "slot"],
  staff: ["พนักงาน", "เจ้าหน้าที่", "หน้าร้าน", "ผู้ดูแล", "staff", "employee", "front desk", "admin"],
  customer: ["ลูกค้า", "ผู้ใช้", "ผู้ใช้งาน", "customer", "client", "guest", "user"],
  payment: ["ชำระเงิน", "จ่ายเงิน", "เก็บเงิน", "ค่าบริการ", "payment", "pay", "charge", "invoice"],
  cancellation: ["ยกเลิก", "cancel"],
  refund: ["คืนเงิน", "refund"],
  notification: ["แจ้งเตือน", "การแจ้ง", "notif", "alert", "remind"],
  checkin: ["เช็กอิน", "เช็คอิน", "check-in", "checkin", "check in"],
  reporting: ["รายงาน", "สรุปผล", "แดชบอร์ด", "report", "dashboard", "analytic"],
  // "we have not decided yet" — the phrases that mark an open point rather than a fact.
  unresolved: [
    "ยังไม่ได้ข้อสรุป",
    "ยังไม่แน่ใจ",
    "ยังไม่มีนโยบาย",
    "ยังไม่ได้คุย",
    "ยังไม่ได้กำหนด",
    "ขอกลับไปคุย",
    "อาจจะ",
    "not decided",
    "undecided",
    "unclear",
    "tbd",
    "to be confirmed",
    "not yet",
  ],
  // "this is required" — the phrases that mark an intended requirement.
  obligation: ["ต้อง", "ควร", "อยากให้", "ต้องการ", "must", "should", "need to", "require", "want to"],
};

function fold(value: string): string {
  return value.toLowerCase();
}

/**
 * Extra triggers taken from the profile itself: terminology terms, workflow names
 * and clarification categories. Short tokens are dropped — a two-character term
 * matches half the document and tells a reader nothing.
 */
export function profileVocabulary(profile: DomainProfile): string[] {
  const raw = [
    ...profile.terminology.map((t) => t.term),
    ...profile.commonWorkflows,
    ...profile.requiredClarificationCategories,
  ];

  const seen = new Set<string>();
  for (const entry of raw) {
    const token = fold(entry.trim());
    if (token.length >= 4) seen.add(token);
  }
  return [...seen].sort();
}

/** Every concept whose triggers appear in this span. */
export function conceptsIn(segment: Segment): Set<Concept> {
  const haystack = fold(segment.excerpt);
  const found = new Set<Concept>();

  for (const concept of CONCEPTS) {
    if (TRIGGERS[concept].some((trigger) => haystack.includes(fold(trigger)))) {
      found.add(concept);
    }
  }
  return found;
}

/** Whether any profile-derived term appears in this span. */
export function matchesProfileVocabulary(segment: Segment, vocabulary: readonly string[]): boolean {
  const haystack = fold(segment.excerpt);
  return vocabulary.some((term) => haystack.includes(term));
}

/**
 * A clarification category the source itself flags as unsettled.
 *
 * Note what this does *not* do: it never turns profile knowledge into a fact. It
 * reports that the text mentions the topic, which is what lets the strategy cite the
 * text when raising the question instead of inventing one.
 */
export const CLARIFIABLE: readonly Concept[] = [
  "cancellation",
  "refund",
  "notification",
  "payment",
];
