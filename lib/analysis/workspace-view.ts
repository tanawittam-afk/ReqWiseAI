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
 * The two tabs. "Issues" is the analysis talking about itself — what it could not
 * settle and what it found wrong — and must never be mixed into the requirements a
 * reader is meant to take as findings.
 */
export const ISSUE_TYPES: readonly ItemType[] = ["open_question", "quality_finding"];

export type WorkspaceTab = "requirements" | "issues";

export function partitionItems(items: readonly AnalysisItemView[]): {
  requirements: AnalysisItemView[];
  issues: AnalysisItemView[];
} {
  const requirements: AnalysisItemView[] = [];
  const issues: AnalysisItemView[] = [];
  for (const item of items) {
    (ISSUE_TYPES.includes(item.type) ? issues : requirements).push(item);
  }
  return { requirements, issues };
}

/* ------------------------------------------------------------------ grouping */

export const GROUP_MODES = ["type", "source_order", "review_status", "priority"] as const;
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
    mode === "type" ? ITEM_TYPES : mode === "priority" ? PRIORITIES : STATUS_ORDER;
  const labelOf = (key: string) =>
    mode === "type"
      ? TYPE_GROUP_LABEL[key as ItemType]
      : mode === "priority"
        ? (PRIORITY_LABEL[key] ?? key)
        : (STATUS_LABEL[key] ?? key);
  const keyOf = (item: AnalysisItemView) =>
    mode === "type" ? item.type : mode === "priority" ? item.priority : item.status;

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
};

export const EMPTY_FILTERS: ItemFilters = {
  query: "",
  type: "all",
  priority: "all",
  status: "all",
  evidenceClass: "all",
};

export function hasActiveFilter(filters: ItemFilters): boolean {
  return (
    filters.type !== "all" ||
    filters.priority !== "all" ||
    filters.status !== "all" ||
    filters.evidenceClass !== "all"
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
    if (needle.length === 0) return true;

    const haystack = [
      item.displayId,
      item.title,
      item.description,
      item.rationale ?? "",
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
  /** Items with an exactly-located excerpt, out of all items. */
  citedCount: number;
};

export function runSummary(items: readonly AnalysisItemView[]): RunSummary {
  const { requirements } = partitionItems(items);
  const countOf = (type: ItemType) => items.filter((item) => item.type === type).length;
  return {
    itemCount: items.length,
    requirementCount: requirements.length,
    openQuestions: countOf("open_question"),
    risks: countOf("risk"),
    qualityFindings: countOf("quality_finding"),
    citedCount: items.filter((item) => computeHighlightRanges(item).length > 0).length,
  };
}
