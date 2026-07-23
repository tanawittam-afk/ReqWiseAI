/**
 * The one door untrusted output comes through.
 *
 * Order matters: the schema runs first, because the later checks are written
 * against a parsed `ProviderOutput` and cannot run on arbitrary input. Once the
 * shape is known, the semantic checks all run together so a caller sees every
 * problem at once rather than one per attempt.
 *
 * All-or-nothing: any issue means the whole analysis is rejected. Nothing is
 * repaired, defaulted, or dropped. A partially valid analysis presented as
 * complete is worse than an honest failure.
 */

import type { SourceDocumentInput } from "../contracts/analysis-input";
import {
  PROVIDER_SCHEMA_VERSION,
  providerOutputSchema,
  type ProviderOutput,
} from "../contracts/provider-output";
import {
  fail,
  ok,
  type ValidationIssue,
  type ValidationResult,
} from "../contracts/validation-result";
import { checkEvidence } from "./evidence";
import { checkDuplicateKeys, checkRelationKeys } from "./structure";
import { checkSourceReferences, type OffsetVerification } from "./source-references";

export type ValidatedAnalysis = {
  output: ProviderOutput;
  offsetVerified: OffsetVerification;
};

function toIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === "number") return `${acc}[${segment}]`;
    return acc.length === 0 ? String(segment) : `${acc}.${String(segment)}`;
  }, "");
}

/** Parse untrusted input against the strict provider schema. */
export function validateProviderSchema(raw: unknown): ValidationResult<ProviderOutput> {
  const parsed = providerOutputSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);

  const issues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
    kind: "schema_error",
    code: issue.code,
    path: toIssuePath(issue.path),
    message: issue.message,
  }));

  return fail(issues);
}

/**
 * Full pipeline: strict schema → structure → evidence → citations → relations.
 */
export function validateAnalysis(
  raw: unknown,
  sourceDocuments: readonly SourceDocumentInput[],
): ValidationResult<ValidatedAnalysis> {
  const schema = validateProviderSchema(raw);
  if (!schema.ok) return fail(schema.issues);

  const output = schema.value;
  const issues: ValidationIssue[] = [];

  if (output.schema_version !== PROVIDER_SCHEMA_VERSION) {
    issues.push({
      kind: "schema_error",
      code: "unsupported_schema_version",
      path: "schema_version",
      message: `unsupported schema_version "${output.schema_version}" (expected ${PROVIDER_SCHEMA_VERSION})`,
    });
  }

  issues.push(...checkDuplicateKeys(output));
  issues.push(...checkEvidence(output));

  const references = checkSourceReferences(output, sourceDocuments);
  issues.push(...references.issues);
  issues.push(...checkRelationKeys(output));

  if (issues.length > 0) return fail(issues);

  return ok({ output, offsetVerified: references.offsetVerified });
}
