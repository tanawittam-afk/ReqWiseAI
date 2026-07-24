/**
 * Runtime validation for a domain profile.
 *
 * A profile is authored in TypeScript (`lib/domain/profiles/*.ts`) but *served* from
 * the `domain_profiles` table, so between authoring and use it passes through a
 * `jsonb` column that no compiler checks. This schema is the boundary: anything read
 * back from the database is parsed here before it reaches `AnalysisInput`.
 *
 * The type assertion at the bottom is deliberate — if `DomainProfile` and this schema
 * ever disagree, `npm run typecheck` fails rather than a profile silently losing a
 * field on the round trip.
 */

import { z } from "zod";
import type { DomainProfile } from "./types";

const text = (max: number) => z.string().trim().min(1).max(max);

const textList = (max: number, maxItems = 50) => z.array(text(max)).max(maxItems);

export const domainProfileSchema = z.strictObject({
  key: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, "profile key must be lowercase snake_case"),
  name: text(120),
  description: text(1000),
  terminology: z
    .array(z.strictObject({ term: text(120), meaning: text(500) }))
    .max(100),
  typicalStakeholders: textList(120),
  commonWorkflows: textList(200),
  commonBusinessRules: textList(500),
  requiredClarificationCategories: textList(200),
  commonRisks: textList(500),
  suggestedNonFunctionalRequirements: textList(500),
  validationRules: textList(500),
  stakeholderQuestionTemplates: textList(500),
});

export type ParsedDomainProfile = z.infer<typeof domainProfileSchema>;

/** Compile-time proof that the schema and the hand-written type describe one shape. */
type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
type SchemaMatchesType = Exact<ParsedDomainProfile, DomainProfile>;
export const SCHEMA_MATCHES_TYPE: SchemaMatchesType = true;
