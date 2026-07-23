/**
 * Citation validation — the single most valuable check in the system.
 *
 * It is what makes a fabricated quotation impossible to display: if the model
 * says the client asked for something and points at a span of the meeting notes,
 * that span must actually contain those words.
 *
 * Deliberately separate from the provider schema, because the schema has no
 * access to the source text.
 */

import type { SourceDocumentInput } from "../contracts/analysis-input";
import type { ProviderOutput } from "../contracts/provider-output";
import type { ValidationIssue } from "../contracts/validation-result";

/** `"<itemIndex>:<refIndex>"` → whether an exact span was proven. */
export type OffsetVerification = Map<string, boolean>;

export function refSlot(itemIndex: number, refIndex: number): string {
  return `${itemIndex}:${refIndex}`;
}

export type SourceReferenceCheckResult = {
  issues: ValidationIssue[];
  /**
   * True only where offsets were supplied and matched exactly. Absent offsets
   * leave this false — the excerpt was still confirmed to occur in the document,
   * but no exact span was proven and we never claim one was.
   */
  offsetVerified: OffsetVerification;
};

export function checkSourceReferences(
  output: ProviderOutput,
  sourceDocuments: readonly SourceDocumentInput[],
): SourceReferenceCheckResult {
  const issues: ValidationIssue[] = [];
  const offsetVerified: OffsetVerification = new Map();
  const byKey = new Map(sourceDocuments.map((d) => [d.key, d]));

  output.items.forEach((item, itemIndex) => {
    item.source_references.forEach((ref, refIndex) => {
      const path = `items[${itemIndex}].source_references[${refIndex}]`;
      const slot = refSlot(itemIndex, refIndex);
      offsetVerified.set(slot, false);

      const doc = byKey.get(ref.source_document_key);
      if (!doc) {
        issues.push({
          kind: "source_reference_error",
          code: "unknown_source_document",
          path: `${path}.source_document_key`,
          itemKey: item.key,
          message: `references source document "${ref.source_document_key}", which was not part of this analysis input`,
        });
        return;
      }

      const { text } = doc;
      const { start_offset: start, end_offset: end, excerpt } = ref;

      // No offsets: we can still catch an invented quotation, but we must not
      // pretend an exact span was verified.
      if (start === undefined || end === undefined) {
        if (!text.includes(excerpt)) {
          issues.push({
            kind: "source_reference_error",
            code: "excerpt_not_found",
            path: `${path}.excerpt`,
            itemKey: item.key,
            message: `excerpt does not occur anywhere in source document "${doc.key}"`,
          });
        }
        return;
      }

      if (end <= start) {
        issues.push({
          kind: "source_reference_error",
          code: "offset_range_invalid",
          path: `${path}.end_offset`,
          itemKey: item.key,
          message: `end_offset (${end}) must be greater than start_offset (${start})`,
        });
        return;
      }

      if (end > text.length) {
        issues.push({
          kind: "source_reference_error",
          code: "offset_out_of_range",
          path: `${path}.end_offset`,
          itemKey: item.key,
          message: `end_offset (${end}) exceeds the length of source document "${doc.key}" (${text.length})`,
        });
        return;
      }

      const actual = text.slice(start, end);
      if (actual !== excerpt) {
        issues.push({
          kind: "source_reference_error",
          code: "excerpt_offset_mismatch",
          path: `${path}.excerpt`,
          itemKey: item.key,
          message: `excerpt does not match source text at [${start}, ${end}) — found ${JSON.stringify(actual)}`,
        });
        return;
      }

      offsetVerified.set(slot, true);
    });
  });

  return { issues, offsetVerified };
}
