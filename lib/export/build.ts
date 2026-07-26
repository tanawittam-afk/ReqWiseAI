/**
 * Turning what the database holds into the one shape every format renders.
 *
 * Pure: no database, no React, no clock of its own — `generatedAt` is passed in, because
 * a function that reads the clock cannot be tested for determinism, and determinism is
 * the property this file exists to provide.
 *
 * **Ordering is a feature, not an implementation detail.** Markdown, JSON, CSV and the
 * printable page must list the same items in the same order, or a reviewer comparing two
 * formats of the same export will find differences that mean nothing. Nothing here
 * relies on object iteration order or on the order rows came back from Postgres;
 * `compareItems` is the single authority, and it ends in the row id so the comparison is
 * total even when two items share a display id and a timestamp.
 *
 * Two scoping rules that are easy to get wrong, stated once:
 *
 *  * **The status scope applies to requirements only.** An open question's status is
 *    always `draft` — the review workflow excludes it by construction (§C.11) — so
 *    filtering questions by status would delete every question from an approved-only
 *    export. Questions and findings are governed by their section toggles and their own
 *    workflow state instead.
 *  * **Coverage is computed over the whole project, never over the scope.** "3 orphans"
 *    describes a project; recomputing it against a filtered set would report gaps the
 *    filter created and hide the ones it hid. The document says which it is.
 */

import {
  ARCHIVED_NOTICE,
  EXPORT_SECTIONS,
  isStatusInScope,
  NO_DIRECT_EVIDENCE_NOTICE,
  SECTION_ITEM_TYPE,
  EXPORT_SCHEMA_VERSION,
  type ExportCoverage,
  type ExportEvidence,
  type ExportOpenQuestion,
  type ExportPackage,
  type ExportQualityFinding,
  type ExportRelation,
  type ExportRelationRef,
  type ExportRequirement,
  type ExportScope,
  type ExportSection,
  type ExportSource,
} from "../contracts/export.ts";
import { DISPLAY_ID_PREFIX, type ItemType } from "../contracts/item-types.ts";
import type { ItemStatus } from "../contracts/review.ts";
import { relationPhrase } from "../traceability/labels.ts";
import { computeCoverage, COVERAGE_DISCLAIMER } from "../traceability/coverage.ts";
import type { TraceGraph, TraceItem } from "../traceability/types.ts";
import { WORKFLOW_STATE_LABEL, type WorkflowState } from "../contracts/workflow.ts";
import { projectSlug } from "./filenames.ts";
import { labelFor, STATUS_LABEL, TYPE_LABEL } from "./labels.ts";
import type {
  ExportActivityInput,
  ExportInput,
  ExportItemInput,
  ExportReferenceInput,
} from "./types.ts";

/** The two observation types, which have a workflow instead of a review status. */
const OBSERVATION_TYPES: readonly ItemType[] = ["open_question", "quality_finding"];

function isObservation(type: ItemType): boolean {
  return OBSERVATION_TYPES.includes(type);
}

/**
 * Display ids sort as `prefix`, then as a **number**, never as text: `FR-2` before
 * `FR-10`, which string comparison gets backwards. An id that does not match the shape
 * still sorts, at the end of its prefix, rather than throwing — a document is not the
 * place to discover that an id was malformed.
 */
export function displayIdParts(displayId: string): { prefix: string; number: number } {
  const match = /^([A-Za-z]+)-(\d+)$/.exec(displayId);
  if (!match) return { prefix: displayId, number: Number.MAX_SAFE_INTEGER };
  return { prefix: match[1], number: Number.parseInt(match[2], 10) };
}

/**
 * The total order: display-id prefix, then its number, then creation time, then the row
 * id. The last two are tie-breakers that should never be needed — a project cannot hold
 * two items with the same display id — and are there so the order is defined anyway.
 */
