/**
 * Maps a `NormalizedAnalysis` (the engine's own output shape) onto the three prop
 * shapes `AnalysisWorkspace` actually renders — the same shapes
 * `lib/analysis/queries.ts` builds from a real database row, replicated here field by
 * field so this stays honest about what a demo run does and does not have.
 *
 * Fields `AnalysisItemView` carries that `NormalizedItem` does not (`workflowState`,
 * `resolutionText`, `changeRequests`, `versionNo` beyond its initial value, …) are
 * **derived from the run's own data and the same rules the database enforces** —
 * never invented. A demo run has no review history, because nothing was ever
 * reviewed; `history` is honestly empty per item, not a fabricated one.
 */

import type { OutputLang } from "../contracts/analysis-input";
import type { NormalizedAnalysis, NormalizedItem } from "../contracts/normalized";
import type { AnalysisItemView, AnalysisSourceReferenceView } from "../analysis/queries";
import type { AnalysisWorkspaceRun } from "../analysis/workspace-view";
import type { SourceDetail } from "../sources/types";
import type { ItemHistory } from "../review/history";
import { isWorkflowItemType } from "../contracts/workflow";
import { demoSourceDocument } from "./scenario";

const DEMO_PROJECT_ID = "demo-project";
const DEMO_RUN_ID = "demo-run";
const DEMO_TIMESTAMP = "2026-08-01T00:00:00.000Z";

function toSourceReferences(item: NormalizedItem): AnalysisSourceReferenceView[] {
  return item.sourceReferences.map((ref) => ({
    excerpt: ref.excerpt,
    startOffset: ref.startOffset ?? null,
    endOffset: ref.endOffset ?? null,
    evidenceStrength: ref.evidenceStrength ?? null,
    offsetVerified: ref.offsetVerified,
  }));
}

function toItemViews(analysis: NormalizedAnalysis): AnalysisItemView[] {
  const displayIdById = new Map(analysis.items.map((item) => [item.id, item.displayId]));

  const relatedByItem = new Map<string, string[]>();
  const candidatesByQuestion = new Map<string, string[]>();
  for (const relation of analysis.relations) {
    const toDisplayId = displayIdById.get(relation.toItemId);
    if (toDisplayId) {
      const list = relatedByItem.get(relation.fromItemId) ?? [];
      list.push(toDisplayId);
      relatedByItem.set(relation.fromItemId, list);
    }
    if (relation.type === "raises_question") {
      const list = candidatesByQuestion.get(relation.toItemId) ?? [];
      list.push(relation.fromItemId);
      candidatesByQuestion.set(relation.toItemId, list);
    }
  }

  return analysis.items.map((item) => ({
    id: item.id,
    displayId: item.displayId,
    providerKey: item.providerKey,
    type: item.type,
    title: item.title,
    description: item.description,
    priority: item.priority,
    status: item.status,
    evidenceClass: item.evidenceClass,
    origin: item.origin,
    confidence: item.confidence,
    rationale: item.rationale ?? null,
    attributes: item.attributes ?? null,
    versionNo: item.versionNo,
    updatedAt: item.updatedAt,
    // Mirrors the database CHECK constraint added in
    // 20260725000016_question_and_quality_workflow.sql: a question or finding is
    // always non-null and starts 'open'; every other type is always null. A demo run
    // is freshly generated and never persisted, so 'open' is not a guess — it is the
    // only value a fresh row of this type can ever hold.
    workflowState: isWorkflowItemType(item.type) ? "open" : null,
    resolutionText: null,
    resolvedAt: null,
    resolvedBy: null,
    followUpOn: null,
    sourceReferences: toSourceReferences(item),
    relatedDisplayIds: relatedByItem.get(item.id) ?? [],
    changeRequests: [],
    changeRequestCandidateItemIds: candidatesByQuestion.get(item.id) ?? [],
  }));
}

export function toDemoWorkspaceRun(analysis: NormalizedAnalysis): AnalysisWorkspaceRun {
  return {
    id: DEMO_RUN_ID,
    projectId: DEMO_PROJECT_ID,
    createdAt: DEMO_TIMESTAMP,
    items: toItemViews(analysis),
  };
}

export function toDemoSourceDetail(lang: OutputLang): SourceDetail {
  const doc = demoSourceDocument(lang);
  return {
    id: doc.id,
    title: doc.title,
    kind: "meeting_notes",
    revisionNumber: 1,
    locked: true,
    supersedesId: null,
    createdAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
    sourceDate: null,
    characterCount: doc.text.length,
    projectId: DEMO_PROJECT_ID,
    rawText: doc.text,
    metadata: { sourceDate: null, stakeholder: null, notes: null },
    createdBy: "demo",
    supersededById: null,
    supersededByRevision: null,
    analysisRunCount: 1,
  };
}

/** Every item honestly has no review history — nothing on a demo run was ever reviewed. */
export function toDemoHistory(analysis: NormalizedAnalysis): Record<string, ItemHistory> {
  const empty: ItemHistory = { versions: [], activities: [] };
  return Object.fromEntries(analysis.items.map((item) => [item.id, empty]));
}
