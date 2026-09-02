-- ReqWiseAI — domain profile seed
--
-- GENERATED FILE — do not hand-edit.
-- Source of truth: lib/domain/profiles/*.ts (listed in lib/domain/profiles/index.ts).
-- Regenerate with: npm run seed:profiles
-- tests/domain/seed-sync.test.ts fails if this file drifts from the TypeScript.
--
-- The running app reads profile content from this table, never from the TypeScript —
-- see lib/domain/load-profile.ts. Booking and Smart Space is the MVP demonstration
-- domain; General Software proves the profile layer accepts a second profile with no
-- code change.

insert into domain_profiles (key, name, description, content, is_active) values
  (
    'booking_smart_space',
    'Booking and Smart Space',
    'Reservation and on-site usage of bookable spaces, covering discovery, reservation, payment, access, in-session service, and post-service follow-up.',
    '{
      "terminology": [
        {
          "term": "Walk-in",
          "meaning": "A customer arriving without a prior reservation."
        },
        {
          "term": "Check-in",
          "meaning": "The act of a customer starting a reserved session on site."
        },
        {
          "term": "Slot",
          "meaning": "A bookable unit of time for a given space."
        },
        {
          "term": "No-show",
          "meaning": "A reservation whose customer never checks in."
        }
      ],
      "typicalStakeholders": [
        "Customer",
        "Walk-in Customer",
        "Front Desk Staff",
        "Operations Staff",
        "Marketing User",
        "Administrator",
        "Management"
      ],
      "commonWorkflows": [
        "Space search and availability check",
        "Reservation and payment",
        "Walk-in reservation",
        "Check-in and access verification",
        "In-session service ordering",
        "Cancellation and refund",
        "Post-service feedback",
        "Campaign activation from customer data"
      ],
      "commonBusinessRules": [
        "Availability must reflect confirmed reservations in real time",
        "A space cannot be double-booked for overlapping slots",
        "Access is granted only to a checked-in reservation"
      ],
      "requiredClarificationCategories": [
        "Cancellation policy",
        "Refund policy and timing",
        "Payment methods and timing",
        "Customer identity and verification",
        "No-show handling",
        "Overbooking and waitlist policy",
        "Data retention and marketing consent"
      ],
      "commonRisks": [
        "Double booking under concurrent reservations",
        "Payment captured without a confirmed reservation",
        "Access granted to an unverified customer",
        "Loss of revenue through unmanaged no-shows"
      ],
      "suggestedNonFunctionalRequirements": [
        "Availability queries respond fast enough for interactive search",
        "Reservation writes are transactional and idempotent",
        "Personal data handling meets applicable privacy obligations",
        "The on-site flow works on mobile devices under poor connectivity"
      ],
      "validationRules": [
        "Every state that money moves in must have a stated policy or an open question",
        "Every actor named in a workflow must appear as a stakeholder",
        "Any time window mentioned must be explicit, not relative"
      ],
      "stakeholderQuestionTemplates": [
        "What is the cancellation window, and does it differ by space type?",
        "Who is permitted to issue a refund, and within what period?",
        "What identity information is required at check-in?",
        "How should the system treat a no-show after how long?"
      ]
    }'::jsonb,
    true
  ),
  (
    'general_software',
    'General Software',
    'Domain-neutral profile for software projects with no specialised industry vocabulary.',
    '{
      "terminology": [
        {
          "term": "Role",
          "meaning": "A named set of permissions assigned to a user."
        },
        {
          "term": "Permission",
          "meaning": "A single allowed action a role may grant."
        },
        {
          "term": "Session",
          "meaning": "A period of authenticated activity by a signed-in user."
        },
        {
          "term": "Audit log",
          "meaning": "A permanent record of who did what, and when."
        }
      ],
      "typicalStakeholders": [
        "End User",
        "Product Owner",
        "Administrator",
        "Support",
        "Developer",
        "Security Officer",
        "Management"
      ],
      "commonWorkflows": [
        "Sign up",
        "Sign in",
        "Password reset and account recovery",
        "Core task completion",
        "Profile and settings management",
        "Notification handling",
        "Search and filtering",
        "Administration"
      ],
      "commonBusinessRules": [
        "A user must be authenticated before accessing a protected resource",
        "A user''s role determines which actions they may perform",
        "Administrative actions are recorded in an audit log",
        "Data is not permanently deleted without a stated retention or deletion policy"
      ],
      "requiredClarificationCategories": [
        "Success criteria",
        "User roles and permissions",
        "Authentication method",
        "Data retention",
        "Notification channels and triggers",
        "Integration and API requirements"
      ],
      "commonRisks": [
        "Undefined scope",
        "Unstated performance expectations",
        "Unauthorized access from a broken authorization check",
        "Data loss without a tested backup or restore path"
      ],
      "suggestedNonFunctionalRequirements": [
        "Stated availability target",
        "Stated response-time expectation for primary interactions",
        "Sensitive data is encrypted in transit and at rest",
        "Administrative actions leave an auditable trail"
      ],
      "validationRules": [
        "Every requirement must be testable",
        "Every actor named in a workflow must appear as a stakeholder",
        "Every non-functional claim states a measurable target or is an open question"
      ],
      "stakeholderQuestionTemplates": [
        "What does success look like for this feature?",
        "Who is authorized to perform each administrative action?",
        "What happens to a user''s data when their account is deleted?"
      ]
    }'::jsonb,
    true
  )
on conflict (key) do update set
  name        = excluded.name,
  description = excluded.description,
  content     = excluded.content,
  is_active   = excluded.is_active;
