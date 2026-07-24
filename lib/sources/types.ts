/**
 * The shapes the source views render. Not the database row: `organization_id`,
 * `created_by` and `document_key` are tenancy and identity plumbing that the
 * presentation layer has no business carrying.
 *
 * `locked` is a derived fact, computed from the existence of an analysis run that
 * references the revision. It is never read from a column, because no such column
 * exists — see 20260724000008.
 */

import type { SourceKind, SourceMetadata } from "../contracts/source";

export type SourceSummary = {
  id: string;
  title: string;
  kind: SourceKind;
  revisionNumber: number;
  /** True once an analysis run cites this revision. From then on it is frozen. */
  locked: boolean;
  /** The revision this one replaces, if any. */
  supersedesId: string | null;
  createdAt: string;
  updatedAt: string;
  sourceDate: string | null;
  /** First few lines, for the list. Never a substitute for the stored text. */
  preview: string;
  characterCount: number;
};

export type SourceDetail = Omit<SourceSummary, "preview"> & {
  projectId: string;
  /** Verbatim. Exactly the characters that were submitted. */
  rawText: string;
  metadata: SourceMetadata;
  createdBy: string;
  /** The revision that superseded this one, when someone has already moved on. */
  supersededById: string | null;
  supersededByRevision: number | null;
  /** How many analysis runs cite this revision — the reason it is locked. */
  analysisRunCount: number;
};
