/**
 * Structural checks Zod cannot express, because they are about the relationship
 * *between* items rather than the shape of any one of them.
 */

import type { ProviderItem, ProviderOutput } from "../contracts/provider-output";
import type { ValidationIssue } from "../contracts/validation-result";

/**
 * Provider keys must be unique within one output. Duplicates are reported as
 * `schema_error`: the document is malformed, not merely unsupported.
 */
export function checkDuplicateKeys(output: ProviderOutput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenAt = new Map<string, number>();

  output.items.forEach((item, index) => {
    const first = seenAt.get(item.key);
    if (first === undefined) {
      seenAt.set(item.key, index);
      return;
    }
    issues.push({
      kind: "schema_error",
      code: "duplicate_item_key",
      path: `items[${index}].key`,
      itemKey: item.key,
      message: `duplicate item key "${item.key}" (first seen at items[${first}])`,
    });
  });

  return issues;
}

/** Every key an item points at, with the path it was written at. */
function outgoingKeys(item: ProviderItem, index: number): Array<{ key: string; path: string }> {
  const refs = item.related_item_keys.map((key, i) => ({
    key,
    path: `items[${index}].related_item_keys[${i}]`,
  }));

  if (item.type === "quality_finding") {
    refs.push(
      ...item.attributes.target_keys.map((key, i) => ({
        key,
        path: `items[${index}].attributes.target_keys[${i}]`,
      })),
    );
  }

  if (item.type === "open_question") {
    refs.push(
      ...item.attributes.blocks_keys.map((key, i) => ({
        key,
        path: `items[${index}].attributes.blocks_keys[${i}]`,
      })),
    );
  }

  return refs;
}

/**
 * An item may only reference a key that exists in the same output, and may not
 * reference itself. A dangling reference means the provider invented a link.
 */
export function checkRelationKeys(output: ProviderOutput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const known = new Set(output.items.map((i) => i.key));

  output.items.forEach((item, index) => {
    for (const { key, path } of outgoingKeys(item, index)) {
      if (!known.has(key)) {
        issues.push({
          kind: "relation_error",
          code: "unknown_related_key",
          path,
          itemKey: item.key,
          message: `references unknown item key "${key}"`,
        });
        continue;
      }
      if (key === item.key) {
        issues.push({
          kind: "relation_error",
          code: "self_reference",
          path,
          itemKey: item.key,
          message: `item "${item.key}" references itself`,
        });
      }
    }
  });

  return issues;
}