export function compareItems(a: ExportItemInput, b: ExportItemInput): number {
  const left = displayIdParts(a.displayId);
  const right = displayIdParts(b.displayId);
  if (left.prefix !== right.prefix) return left.prefix < right.prefix ? -1 : 1;
  if (left.number !== right.number) return left.number - right.number;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The graph shape `lib/traceability/` already computes coverage from. */
function toTraceGraph(input: ExportInput): TraceGraph {
  const cited = new Set(input.references.map((reference) => reference.itemId));
  const items: TraceItem[] = input.items.map((item) => ({
    id: item.id,
    displayId: item.displayId,
    type: item.type,
    title: item.title,
    status: item.status,
    priority: item.priority,
    workflowState: item.workflowState,
    analysisRunId: item.analysisRunId,
    hasSourceEvidence: cited.has(item.id),
  }));
  return {
    projectId: input.project.id,
    items,
    relations: input.relations.map((relation) => ({
      fromItemId: relation.fromItemId,
      toItemId: relation.toItemId,
      type: relation.type,
      legacy: relation.legacy,
    })),
  };
}

function sectionFor(type: ItemType): ExportSection | null {
  for (const section of EXPORT_SECTIONS) {
    if (SECTION_ITEM_TYPE[section] === type) return section;
  }
  return null;
}

/** Whether this item's own section is switched on. */
function typeIncluded(scope: ExportScope, type: ItemType): boolean {
  const section = sectionFor(type);
  return section === null ? false : scope.sections[section];
}

function buildEvidence(
  references: ExportReferenceInput[],
  sourcesById: Map<string, ExportInput["sources"][number]>,
): ExportEvidence[] {
  return references
    .map((reference) => {
      const source = sourcesById.get(reference.sourceDocumentId);
      return { reference, source };
    })
    .filter((pair): pair is { reference: ExportReferenceInput; source: ExportInput["sources"][number] } =>
      pair.source !== undefined,
    )
    // Deterministic: by the cited revision, then by where in it the excerpt starts. A
    // citation with no offsets sorts after the located ones rather than randomly among
    // them.
    .sort((a, b) => {
      if (a.source.revisionNumber !== b.source.revisionNumber) {
        return a.source.revisionNumber - b.source.revisionNumber;
      }
      const left = a.reference.startOffset ?? Number.MAX_SAFE_INTEGER;
      const right = b.reference.startOffset ?? Number.MAX_SAFE_INTEGER;
      if (left !== right) return left - right;
      return a.reference.excerpt < b.reference.excerpt ? -1 : 1;
    })
    .map(({ reference, source }) => ({
      sourceRevisionId: source.id,
      sourceTitle: source.title,
      sourceKind: source.kind,
      revisionNumber: source.revisionNumber,
      excerpt: reference.excerpt,
      startOffset: reference.startOffset,
      endOffset: reference.endOffset,
      offsetVerified: reference.offsetVerified,
    }));
}

/**
 * The sentence an item shows where a citation would go, or `null` when nothing needs
 * saying.
 *
 * A `domain_profile` item has no source evidence *by construction* — a profile is
 * context, never evidence (AI-OUTPUT-CONTRACT §D.6) — and the honest thing to print is
 * that fact. What must never happen is a plausible-looking excerpt chosen because it was
 * nearby, which is why nothing in this file ever selects an excerpt itself.
 */
function evidenceNotice(item: ExportItemInput, evidence: ExportEvidence[]): string | null {
  if (evidence.length > 0) return null;
  if (item.origin === "domain_profile" || item.origin === "quality_rule") {
    return NO_DIRECT_EVIDENCE_NOTICE;
  }
  return null;
}

function relationRefs(
  itemId: string,
  input: ExportInput,
  exported: Set<string>,
  displayIdById: Map<string, string>,
): ExportRelationRef[] {
  const refs: ExportRelationRef[] = [];

  for (const relation of input.relations) {
    // Both ends must be in the document. A relation naming an item the reader cannot
    // find is a dangling reference, and a document is exactly where that is unhelpful.
    if (!exported.has(relation.fromItemId) || !exported.has(relation.toItemId)) continue;

    if (relation.fromItemId === itemId) {
      refs.push({
        phrase: relationPhrase(relation.type, "out"),
        displayId: displayIdById.get(relation.toItemId) ?? "",
        type: relation.type,
        direction: "out",
        legacy: relation.legacy,
      });
    } else if (relation.toItemId === itemId) {
      refs.push({
        phrase: relationPhrase(relation.type, "in"),
        displayId: displayIdById.get(relation.fromItemId) ?? "",
        type: relation.type,
        direction: "in",
        legacy: relation.legacy,
      });
    }
  }

  return refs.sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === "out" ? -1 : 1;
    const left = displayIdParts(a.displayId);
    const right = displayIdParts(b.displayId);
    if (left.prefix !== right.prefix) return left.prefix < right.prefix ? -1 : 1;
    if (left.number !== right.number) return left.number - right.number;
    return a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
  });
}

