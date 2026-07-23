/**
 * A domain profile is **data**, never code.
 *
 * It supplies business context to a provider — terminology to recognise, questions
 * worth asking, validations worth firing. It is never evidence: nothing in here can
 * justify a factual claim about a specific client. Knowing that booking systems
 * usually have a refund policy does not make it a fact about *this* one.
 *
 * Adding a profile must require zero changes to contracts, validation, or
 * normalization. See `docs/architecture/ARCHITECTURE.md` §B.3.
 */

export type DomainProfile = {
  key: string;
  name: string;
  description: string;
  terminology: Array<{ term: string; meaning: string }>;
  typicalStakeholders: string[];
  commonWorkflows: string[];
  commonBusinessRules: string[];
  /** Categories of thing a BA must go back and ask about in this domain. */
  requiredClarificationCategories: string[];
  commonRisks: string[];
  suggestedNonFunctionalRequirements: string[];
  /** Human-readable checks a reviewer should apply. Not executable code. */
  validationRules: string[];
  stakeholderQuestionTemplates: string[];
};
