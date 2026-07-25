/**
 * Shaping an analysis run for the three-panel workspace: which tab an item belongs to,
 * how items group, how a search narrows them, and what a group header can honestly say
 * about itself.
 *
 * Pure and DB-free, like `highlight.ts` — the workspace is a client island, and every
 * decision it makes about *which* items to show is testable without a browser or a
 * database. Nothing here computes a metric the data does not contain: there is no
 * quality score and no coverage percentage, because neither exists
 * (`docs/design/INTERFACE.md` → implementation notes; ARCHITECTURE §A.4).
 */

import { ITEM_TYPES, PRIORITIES, type ItemType, type Priority } from "../contracts/item-types";
import { computeHighlightRanges } from "./highlight";
import type { AnalysisItemView } from "./queries";

/**
 * The three tabs.
 *
 * Questions and findings are the analysis talking about itself — what it could not
 * settle, and what it found wrong with its own output — and must never be mixed into
 * the requirements a reader is meant to take as findings. Slice 6A splits them apart
 * from each other as well: they now have separate workflows, separate RPCs and
 * separate inspector tabs, so one shared "Issues" tab would put two unrelated jobs
 * behind the same heading.
 */
export const ISSUE_TYPES: readonly ItemType[] = ["open_question", "quality_finding"];

export type WorkspaceTab = "requirements" | "questions" | "findings";

export type ItemPartition = {
  requirements: AnalysisItemView[];
  questions: AnalysisItemView[];
  findings: AnalysisItemView[];
};

export function partitionItems(items: readonly AnalysisItemView[]): ItemPartition {
  const requirements: AnalysisItemView[] = [];
  const questions: AnalysisItemView[] = [];
  const findings: AnalysisItemView[] = [];
  for (const item of items) {
    if (item.type === "open_question") questions.push(item);
    else if (item.type === "quality_finding") findings.push(item);
    else requirements.push(item);
  }
  return { requirements, questions, findings };
}

/** Which tab holds a given item — the one place that mapping is written down. */
export function tabForType(type: string): WorkspaceTab {
  if (type === "open_question") return "questions";
  if (type === "quality_finding") return "findings";
  return "requirements";
}

/**
 * An item has real evidence only when the database holds an exactly-located excerpt.
 * A domain-profile question has none, and inventing a highlight for it would be
 * fabricating the very thing the citation exists to prove (product spec §14).
 */
export function hasSourceEvidence(item: AnalysisItemView): boolean {
  return computeHighlightRanges(item).length > 0;
}

/* ------------------------------------------------------------------ grouping */

export const GROUP_MODES = [
  "type",
  "source_order",
  "review_status",
  "priority",
  "workflow_state",
] as const;
export type GroupMode = (typeof GROUP_MODES)[number];

export type ItemGroup = {
  /** Stable across renders — used as the React key and the collapse-state key. */
  key: string;
  label: string;
  items: AnalysisItemView[];
};

const STATUS_ORDER = [
  "draft",
  "needs_clarification",
  "reviewed",
  "approved",
  "rejected",
  "implemented",
] as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  needs_clarification: "Needs clarification",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
  implemented: "Implemented",
};

/** Open first: the states that still need somebody are the ones worth seeing. */
const WORKFLOW_STATE_ORDER = [
  "open",
  "acknowledged",
  "deferred",
  "answered",
  "resolved",
  "dismissed",
  "not_applicable",
] as const;

const WORKFLOW_STATE_GROUP_LABEL: Record<string, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  deferred: "Deferred",
  answered: "Answered",
  resolved: "Resolved",
  dismissed: "Dismissed",
  not_applicable: "Not applicable",
  none: "No workflow",
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  unassigned: "Unassigned",
};

/**
 * The earliest verified offset an item cites, or `Infinity` for an item that cites
 * nothing — uncited items sort last in source order, because there is no honest place
 * to put them among the cited ones.
 */
export function firstCitedOffset(item: AnalysisItemView): number {
  const ranges = computeHighlightRanges(item);
  return ranges.length > 0 ? ranges[0][0] : Number.POSITIVE_INFINITY;
}

/**
 * Groups in a fixed, meaningful order — never insertion order, which would change
 * between runs — and empty groups are dropped rather than rendered as noise.
 */
export function groupItems(items: readonly AnalysisItemView[], mode: GroupMode): ItemGroup[] {
  if (mode === "source_order") {
    const offsets = new Map(items.map((item) => [item.id, firstCitedOffset(item)]));
    const offsetOf = (item: AnalysisItemView) => offsets.get(item.id) ?? Number.POSITIVE_INFINITY;
    const sorted = [...items].sort((a, b) => {
      if (offsetOf(a) !== offsetOf(b)) return offsetOf(a) < offsetOf(b) ? -1 : 1;
      return a.displayId.localeCompare(b.displayId);
    });
    const cited = sorted.filter((item) => Number.isFinite(offsetOf(item)));
    const uncited = sorted.filter((item) => !Number.isFinite(offsetOf(item)));
    return [
      { key: "cited", label: "In source order", items: cited },
      { key: "uncited", label: "Not cited in the source", items: uncited },
    ].filter((group) => group.items.length > 0);
  }

  const order: readonly string[] =
    mode === "type"
      ? ITEM_TYPES
      : mode === "priority"
        ? PRIORITIES
        : mode === "workflow_state"
          ? WORKFLOW_STATE_ORDER
          : STATUS_ORDER;
  const labelOf = (key: string) =>
    mode === "type"
      ? TYPE_GROUP_LABEL[key as ItemType]
      : mode === "priority"
        ? (PRIORITY_LABEL[key] ?? key)
        : mode === "workflow_state"
          ? (WORKFLOW_STATE_GROUP_LABEL[key] ?? key)
          : (STATUS_LABEL[key] ?? key);
  const keyOf = (item: AnalysisItemView) =>
    mode === "type"
      ? item.type
      : mode === "priority"
        ? item.priority
        : mode === "workflow_state"
          ? (item.workflowState ?? "none")
          : item.status;

  const buckets = new Map<string, AnalysisItemView[]>();
  for (const key of order) buckets.set(key, []);
  for (const item of items) {
    const key = keyOf(item);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]); // a value the enum gained after this file was written
  }

  return [...buckets.entries()]
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => ({ key, label: labelOf(key), items: list }));
}

