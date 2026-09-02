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
  terminology: [
    { term: "Role", meaning: "A named set of permissions assigned to a user." },
    { term: "Permission", meaning: "A single allowed action a role may grant." },
    { term: "Session", meaning: "A period of authenticated activity by a signed-in user." },
    { term: "Audit log", meaning: "A permanent record of who did what, and when." },
  ],
  typicalStakeholders: [
    "End User",
    "Product Owner",
    "Administrator",
    "Support",
    "Developer",
    "Security Officer",
    "Management",
  ],
  commonWorkflows: [
    "Sign up",
    "Sign in",
    "Password reset and account recovery",
    "Core task completion",
    "Profile and settings management",
    "Notification handling",
    "Search and filtering",
    "Administration",
  ],
  commonBusinessRules: [
    "A user must be authenticated before accessing a protected resource",
    "A user's role determines which actions they may perform",
    "Administrative actions are recorded in an audit log",
    "Data is not permanently deleted without a stated retention or deletion policy",
  ],
  requiredClarificationCategories: [
    "Success criteria",
    "User roles and permissions",
    "Authentication method",
    "Data retention",
    "Notification channels and triggers",
    "Integration and API requirements",
  ],
  commonRisks: [
    "Undefined scope",
    "Unstated performance expectations",
    "Unauthorized access from a broken authorization check",
    "Data loss without a tested backup or restore path",
  ],
  suggestedNonFunctionalRequirements: [
    "Stated availability target",
    "Stated response-time expectation for primary interactions",
    "Sensitive data is encrypted in transit and at rest",
    "Administrative actions leave an auditable trail",
  ],
  validationRules: [
    "Every requirement must be testable",
    "Every actor named in a workflow must appear as a stakeholder",
    "Every non-functional claim states a measurable target or is an open question",
  ],
  stakeholderQuestionTemplates: [
    "What does success look like for this feature?",
    "Who is authorized to perform each administrative action?",
    "What happens to a user's data when their account is deleted?",
  ],
};
