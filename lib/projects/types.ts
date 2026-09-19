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
  /**
   * The project's output-language preference (Phase 2, Slice 6). `"fixed"` means
   * `outputLang` is the value every run uses. `"match_source"` means `outputLang` is a
   * frozen creation-time placeholder that **no run ever updates** —
   * `buildAnalysisInput()` re-resolves the real language fresh, via the Thai-ratio
   * detector, each time a run executes, but writes it only to that run's own
   * `analysis_runs.output_lang`, never back to this column. Never read `outputLang` as
   * "the current language" when `outputLangMode` is `"match_source"` — render the mode
   * instead (see `LangBadge`) or read the latest run's own value (see
   * `lib/export/load.ts`).
   */
  outputLangMode: "fixed" | "match_source";
  domain: ProjectDomain | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  /** Card totals, embedded in the list query rather than counted per project. */
  sourceDocumentCount: number;
  analysisItemCount: number;
  /**
   * The latest run's quality score (Phase 2, Slice 3), from the `project_quality_scores`
   * view. `null` means no run has ever completed for this project — distinct from a
   * real score of 0, which means a run exists and is doing badly.
   */
  qualityScore: number | null;
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