/** Plural group headings. Item-level labels live in the workspace's `labels.ts`. */
export const TYPE_GROUP_LABEL: Record<ItemType, string> = {
  problem_statement: "Problem statements",
  business_objective: "Business objectives",
  stakeholder: "Stakeholders",
  business_requirement: "Business requirements",
  functional_requirement: "Functional requirements",
  non_functional_requirement: "Non-functional requirements",
  user_story: "User stories",
  acceptance_criterion: "Acceptance criteria",
  business_rule: "Business rules",
  assumption: "Assumptions",
  risk: "Risks",
  constraint: "Constraints",
  open_question: "Open questions",
  quality_finding: "Quality findings",
};

/* ----------------------------------------------------------------- filtering */

export type ItemFilters = {
  query: string;
  type: ItemType | "all";
  priority: Priority | "all";
  status: string | "all";
  evidenceClass: string | "all";
  /** The question / quality workflow state. Only ever set on those two tabs. */
  workflowState: string | "all";
};

export const EMPTY_FILTERS: ItemFilters = {
  query: "",
  type: "all",
  priority: "all",
  status: "all",
  evidenceClass: "all",
  workflowState: "all",
};

export function hasActiveFilter(filters: ItemFilters): boolean {
  return (
    filters.type !== "all" ||
    filters.priority !== "all" ||
    filters.status !== "all" ||
    filters.evidenceClass !== "all" ||
    filters.workflowState !== "all"
  );
}

/**
 * Search reaches the excerpt as well as the title, because an analyst looking for
 * "refund" is looking for the *evidence* that mentions it as often as the requirement
 * that does. Matching is case-insensitive and substring-based — no fuzzy matching,
 * which would make it unclear why a row is on screen.
 */
export function filterItems(
  items: readonly AnalysisItemView[],
  filters: ItemFilters,
): AnalysisItemView[] {
  const needle = filters.query.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.priority !== "all" && item.priority !== filters.priority) return false;
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.evidenceClass !== "all" && item.evidenceClass !== filters.evidenceClass) return false;
    if (filters.workflowState !== "all" && item.workflowState !== filters.workflowState) return false;
    if (needle.length === 0) return true;

    const haystack = [
      item.displayId,
      item.title,
      item.description,
      item.rationale ?? "",
      item.resolutionText ?? "",
      ...item.sourceReferences.map((ref) => ref.excerpt),
      ...item.relatedDisplayIds,
    ]
      .join("\n")
      .toLowerCase();

    return haystack.includes(needle);
  });
}

/* -------------------------------------------------------------------- counts */

export type GroupStats = {
  count: number;
  /** Mean confidence, 0–1. `null` for an empty group rather than a misleading 0. */
  averageConfidence: number | null;
  /** How many items in the group carry at least one exactly-located excerpt. */
  citedCount: number;
};

export function groupStats(items: readonly AnalysisItemView[]): GroupStats {
  if (items.length === 0) return { count: 0, averageConfidence: null, citedCount: 0 };
  const total = items.reduce((sum, item) => sum + item.confidence, 0);
  const citedCount = items.filter((item) => computeHighlightRanges(item).length > 0).length;
  return { count: items.length, averageConfidence: total / items.length, citedCount };
}

export type RunSummary = {
  itemCount: number;
  requirementCount: number;
  openQuestions: number;
  risks: number;
  qualityFindings: number;
  /**
   * How many of those questions and findings are still `open` — since slice 6A the
   * two are different numbers, and conflating them would make a fully-answered run
   * look untouched.
   */
  questionsUnresolved: number;
  findingsUnresolved: number;
  /** Items with an exactly-located excerpt, out of all items. */
  citedCount: number;
};

export function runSummary(items: readonly AnalysisItemView[]): RunSummary {
  const { requirements, questions, findings } = partitionItems(items);
  const countOf = (type: ItemType) => items.filter((item) => item.type === type).length;
  return {
    itemCount: items.length,
    requirementCount: requirements.length,
    openQuestions: countOf("open_question"),
    risks: countOf("risk"),
    qualityFindings: countOf("quality_finding"),
    questionsUnresolved: questions.filter((item) => item.workflowState === "open").length,
    findingsUnresolved: findings.filter(
      (item) => item.workflowState === "open" || item.workflowState === "acknowledged",
    ).length,
    citedCount: items.filter((item) => computeHighlightRanges(item).length > 0).length,
  };
}