function reviewSummary(activities: ExportActivityInput[]): ExportRequirement["review"] {
  if (activities.length === 0) return { activityCount: 0, lastActivity: null };
  const newest = [...activities].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)).at(-1);
  return {
    activityCount: activities.length,
    lastActivity: newest ? { label: newest.label, at: newest.createdAt } : null,
  };
}

function buildCoverage(input: ExportInput, requirementApprovedCount: number): ExportCoverage {
  const graph = toTraceGraph(input);
  const report = computeCoverage(graph);
  const displayIdById = new Map(graph.items.map((item) => [item.id, item.displayId]));

  const gaps = Object.values(report.findings)
    .map((finding) => ({
      key: finding.key as string,
      label: finding.label,
      meaning: finding.meaning,
      displayIds: finding.itemIds
        .map((id) => displayIdById.get(id) ?? "")
        .filter((displayId) => displayId !== "")
        .sort((a, b) => {
          const left = displayIdParts(a);
          const right = displayIdParts(b);
          if (left.prefix !== right.prefix) return left.prefix < right.prefix ? -1 : 1;
          return left.number - right.number;
        }),
    }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  return {
    totals: {
      items: report.totals.items,
      linked: report.totals.linked,
      orphans: report.totals.orphans,
      missingAcceptanceCriteria: report.totals.missingAcceptanceCriteria,
      openQuestions: report.totals.openQuestions,
      unresolvedQualityFindings: report.totals.unresolvedQualityFindings,
      itemsWithSourceEvidence: graph.items.filter((item) => item.hasSourceEvidence).length,
      approvedRequirements: requirementApprovedCount,
    },
    gaps,
    disclaimer: COVERAGE_DISCLAIMER,
  };
}

/**
 * Builds the package.
 *
 * `generatedAt` is the caller's — usually `new Date().toISOString()` in a route handler,
 * and a fixed string in a test. It is the only value in the package that is allowed to
 * differ between two exports of unchanged data.
 */
export function buildExportPackage(
  input: ExportInput,
  scope: ExportScope,
  generatedAt: string,
): ExportPackage {
  const sourcesById = new Map(input.sources.map((source) => [source.id, source]));
  const includeEvidence = scope.sections.source_evidence;

  const referencesByItem = new Map<string, ExportReferenceInput[]>();
  for (const reference of input.references) {
    const list = referencesByItem.get(reference.itemId) ?? [];
    list.push(reference);
    referencesByItem.set(reference.itemId, list);
  }

  const activitiesByItem = new Map<string, ExportActivityInput[]>();
  for (const activity of input.activities) {
    const list = activitiesByItem.get(activity.itemId) ?? [];
    list.push(activity);
    activitiesByItem.set(activity.itemId, list);
  }

  const ordered = [...input.items].sort(compareItems);
  const displayIdById = new Map(input.items.map((item) => [item.id, item.displayId]));

  const requirementItems = ordered.filter(
    (item) =>
      !isObservation(item.type) &&
      typeIncluded(scope, item.type) &&
      isStatusInScope(scope.status, item.status),
  );
  const questionItems = ordered.filter(
    (item) => item.type === "open_question" && scope.sections.open_questions,
  );
  const findingItems = ordered.filter(
    (item) => item.type === "quality_finding" && scope.sections.quality_findings,
  );

  const exported = new Set<string>([
    ...requirementItems.map((item) => item.id),
    ...questionItems.map((item) => item.id),
    ...findingItems.map((item) => item.id),
  ]);

  const evidenceFor = (item: ExportItemInput): ExportEvidence[] =>
    includeEvidence ? buildEvidence(referencesByItem.get(item.id) ?? [], sourcesById) : [];

  const requirements: ExportRequirement[] = requirementItems.map((item) => {
    const evidence = evidenceFor(item);
    return {
      displayId: item.displayId,
      type: item.type,
      typeLabel: TYPE_LABEL[item.type],
      title: item.title,
      description: item.description,
      priority: item.priority,
      status: item.status as ItemStatus,
      statusLabel: labelFor(STATUS_LABEL, item.status),
      versionNo: item.versionNo,
      // Version 1 is the analysis's own wording (`INITIAL_VERSION_NO`), so anything
      // above it means a person rewrote this. The current text is what is exported —
      // never the AI's first draft.
      humanEdited: item.versionNo > 1,
      evidenceClass: item.evidenceClass,
      origin: item.origin,
      confidence: scope.includeConfidence ? item.confidence : null,
      rationale: item.evidenceClass === "inferred" ? item.rationale : null,
      sourceEvidence: evidence,
      evidenceNotice: includeEvidence ? evidenceNotice(item, evidence) : null,
      relations: scope.sections.traceability
        ? relationRefs(item.id, input, exported, displayIdById)
        : [],
      review: reviewSummary(activitiesByItem.get(item.id) ?? []),
      analysisRunId: item.analysisRunId,
    };
  });

  const workflowCommon = (item: ExportItemInput) => {
    const evidence = evidenceFor(item);
    const state = (item.workflowState ?? "open") as WorkflowState;
    return {
      displayId: item.displayId,
      title: item.title,
      description: item.description,
      workflowState: state,
      workflowStateLabel: WORKFLOW_STATE_LABEL[state] ?? state,
      origin: item.origin,
      confidence: scope.includeConfidence ? item.confidence : null,
      resolutionText: item.resolutionText,
      resolvedAt: item.resolvedAt,
      followUpOn: item.followUpOn,
      sourceEvidence: evidence,
      evidenceNotice: includeEvidence ? evidenceNotice(item, evidence) : null,
      relations: scope.sections.traceability
        ? relationRefs(item.id, input, exported, displayIdById)
        : [],
      review: reviewSummary(activitiesByItem.get(item.id) ?? []),
      analysisRunId: item.analysisRunId,
    };
  };

  const openQuestions: ExportOpenQuestion[] = questionItems.map((item) => ({
    ...workflowCommon(item),
    // "Outstanding" is the split the document reads by: open and deferred are still
    // waiting on a stakeholder; answered and not-applicable are closed.
    outstanding: item.workflowState === "open" || item.workflowState === "deferred",
  }));

  const qualityFindings: ExportQualityFinding[] = findingItems.map((item) => {
    const kind = item.attributes?.finding_kind;
    return {
      ...workflowCommon(item),
      findingKind: typeof kind === "string" ? kind : null,
      // `acknowledged` explicitly means seen, not fixed (§C.12), so it counts as
      // unresolved here.
      unresolved: item.workflowState === "open" || item.workflowState === "acknowledged",
    };
  });

  const relations: ExportRelation[] = scope.sections.traceability
    ? input.relations
        .filter(
          (relation) => exported.has(relation.fromItemId) && exported.has(relation.toItemId),
        )
        .map((relation) => {
          const from = input.items.find((item) => item.id === relation.fromItemId);
          const to = input.items.find((item) => item.id === relation.toItemId);
          return { relation, from, to };
        })
        .filter(
          (row): row is { relation: (typeof input.relations)[number]; from: ExportItemInput; to: ExportItemInput } =>
            row.from !== undefined && row.to !== undefined,
        )
        .map(({ relation, from, to }) => ({
          fromDisplayId: from.displayId,
          fromType: from.type,
          fromStatus: from.status,
          type: relation.type,
          phrase: relationPhrase(relation.type, "out"),
          toDisplayId: to.displayId,
          toType: to.type,
          toStatus: to.status,
          legacy: relation.legacy,
        }))
        .sort((a, b) => {
          const left = displayIdParts(a.fromDisplayId);
          const right = displayIdParts(b.fromDisplayId);
          if (left.prefix !== right.prefix) return left.prefix < right.prefix ? -1 : 1;
          if (left.number !== right.number) return left.number - right.number;
          if (a.type !== b.type) return a.type < b.type ? -1 : 1;
          const toLeft = displayIdParts(a.toDisplayId);
          const toRight = displayIdParts(b.toDisplayId);
          if (toLeft.prefix !== toRight.prefix) return toLeft.prefix < toRight.prefix ? -1 : 1;
          return toLeft.number - toRight.number;
        })
    : [];

  const sources: ExportSource[] = includeEvidence
    ? [...input.sources]
        .sort((a, b) =>
          a.revisionNumber !== b.revisionNumber
            ? a.revisionNumber - b.revisionNumber
            : a.createdAt < b.createdAt
              ? -1
              : 1,
        )
        .map((source) => ({
          revisionId: source.id,
          title: source.title,
          kind: source.kind,
          revisionNumber: source.revisionNumber,
          locked: source.locked,
          sourceDate: source.sourceDate,
          characterCount: source.rawText.length,
          createdAt: source.createdAt,
        }))
    : [];

  const approvedRequirements = requirements.filter((item) => item.status === "approved").length;

  const versionsByItem = new Map<string, ExportInput["versions"]>();
  for (const version of input.versions) {
    const list = versionsByItem.get(version.itemId) ?? [];
    list.push(version);
    versionsByItem.set(version.itemId, list);
  }

  const versionSummary = scope.sections.version_summary
    ? requirementItems.map((item) => {
        const versions = [...(versionsByItem.get(item.id) ?? [])].sort(
          (a, b) => a.versionNo - b.versionNo,
        );
        const newest = versions.at(-1) ?? null;
        return {
          displayId: item.displayId,
          versionNo: item.versionNo,
          versionCount: versions.length,
          lastChangedAt: newest?.createdAt ?? null,
          lastChangeReason: newest?.changeReason ?? null,
        };
      })
    : [];

  const reviewActivitySummary = scope.sections.review_activity
    ? [...requirementItems, ...questionItems, ...findingItems]
        .flatMap((item) =>
          (activitiesByItem.get(item.id) ?? []).map((activity) => ({
            displayId: item.displayId,
            label: activity.label,
            at: activity.createdAt,
            comment: activity.comment,
          })),
        )
        .sort((a, b) => {
          const left = displayIdParts(a.displayId);
          const right = displayIdParts(b.displayId);
          if (left.prefix !== right.prefix) return left.prefix < right.prefix ? -1 : 1;
          if (left.number !== right.number) return left.number - right.number;
          if (a.at !== b.at) return a.at < b.at ? -1 : 1;
          return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
        })
    : [];

  const archived = input.project.status === "archived";

  /**
   * The archived notice is **not** an optional section.
   *
   * Everything else here is the reader's choice, but where a document came from is not
   * theirs to switch off: a reader who cannot tell that a package was produced from a
   * frozen project may act on requirements nobody can still change. The one sentence
   * stays.
   */
  const notices = archived ? [ARCHIVED_NOTICE] : [];

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt,
    project: {
      id: input.project.id,
      name: input.project.name,
      slug: projectSlug(input.project.name),
      description: input.project.description,
      businessObjective: input.project.businessObjective,
      knownStakeholders: input.project.knownStakeholders,
      domain: input.project.domain,
      outputLang: input.project.outputLang,
      status: input.project.status,
      archived,
      archiveReason: input.project.archiveReason,
      createdAt: input.project.createdAt,
      counts: {
        sources: input.project.sourceCount,
        analysisRuns: input.project.analysisRunCount,
        requirements: requirements.length,
        approvedRequirements,
        openQuestions: openQuestions.filter((question) => question.outstanding).length,
        unresolvedQualityFindings: qualityFindings.filter((finding) => finding.unresolved).length,
      },
    },
    scope,
    sources,
    requirements,
    openQuestions,
    qualityFindings,
    relations,
    coverage: buildCoverage(input, approvedRequirements),
    versionSummary,
    reviewActivitySummary,
    notices,
  };
}

// --- the document's shape --------------------------------------------------

/**
 * The ordered sections a *document* renders — Markdown and the printable page walk this
 * same list, so the two can never disagree about order or about what is present.
 *
 * Item sections that ended up empty are dropped: a heading followed by nothing tells a
 * reader the analysis found none of something, which is a claim the filter, not the
 * analysis, is responsible for.
 */
export type DocumentSection =
  | { kind: "requirements"; id: ExportSection; heading: string; items: ExportRequirement[] }
  | { kind: "questions"; id: "open_questions"; heading: string; outstanding: boolean; items: ExportOpenQuestion[] }
  | { kind: "findings"; id: "quality_findings"; heading: string; unresolved: boolean; items: ExportQualityFinding[] }
  | { kind: "traceability"; id: "traceability"; heading: string }
  | { kind: "coverage"; id: "coverage"; heading: string }
  | { kind: "sources"; id: "source_evidence"; heading: string }
  | { kind: "versions"; id: "version_summary"; heading: string }
  | { kind: "activity"; id: "review_activity"; heading: string };

export const REQUIREMENT_SECTION_ORDER: readonly ExportSection[] = [
  "problem_statement",
  "business_objectives",
  "stakeholders",
  "business_requirements",
  "functional_requirements",
  "non_functional_requirements",
  "user_stories",
  "acceptance_criteria",
  "business_rules",
  "assumptions",
  "risks",
  "constraints",
];

const SECTION_HEADING: Record<string, string> = {
  problem_statement: "Problem statements",
  business_objectives: "Business objectives",
  stakeholders: "Stakeholders",
  business_requirements: "Business requirements",
  functional_requirements: "Functional requirements",
  non_functional_requirements: "Non-functional requirements",
  user_stories: "User stories",
  acceptance_criteria: "Acceptance criteria",
  business_rules: "Business rules",
  assumptions: "Assumptions",
  risks: "Risks",
  constraints: "Constraints",
};

export const OUTSTANDING_QUESTIONS_HEADING = "Outstanding stakeholder questions";
export const RESOLVED_QUESTIONS_HEADING = "Resolved stakeholder questions";
export const UNRESOLVED_FINDINGS_HEADING = "Unresolved quality findings";
export const CLOSED_FINDINGS_HEADING = "Resolved or dismissed findings";
export const TRACEABILITY_HEADING = "Traceability";
export const COVERAGE_HEADING = "Coverage summary";
export const SOURCE_APPENDIX_HEADING = "Source appendix";
export const VERSION_HEADING = "Version summary";
export const ACTIVITY_HEADING = "Review activity summary";

export function documentSections(pkg: ExportPackage): DocumentSection[] {
  const sections: DocumentSection[] = [];

  for (const id of REQUIREMENT_SECTION_ORDER) {
    const type = SECTION_ITEM_TYPE[id];
    if (!type) continue;
    const items = pkg.requirements.filter((requirement) => requirement.type === type);
    if (items.length === 0) continue;
    sections.push({ kind: "requirements", id, heading: SECTION_HEADING[id], items });
  }

  const outstanding = pkg.openQuestions.filter((question) => question.outstanding);
  const resolved = pkg.openQuestions.filter((question) => !question.outstanding);
  if (outstanding.length > 0) {
    sections.push({
      kind: "questions",
      id: "open_questions",
      heading: OUTSTANDING_QUESTIONS_HEADING,
      outstanding: true,
      items: outstanding,
    });
  }
  if (resolved.length > 0) {
    sections.push({
      kind: "questions",
      id: "open_questions",
      heading: RESOLVED_QUESTIONS_HEADING,
      outstanding: false,
      items: resolved,
    });
  }

  const unresolved = pkg.qualityFindings.filter((finding) => finding.unresolved);
  const closed = pkg.qualityFindings.filter((finding) => !finding.unresolved);
  if (unresolved.length > 0) {
    sections.push({
      kind: "findings",
      id: "quality_findings",
      heading: UNRESOLVED_FINDINGS_HEADING,
      unresolved: true,
      items: unresolved,
    });
  }
  if (closed.length > 0) {
    sections.push({
      kind: "findings",
      id: "quality_findings",
      heading: CLOSED_FINDINGS_HEADING,
      unresolved: false,
      items: closed,
    });
  }

  if (pkg.scope.sections.traceability) {
    sections.push({ kind: "traceability", id: "traceability", heading: TRACEABILITY_HEADING });
  }
  if (pkg.scope.sections.coverage) {
    sections.push({ kind: "coverage", id: "coverage", heading: COVERAGE_HEADING });
  }
  if (pkg.scope.sections.source_evidence && pkg.sources.length > 0) {
    sections.push({ kind: "sources", id: "source_evidence", heading: SOURCE_APPENDIX_HEADING });
  }
  if (pkg.scope.sections.version_summary && pkg.versionSummary.length > 0) {
    sections.push({ kind: "versions", id: "version_summary", heading: VERSION_HEADING });
  }
  if (pkg.scope.sections.review_activity && pkg.reviewActivitySummary.length > 0) {
    sections.push({ kind: "activity", id: "review_activity", heading: ACTIVITY_HEADING });
  }

  return sections;
}

/** Prefix a display id would use, so a UI can name a section without an item in hand. */
export function prefixFor(type: ItemType): string {
  return DISPLAY_ID_PREFIX[type];
}
