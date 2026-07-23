/**
 * Provider output → application shape.
 *
 * Accepts only already-validated output. Trusts none of the provider's identity
 * claims: ids, display ids, status, version, and timestamps are all minted here.
 *
 * `status` is not read from the input at all — it is assigned. That is deliberate
 * belt-and-braces: the schema already rejects a `status` field as unknown, and
 * this layer would ignore it even if it slipped through.
 */

import type { SourceDocumentInput } from "../contracts/analysis-input";
import {
  INITIAL_STATUS,
  INITIAL_VERSION_NO,
} from "../contracts/item-types";
import {
  LOW_CONFIDENCE_THRESHOLD,
  type NormalizedAnalysis,
  type NormalizedItem,
  type NormalizedSourceReference,
} from "../contracts/normalized";
import type { ProviderItem } from "../contracts/provider-output";
import type { ValidatedAnalysis } from "../validation/validate-analysis";
import { refSlot } from "../validation/source-references";
import type { NormalizationPorts } from "./ports";

/** Type-specific fields, as a plain record for JSONB persistence. */
function attributesOf(item: ProviderItem): Record<string, unknown> | undefined {
  return "attributes" in item ? { ...item.attributes } : undefined;
}

export function normalizeAnalysis(
  validated: ValidatedAnalysis,
  sourceDocuments: readonly SourceDocumentInput[],
  ports: NormalizationPorts,
): NormalizedAnalysis {
  const { output, offsetVerified } = validated;
  const sourceIdByKey = new Map(sourceDocuments.map((d) => [d.key, d.id]));
  const now = ports.clock.now();

  // Pass 1 — mint an id per provider key, so relations can be resolved in pass 2.
  const idByProviderKey = new Map<string, string>();
  for (const item of output.items) {
    idByProviderKey.set(item.key, ports.ids.newId("item"));
  }

  // Pass 2 — build the items.
  const items: NormalizedItem[] = output.items.map((item, itemIndex) => {
    const sourceReferences: NormalizedSourceReference[] = item.source_references.map(
      (ref, refIndex) => {
        const sourceDocumentId = sourceIdByKey.get(ref.source_document_key);
        if (sourceDocumentId === undefined) {
          // Unreachable: validation rejects unknown source keys before we get here.
          throw new Error(
            `normalize: unknown source_document_key "${ref.source_document_key}" survived validation`,
          );
        }
        return {
          id: ports.ids.newId("source_reference"),
          sourceDocumentId,
          sourceDocumentKey: ref.source_document_key,
          excerpt: ref.excerpt,
          startOffset: ref.start_offset,
          endOffset: ref.end_offset,
          evidenceStrength: ref.evidence_strength,
          offsetVerified: offsetVerified.get(refSlot(itemIndex, refIndex)) ?? false,
        };
      },
    );

    const relatedItemIds = item.related_item_keys.map((key) => {
      const id = idByProviderKey.get(key);
      if (id === undefined) {
        // Unreachable: validation rejects dangling relation keys.
        throw new Error(`normalize: unresolved related_item_key "${key}" survived validation`);
      }
      return id;
    });

    const id = idByProviderKey.get(item.key);
    if (id === undefined) {
      throw new Error(`normalize: missing minted id for item key "${item.key}"`);
    }

    return {
      id,
      displayId: ports.displayIds.allocate(item.type),
      providerKey: item.key,
      type: item.type,
      title: item.title,
      description: item.description,
      // The honest default. A provider that stays silent does not get to imply urgency.
      priority: item.priority ?? "unassigned",
      status: INITIAL_STATUS,
      versionNo: INITIAL_VERSION_NO,
      evidenceClass: item.evidence_class,
      origin: item.origin,
      confidence: item.confidence,
      rationale: item.rationale,
      attributes: attributesOf(item),
      sourceReferences,
      relatedItemIds,
      createdAt: now,
      updatedAt: now,
    };
  });

  return {
    schemaVersion: output.schema_version,
    items,
    summary: {
      itemCount: items.length,
      unresolvedQuestionCount: items.filter((i) => i.type === "open_question").length,
      lowConfidenceCount: items.filter((i) => i.confidence < LOW_CONFIDENCE_THRESHOLD).length,
    },
  };
}
