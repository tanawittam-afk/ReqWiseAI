/**
 * The application-owned shape.
 *
 * Everything a provider is not trusted with lives here and only here: identifiers,
 * display IDs, status, version, timestamps. This is what the persistence layer and
 * the UI consume — never `ProviderOutput`.
 */

import type {
  EvidenceClass,
  ItemOrigin,
  ItemType,
  Priority,
} from "./item-types";
import type { INITIAL_STATUS } from "./item-types.ts";

export type ItemStatus =
  | "draft"
  | "needs_clarification"
  | "reviewed"
  | "approved"
  | "rejected"
  | "implemented";

export type NormalizedSourceReference = {
  id: string;
  /** Resolved from the provider's `source_document_key` against the analysis input. */
  sourceDocumentId: string;
  sourceDocumentKey: string;
  excerpt: string;
  startOffset?: number;
  endOffset?: number;
  evidenceStrength?: number;
  /**
   * True only when offsets were supplied *and* `text.slice(start, end) === excerpt`.
   * When offsets are absent this is false — the excerpt was still verified to occur
   * in the source, but no exact span was proven, and we do not claim otherwise.
   */
  offsetVerified: boolean;
};

export type NormalizedItem = {
  id: string;
  /** `BR-001` etc. Allocated by the application, unique per project per type. */
  displayId: string;
  /** The provider's own key, kept for audit and for mapping back to raw output. */
  providerKey: string;
  type: ItemType;
  title: string;
  description: string;
  priority: Priority;
  /** Always `draft` on creation. A provider cannot influence this. */
  status: typeof INITIAL_STATUS;
  versionNo: number;
  evidenceClass: EvidenceClass;
  origin: ItemOrigin;
  confidence: number;
  rationale?: string;
  attributes?: Record<string, unknown>;
  sourceReferences: NormalizedSourceReference[];
  /** `related_item_keys` resolved to application ids. */
  relatedItemIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type NormalizedAnalysis = {
  schemaVersion: string;
  items: NormalizedItem[];
  summary: {
    itemCount: number;
    unresolvedQuestionCount: number;
    lowConfidenceCount: number;
  };
};

/** Items below this confidence are surfaced to the reviewer — never auto-actioned. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;
