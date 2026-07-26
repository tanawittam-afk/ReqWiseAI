/**
 * Filtering a `TraceGraph`.
 *
 * One rule governs the whole module: **filtering removes items, and an edge with a
 * removed endpoint goes with it.** A relation drawn to a node that is not on screen is
 * a line to nowhere, and a relation kept in the coverage count while its target is
 * hidden makes the count disagree with the view it sits above.
 *
 * Pure: no database, no React.
 */

import type { ItemType } from "../contracts/item-types";
import type { CoverageKey, CoverageReport } from "./coverage";
import type { TraceGraph } from "./types";

export type TraceFilters = {
  query: string;
  type: ItemType | "all";
  status: string | "all";
  priority: string | "all";
  /** Restrict to one analysis run. `all` shows the whole project. */
  runId: string | "all";
  /** Restrict to the items one coverage rule flagged. `none` disables it. */
  coverage: CoverageKey | "none";
};

export const EMPTY_TRACE_FILTERS: TraceFilters = {
  query: "",
  type: "all",
  status: "all",
  priority: "all",
  runId: "all",
  coverage: "none",
};

export function hasActiveTraceFilter(filters: TraceFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.runId !== "all" ||
    filters.coverage !== "none"
  );
}

/**
 * Apply the filters.
 *
 * `coverage` is applied against a report computed on the **unfiltered** graph, which
 * is the only way it can mean anything: "show me the orphans" has to mean orphans in
 * the project, not items that became orphans because the filter hid their neighbours.
 */
export function filterGraph(
  graph: TraceGraph,
  filters: TraceFilters,
  coverage: CoverageReport,
): TraceGraph {
  const needle = filters.query.trim().toLowerCase();
  const coverageIds =
    filters.coverage === "none" ? null : new Set(coverage.findings[filters.coverage].itemIds);

  const items = graph.items.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.priority !== "all" && item.priority !== filters.priority) return false;
    if (filters.runId !== "all" && item.analysisRunId !== filters.runId) return false;
    if (coverageIds !== null && !coverageIds.has(item.id)) return false;
    if (needle.length === 0) return true;
    return `${item.displayId} ${item.title}`.toLowerCase().includes(needle);
  });

  const visible = new Set(items.map((item) => item.id));
  const relations = graph.relations.filter(
    (relation) => visible.has(relation.fromItemId) && visible.has(relation.toItemId),
  );

  return { projectId: graph.projectId, items, relations };
}
