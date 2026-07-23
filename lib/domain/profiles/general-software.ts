/**
 * Domain profile data — General Software.
 *
 * Present to prove the point of the profile layer: a second profile exists, and
 * contracts, validation, and normalization needed no changes to accommodate it.
 * Deliberately thin — the MVP's real content is the Booking and Smart Space profile.
 */

import type { DomainProfile } from "../types";

export const generalSoftwareProfile: DomainProfile = {
  key: "general_software",
  name: "General Software",
  description:
    "Domain-neutral profile for software projects with no specialised industry vocabulary.",
  terminology: [],
  typicalStakeholders: ["End User", "Product Owner", "Administrator", "Support"],
  commonWorkflows: ["Sign up", "Sign in", "Core task completion", "Administration"],
  commonBusinessRules: [],
  requiredClarificationCategories: [
    "Success criteria",
    "User roles and permissions",
    "Data retention",
  ],
  commonRisks: ["Undefined scope", "Unstated performance expectations"],
  suggestedNonFunctionalRequirements: [
    "Stated availability target",
    "Stated response-time expectation for primary interactions",
  ],
  validationRules: ["Every requirement must be testable"],
  stakeholderQuestionTemplates: ["What does success look like for this feature?"],
};
