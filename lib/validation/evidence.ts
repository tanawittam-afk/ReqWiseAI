/**
 * Evidence rules — the mechanism that makes "separate facts from assumptions"
 * enforceable rather than aspirational.
 *
 *   stated    supported directly by the source   → ≥1 reference, rationale optional
 *   inferred  reasoned from the source           → ≥1 reference, rationale required
 *   assumed   not supported by any source        → 0 references, rationale required
 *
 * The combination this product exists to prevent — an invention wearing a
 * citation — is exactly `assumed` + a source reference, and it fails here.
 */

import type { ProviderItem, ProviderOutput } from "../contracts/provider-output";
import type { ValidationIssue } from "../contracts/validation-result";
import { QUALITY_RULE_ITEM_TYPES } from "../contracts/item-types";

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function checkItem(item: ProviderItem, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const path = `items[${index}]`;
  const refCount = item.source_references.length;

  switch (item.evidence_class) {
    case "stated":
      if (refCount === 0) {
        issues.push({
          kind: "evidence_error",
          code: "stated_without_source",
          path: `${path}.source_references`,
          itemKey: item.key,
          message: "evidence_class 'stated' requires at least one source reference",
        });
      }
      break;

    case "inferred":
      if (refCount === 0) {
        issues.push({
          kind: "evidence_error",
          code: "inferred_without_source",
          path: `${path}.source_references`,
          itemKey: item.key,
          message: "evidence_class 'inferred' requires at least one supporting source reference",
        });
      }
      if (!hasText(item.rationale)) {
        issues.push({
          kind: "evidence_error",
          code: "inferred_without_rationale",
          path: `${path}.rationale`,
          itemKey: item.key,
          message: "evidence_class 'inferred' requires a non-empty rationale",
        });
      }
      break;

    case "assumed":
      if (refCount > 0) {
        issues.push({
          kind: "evidence_error",
          code: "assumed_with_source",
          path: `${path}.source_references`,
          itemKey: item.key,
          message:
            "evidence_class 'assumed' must carry no source references — an unsupported claim may not cite evidence",
        });
      }
      if (!hasText(item.rationale)) {
        issues.push({
          kind: "evidence_error",
          code: "assumed_without_rationale",
          path: `${path}.rationale`,
          itemKey: item.key,
          message: "evidence_class 'assumed' requires a non-empty rationale",
        });
      }
      break;
  }

  // Origin rules.
  if (item.origin === "domain_profile" && item.evidence_class === "stated") {
    issues.push({
      kind: "evidence_error",
      code: "domain_profile_cannot_state_fact",
      path: `${path}.evidence_class`,
      itemKey: item.key,
      message:
        "an item originating from the domain profile may not be 'stated' — profile knowledge is context, not evidence about this client",
    });
  }

  if (item.origin === "quality_rule" && !QUALITY_RULE_ITEM_TYPES.includes(item.type)) {
    issues.push({
      kind: "evidence_error",
      code: "quality_rule_invalid_type",
      path: `${path}.type`,
      itemKey: item.key,
      message: `origin 'quality_rule' may only produce ${QUALITY_RULE_ITEM_TYPES.join(" or ")}, got '${item.type}'`,
    });
  }

  return issues;
}

export function checkEvidence(output: ProviderOutput): ValidationIssue[] {
  return output.items.flatMap(checkItem);
}
