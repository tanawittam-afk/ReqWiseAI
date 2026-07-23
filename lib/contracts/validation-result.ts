/**
 * Validation outcomes.
 *
 * Four distinct issue kinds, because they have four different causes and four
 * different fixes:
 *
 *  - `schema_error`           the shape is wrong (or a key is duplicated)
 *  - `evidence_error`         the claim/support relationship is wrong
 *  - `source_reference_error` the citation does not match the real source text
 *  - `relation_error`         an item points at something that does not exist
 *
 * A result is all-or-nothing. There is no partially-accepted analysis: a run that
 * fails validation writes zero items. See `AI-OUTPUT-CONTRACT.md` §D.8.
 */

export const ISSUE_KINDS = [
  "schema_error",
  "evidence_error",
  "source_reference_error",
  "relation_error",
] as const;

export type IssueKind = (typeof ISSUE_KINDS)[number];

export type ValidationIssue = {
  kind: IssueKind;
  /** Machine-readable, stable across message wording changes. */
  code: string;
  /** Dot/bracket path into the provider output, e.g. `items[3].source_references[0]`. */
  path: string;
  message: string;
  /** The provider's own key for the offending item, when the issue belongs to one. */
  itemKey?: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T; issues: [] }
  | { ok: false; issues: ValidationIssue[] };

export function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value, issues: [] };
}

export function fail<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

export function issuesOfKind(issues: readonly ValidationIssue[], kind: IssueKind): ValidationIssue[] {
  return issues.filter((i) => i.kind === kind);
}
