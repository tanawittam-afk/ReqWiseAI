/**
 * Domain profile data — Booking and Smart Space.
 *
 * This is the *only* place in the codebase where words like "booking", "room",
 * "check-in", or "refund" are allowed to appear outside a fixture. It is data: no
 * layer branches on this profile's key, and deleting it degrades output quality
 * without breaking a single code path.
 */

import type { DomainProfile } from "../types";

export const bookingSmartSpaceProfile: DomainProfile = {
  key: "booking_smart_space",
  name: "Booking and Smart Space",
  description:
    "Reservation and on-site usage of bookable spaces, covering discovery, reservation, payment, access, in-session service, and post-service follow-up.",
  terminology: [
    { term: "Walk-in", meaning: "A customer arriving without a prior reservation." },
    { term: "Check-in", meaning: "The act of a customer starting a reserved session on site." },
    { term: "Slot", meaning: "A bookable unit of time for a given space." },
    { term: "No-show", meaning: "A reservation whose customer never checks in." },
  ],
  typicalStakeholders: [
    "Customer",
    "Walk-in Customer",
    "Front Desk Staff",
    "Operations Staff",
    "Marketing User",
    "Administrator",
    "Management",
  ],
  commonWorkflows: [
    "Space search and availability check",
    "Reservation and payment",
    "Walk-in reservation",
    "Check-in and access verification",
    "In-session service ordering",
    "Cancellation and refund",
    "Post-service feedback",
    "Campaign activation from customer data",
  ],
  commonBusinessRules: [
    "Availability must reflect confirmed reservations in real time",
    "A space cannot be double-booked for overlapping slots",
    "Access is granted only to a checked-in reservation",
  ],
  requiredClarificationCategories: [
    "Cancellation policy",
    "Refund policy and timing",
    "Payment methods and timing",
    "Customer identity and verification",
    "No-show handling",
    "Overbooking and waitlist policy",
    "Data retention and marketing consent",
  ],
  commonRisks: [
    "Double booking under concurrent reservations",
    "Payment captured without a confirmed reservation",
    "Access granted to an unverified customer",
    "Loss of revenue through unmanaged no-shows",
  ],
  suggestedNonFunctionalRequirements: [
    "Availability queries respond fast enough for interactive search",
    "Reservation writes are transactional and idempotent",
    "Personal data handling meets applicable privacy obligations",
    "The on-site flow works on mobile devices under poor connectivity",
  ],
  validationRules: [
    "Every state that money moves in must have a stated policy or an open question",
    "Every actor named in a workflow must appear as a stakeholder",
    "Any time window mentioned must be explicit, not relative",
  ],
  stakeholderQuestionTemplates: [
    "What is the cancellation window, and does it differ by space type?",
    "Who is permitted to issue a refund, and within what period?",
    "What identity information is required at check-in?",
    "How should the system treat a no-show after how long?",
  ],
};
