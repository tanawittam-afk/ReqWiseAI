/**
 * The shapes the project UI renders. Deliberately not the database row: the row
 * carries `organization_id`, `created_by` and other facts the presentation layer has
 * no business knowing.
 */

import type { OutputLang } from "../contracts/analysis-input";
import type { ProjectStatus } from "../contracts/project";

export type ProjectDomain = {
  key: string;
  name: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  status: ProjectStatus;
  outputLang: OutputLang;
  domain: ProjectDomain | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  /** Card totals, embedded in the list query rather than counted per project. */
  sourceDocumentCount: number;
  analysisItemCount: number;
};

export type ProjectDetail = ProjectSummary & {
  description: string | null;
  businessObjective: string | null;
  knownStakeholders: string[];
  archiveReason: string | null;
  analysisRunCount: number;
};

/** What the list header summarises. Both counts are always shown, never inferred. */
export type ProjectCounts = {
  active: number;
  archived: number;
};
