/**
 * Matrix row construction — the primary traceability view.
 *
 * One row per complete-or-broken path down the spine:
 *
 *   Business objective │ Business requirement │ Functional requirement │ User story │ Acceptance criterion
 *
 * The interesting rows are the incomplete ones, so a gap must be a *rendered cell that
 * says what is missing*, never a blank. A blank is indistinguishable from "not loaded",
 * and a matrix whose holes are invisible is worse than no matrix.
 *
 * Rows are built by walking the spine from every top-level item, so a graph that starts
 * at a business requirement (no objective was extracted) still produces rows — it just
 * produces them with the objective cell missing rather than producing nothing.
 *
 * Pure: no database, no React.
 */

import { TRACEABILITY_SPINE } from "../contracts/relations";
import type { ItemType } from "../contracts/item-types";
import { childrenOfType, spineChildren } from "./graph";
import type { TraceGraph, TraceItem } from "./types";

export type MatrixCell =
  | { kind: "item"; item: TraceItem }
  | { kind: "missing"; type: ItemType; /** Why this cell is empty, in words. */ reason: string }
  | { kind: "not_applicable"; type: ItemType };

export type MatrixRow = {
  /** Stable across renders: the ids of the items on this path, joined. */
  key: string;
  cells: MatrixCell[];
  /** Every item appearing on this row — the search and filter surface. */
  itemIds: string[];
  /** True when at least one cell is a gap. Drives the "show only gaps" toggle. */
  hasGap: boolean;
};

const MISSING_REASON: Record<string, string> = {
  business_objective: "No business objective above this requirement",
  business_requirement: "No business requirement",
  functional_requirement: "No functional requirement beneath this",
  user_story: "No user story for this requirement",
  acceptance_criterion: "No acceptance criterion for this story",
};

/**
 * Items of a spine type that no item above them in the spine reaches.
 *
 * These are the roots the walk starts from. Without them, a run whose objective was
 * never extracted would contribute no rows at all, and the matrix would silently omit
 * every requirement in it.
 */
function rootsOf(
  graph: TraceGraph,
  children: Map<string, string[]>,
  type: ItemType,
  level: number,
): TraceItem[] {
  const higher = new Set(TRACEABILITY_SPINE.slice(0, level));
  const byId = new Map(graph.items.map((item) => [item.id, item]));
  const reachedFromAbove = new Set<string>();
  for (const [parentId, childIds] of children) {
    const parent = byId.get(parentId);
    if (parent === undefined || !higher.has(parent.type)) continue;
    for (const childId of childIds) reachedFromAbove.add(childId);
  }
  return graph.items.filter((item) => item.type === type && !reachedFromAbove.has(item.id));
}

/**
 * Build every row of the matrix.
 *
 * The walk is breadth-per-level rather than a full cartesian product: an FR with two
 * stories, each with two criteria, yields four rows, which is what a traceability
 * matrix means. A cap is applied per level so a pathological graph cannot produce an
 * unbounded table — reaching it is reported rather than silently truncated.
 */
export function buildMatrixRows(
  graph: TraceGraph,
  options: { maxRows?: number } = {},
): { rows: MatrixRow[]; truncated: boolean } {
  const maxRows = options.maxRows ?? 2000;
  const children = spineChildren(graph);

  // Seed: every item that is not reached from a higher spine level, at whichever level
  // it sits. Level 0 (objectives) always seeds; deeper levels seed only their orphans.
  type Path = Array<TraceItem | null>;
  let paths: Path[] = [];

  TRACEABILITY_SPINE.forEach((type, level) => {
    for (const root of rootsOf(graph, children, type, level)) {
      const path: Path = new Array(TRACEABILITY_SPINE.length).fill(null);
      path[level] = root;
      paths.push(path);
    }
  });

  // Extend each path down the spine, one level at a time.
  for (let level = 0; level < TRACEABILITY_SPINE.length - 1; level += 1) {
    const nextType = TRACEABILITY_SPINE[level + 1];
    const extended: Path[] = [];
    for (const path of paths) {
      const parent = path[level];
      if (parent === null) {
        extended.push(path);
        continue;
      }
      const kids = childrenOfType(graph, children, parent.id, nextType);
      if (kids.length === 0) {
        extended.push(path);
        continue;
      }
      for (const kid of kids) {
        const copy = [...path];
        copy[level + 1] = kid;
        extended.push(copy);
      }
    }
    paths = extended;
  }

  const truncated = paths.length > maxRows;
  const kept = truncated ? paths.slice(0, maxRows) : paths;

  const rows: MatrixRow[] = kept.map((path) => {
    const cells: MatrixCell[] = path.map((item, level) => {
      const type = TRACEABILITY_SPINE[level];
      if (item !== null) return { kind: "item", item };
      // A level above the row's own root is not a gap in that row — it is a level the
      // row never claimed to occupy. Saying "missing" there would report the same
      // absence once per descendant.
      const rootLevel = path.findIndex((cell) => cell !== null);
      if (rootLevel !== -1 && level < rootLevel) return { kind: "not_applicable", type };
      return { kind: "missing", type, reason: MISSING_REASON[type] ?? `No ${type}` };
    });

    const itemIds = path.filter((item): item is TraceItem => item !== null).map((i) => i.id);
    return {
      key: itemIds.join("/") || `empty-${cells.map((c) => c.kind).join("")}`,
      cells,
      itemIds,
      hasGap: cells.some((cell) => cell.kind === "missing"),
    };
  });

  return { rows, truncated };
}

/**
 * The accessible list alternative to the matrix and the map.
 *
 * Required to carry the *same* information, not a summary of it — a screen-reader user
 * who cannot perceive the grid must not be reading a lesser view. One sentence per
 * row, naming every cell including the gaps.
 */
export function describeMatrixRow(row: MatrixRow): string {
  return row.cells
    .map((cell) => {
      if (cell.kind === "item") return `${cell.item.displayId} ${cell.item.title}`;
      if (cell.kind === "not_applicable") return `no ${LEVEL_WORD[cell.type]} at this level`;
      return `missing ${LEVEL_WORD[cell.type]}`;
    })
    .join(", then ");
}

export const LEVEL_WORD: Record<string, string> = {
  business_objective: "business objective",
  business_requirement: "business requirement",
  functional_requirement: "functional requirement",
  user_story: "user story",
  acceptance_criterion: "acceptance criterion",
};

export const COLUMN_LABEL: Record<string, string> = {
  business_objective: "Business objective",
  business_requirement: "Business requirement",
  functional_requirement: "Functional requirement",
  user_story: "User story",
  acceptance_criterion: "Acceptance criterion",
};
