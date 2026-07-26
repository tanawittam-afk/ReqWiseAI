/**
 * The **internal** shapes the export loader produces and the builder consumes.
 *
 * Distinct from `lib/contracts/export.ts` on purpose. That file is the public contract —
 * what leaves the system, versioned, with nothing in it a reader cannot use. This file
 * is the working set: it still carries the raw source text (needed to check that every
 * citation's offsets still land where they claim) and the internal item ids (needed to
 * resolve relations before they are rewritten as display ids). Neither survives into
 * the package.
 *
 * Keeping them apart is what makes the offset check possible at all without also making
 * the raw document part of the export.
 */

import type { ItemType } from "../contracts/item-types.ts";
import type { RelationType } from "../contracts/relations.ts";
import type { SourceKind } from "../contracts/source.ts";

export type ExportSourceInput = {
  id: string;
  title: string;
  kind: SourceKind;
  revisionNumber: number;
  locked: boolean;
  sourceDate: string | null;
  createdAt: string;
  /**
   * Verbatim stored text. Used for exactly one thing — verifying
   * `rawText.slice(start, end) === excerpt` — and never copied into the package: an
   * export is a document about the source, not a second copy of it.
   */
  rawText: string;
};

export type ExportReferenceInput = {
  itemId: string;
  sourceDocumentId: string;
  excerpt: string;
  startOffset: number | null;
  endOffset: number | null;
  offsetVerified: boolean;
};

export type ExportItemInput = {
  id: string;
  displayId: string;
  type: ItemType;
  title: string;
  description: string;
  priority: string;
  status: string;
  evidenceClass: string;
  origin: string;
  confidence: number;
  rationale: string | null;
  attributes: Record<string, unknown> | null;
  versionNo: number;
  createdAt: string;
  workflowState: string | null;
  resolutionText: string | null;
  resolvedAt: string | null;
  followUpOn: string | null;
  analysisRunId: string;
};

export type ExportRelationInput = {
  fromItemId: string;
  toItemId: string;
  type: RelationType;
  legacy: boolean;
};

/**
 * One review or workflow activity, stripped of its actor.
 *
 * `actor_id` is an auth user id and is dropped in the loader rather than in the
 * builder — the earliest layer that can drop it is the right one, because a field that
 * never enters the working set cannot be exported by a later mistake.
 */
export type ExportActivityInput = {
  itemId: string;
  label: string;
  comment: string | null;
  createdAt: string;
};

export type ExportVersionInput = {
  itemId: string;
  versionNo: number;
  changeReason: string | null;
  createdAt: string;
};

export type ExportProjectInput = {
  id: string;
  name: string;
  description: string | null;
  businessObjective: string | null;
  knownStakeholders: string[];
  domain: { key: string; name: string } | null;
  outputLang: string;
  status: "active" | "archived";
  archiveReason: string | null;
  createdAt: string;
  sourceCount: number;
  analysisRunCount: number;
};

/** Everything one export needs, loaded once, in the reader's own security context. */
export type ExportInput = {
  project: ExportProjectInput;
  sources: ExportSourceInput[];
  items: ExportItemInput[];
  references: ExportReferenceInput[];
  relations: ExportRelationInput[];
  activities: ExportActivityInput[];
  versions: ExportVersionInput[];
};
