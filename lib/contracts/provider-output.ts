/**
 * The untrusted provider contract.
 *
 * Everything a provider returns crosses this boundary before it is allowed
 * anywhere near the database or the UI. Two properties matter most:
 *
 *  1. **Strict.** Every object rejects unknown keys, so a provider cannot smuggle
 *     `status`, a display ID, or a database ID into the system by inventing a field.
 *  2. **Discriminated.** Type-specific attributes live in a union discriminated on
 *     `type`, so a `risk` cannot carry user-story fields. Impossible states do not
 *     parse.
 *
 * See `docs/architecture/AI-OUTPUT-CONTRACT.md`.
 */

import { z } from "zod";
import {
  EVIDENCE_CLASSES,
  ITEM_ORIGINS,
  PRIORITIES,
  PROVIDER_KEY_MAX_LENGTH,
  PROVIDER_KEY_PATTERN,
  QUALITY_FINDING_KINDS,
} from "./item-types";

const providerKey = z
  .string()
  .min(2)
  .max(PROVIDER_KEY_MAX_LENGTH)
  .regex(PROVIDER_KEY_PATTERN, "provider key must be lowercase kebab-case");

const nonEmptyText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max);

/**
 * A citation. Offsets are optional — a provider that cannot locate an exact span
 * still produces a usable reference — but when present they are checked against
 * the real source text in `lib/validation/source-references.ts`. The schema alone
 * cannot verify them: it has no access to the document.
 */
export const sourceReferenceSchema = z
  .strictObject({
    source_document_key: providerKey,
    excerpt: nonEmptyText(2000),
    start_offset: z.int().nonnegative().optional(),
    end_offset: z.int().nonnegative().optional(),
    evidence_strength: z.number().min(0).max(1).optional(),
  })
  .refine(
    (r) => (r.start_offset === undefined) === (r.end_offset === undefined),
    { message: "start_offset and end_offset must be provided together", path: ["start_offset"] },
  );

export type ProviderSourceReference = z.infer<typeof sourceReferenceSchema>;

/** Fields every item carries, whatever its type. */
const baseItemShape = {
  key: providerKey,
  title: nonEmptyText(160),
  description: nonEmptyText(4000),
  evidence_class: z.enum(EVIDENCE_CLASSES),
  origin: z.enum(ITEM_ORIGINS),
  confidence: z.number().min(0).max(1),
  source_references: z.array(sourceReferenceSchema).max(20).default([]),
  rationale: nonEmptyText(2000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  related_item_keys: z.array(providerKey).max(50).default([]),
};

/** An item type whose `attributes` key is not permitted at all (strict rejects it). */
const plainItem = <T extends string>(type: T) =>
  z.strictObject({ ...baseItemShape, type: z.literal(type) });

/** An item type that requires a typed `attributes` object. */
const itemWithAttributes = <T extends string, A extends z.ZodType>(type: T, attributes: A) =>
  z.strictObject({ ...baseItemShape, type: z.literal(type), attributes });

export const providerItemSchema = z.discriminatedUnion("type", [
  plainItem("problem_statement"),
  plainItem("business_objective"),
  plainItem("business_requirement"),
  plainItem("functional_requirement"),
  plainItem("business_rule"),
  plainItem("assumption"),
  plainItem("constraint"),

  itemWithAttributes(
    "stakeholder",
    z.strictObject({
      role: nonEmptyText(120),
      interest: nonEmptyText(500).optional(),
      influence: z.enum(["high", "medium", "low"]).optional(),
    }),
  ),

  itemWithAttributes(
    "non_functional_requirement",
    z.strictObject({
      category: nonEmptyText(60),
      metric: nonEmptyText(200).optional(),
      target: nonEmptyText(200).optional(),
    }),
  ),

  itemWithAttributes(
    "user_story",
    z.strictObject({
      as_a: nonEmptyText(120),
      i_want: nonEmptyText(500),
      so_that: nonEmptyText(500),
    }),
  ),

  itemWithAttributes(
    "acceptance_criterion",
    z.strictObject({
      given: nonEmptyText(500).optional(),
      when: nonEmptyText(500).optional(),
      then: nonEmptyText(500),
    }),
  ),

  itemWithAttributes(
    "risk",
    z.strictObject({
      impact: z.int().min(1).max(5),
      likelihood: z.int().min(1).max(5),
      mitigation: nonEmptyText(1000).optional(),
    }),
  ),

  itemWithAttributes(
    "open_question",
    z.strictObject({
      category: nonEmptyText(60),
      blocks_keys: z.array(providerKey).max(50).default([]),
    }),
  ),

  itemWithAttributes(
    "quality_finding",
    z.strictObject({
      finding: z.enum(QUALITY_FINDING_KINDS),
      target_keys: z.array(providerKey).min(1).max(50),
    }),
  ),
]);

export type ProviderItem = z.infer<typeof providerItemSchema>;

/**
 * The envelope.
 *
 * Deliberately carries no application-owned facts — no project, organization, or
 * run id, no status, no version, no timestamps, and not even the output language.
 * Those are things the application knows; echoing them back from a provider only
 * creates an opportunity for them to disagree.
 */
export const providerOutputSchema = z.strictObject({
  schema_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  items: z.array(providerItemSchema).min(1).max(500),
});

export type ProviderOutput = z.infer<typeof providerOutputSchema>;

/** The version this codebase produces and accepts. */
export const PROVIDER_SCHEMA_VERSION = "1.0.0";
