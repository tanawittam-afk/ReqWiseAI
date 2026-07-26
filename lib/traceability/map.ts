/**
 * Relationship map layout — column-based, directed, and computed here rather than in
 * the component.
 *
 * Deliberately *not* a force-directed graph. `docs/design/INTERFACE.md` rules out
 * canvas, WebGL, heavy graph libraries, physics and continuous motion, and CLAUDE.md
 * rules out permanent glowing relationship lines. What is left is the thing a reviewer
 * actually needs: five fixed columns in spine order, nodes in a stable sequence, and
 * edges drawn as plain SVG between known coordinates.
 *
 * Stability matters as much as legibility. A layout that reshuffles between renders
 * destroys a reader's spatial memory of a document they are working through, so node
 * order is derived from display id — the one ordering that never changes — and never
 * from insertion order or a hash.
 *
 * Pure: no database, no React, no DOM measurement.
 */

import { TRACEABILITY_SPINE, type RelationType } from "../contracts/relations";
import { itemsById } from "./graph";
import type { TraceGraph, TraceItem } from "./types";

export type MapNode = {
  item: TraceItem;
  /** Column index into `MAP_COLUMNS`. */
  column: number;
  /** Position within the column, top to bottom. */
  row: number;
};

export type MapEdge = {
  fromId: string;
  toId: string;
  type: RelationType;
  legacy: boolean;
  /** True when both endpoints are on the map. An edge to an off-map item is dropped. */
  from: MapNode;
  to: MapNode;
};

export type MapLayout = {
  columns: Array<{ type: string; label: string; nodes: MapNode[] }>;
  edges: MapEdge[];
  /**
   * Index of the trailing "Related items" column within `columns`, or `-1` when the
   * current filter left nothing off-spine. Items not on the spine — risks, rules,
   * questions, findings — get their own column rather than being dropped, because an
   * open question with no home on the map is exactly the item a reviewer is hunting.
   */
  asideColumnIndex: number;
};

export const SHORT_LABEL: Record<string, string> = {
  business_objective: "Objectives",
  business_requirement: "Business req.",
  functional_requirement: "Functional req.",
  user_story: "User stories",
  acceptance_criterion: "Acceptance",
};

export const MAP_COLUMNS: ReadonlyArray<{ type: string; label: string }> = [
  ...TRACEABILITY_SPINE.map((type) => ({ type, label: SHORT_LABEL[type] ?? type })),
  { type: "__aside", label: "Related items" },
];

export const NODE_HEIGHT = 64;
export const NODE_GAP = 12;
export const COLUMN_WIDTH = 220;
export const COLUMN_GAP = 56;

export function layoutMap(graph: TraceGraph): MapLayout {
  const spineIndex = new Map(TRACEABILITY_SPINE.map((type, index) => [type as string, index]));
  const asideBucket = TRACEABILITY_SPINE.length;

  const buckets: TraceItem[][] = MAP_COLUMNS.map(() => []);
  for (const item of graph.items) {
    const column = spineIndex.get(item.type) ?? asideBucket;
    buckets[column].push(item);
  }

  /*
   * Empty columns are dropped, not rendered as gaps.
   *
   * This is a layout decision with a real failure behind it: filtering to open
   * questions leaves only the trailing column populated, and keeping the five empty
   * spine columns before it pushed the *only* content off the right-hand edge of a
   * horizontally-scrolling box. A reader saw a blank map and no reason for it.
   *
   * An empty column carries no information — the coverage row already says what is
   * missing, in words — so removing it costs nothing and keeps whatever survives the
   * filter on screen.
   */
  const kept = buckets
    .map((items, bucket) => ({ items, bucket }))
    .filter((entry) => entry.items.length > 0);

  // Display id is the only stable sort key: it is allocated once and never renumbered
  // (DATA-MODEL §C.10), so the same project lays out identically on every visit.
  const nodes = new Map<string, MapNode>();
  const columns = kept.map((entry, column) => {
    const sorted = [...entry.items].sort((a, b) => a.displayId.localeCompare(b.displayId, "en"));
    const columnNodes = sorted.map((item, row) => {
      const node: MapNode = { item, column, row };
      nodes.set(item.id, node);
      return node;
    });
    return {
      type: MAP_COLUMNS[entry.bucket].type,
      label: MAP_COLUMNS[entry.bucket].label,
      nodes: columnNodes,
    };
  });

  const asideColumnIndex = kept.findIndex((entry) => entry.bucket === asideBucket);

  const byId = itemsById(graph);
  const edges: MapEdge[] = [];
  for (const relation of graph.relations) {
    const from = nodes.get(relation.fromItemId);
    const to = nodes.get(relation.toItemId);
    // An endpoint outside the current filter has no coordinate, so there is nowhere
    // honest to draw the line to. The inspector still lists the relation.
    if (from === undefined || to === undefined) continue;
    if (!byId.has(relation.fromItemId) || !byId.has(relation.toItemId)) continue;
    edges.push({
      fromId: relation.fromItemId,
      toId: relation.toItemId,
      type: relation.type,
      legacy: relation.legacy,
      from,
      to,
    });
  }

  return { columns, edges, asideColumnIndex };
}

/** Left edge of a column, in SVG user units. */
export function columnX(column: number): number {
  return column * (COLUMN_WIDTH + COLUMN_GAP);
}

/** Top edge of a node, in SVG user units. */
export function nodeY(row: number): number {
  return row * (NODE_HEIGHT + NODE_GAP);
}

export function layoutSize(layout: MapLayout): { width: number; height: number } {
  const tallest = Math.max(1, ...layout.columns.map((column) => column.nodes.length));
  return {
    width: columnX(layout.columns.length - 1) + COLUMN_WIDTH,
    height: nodeY(tallest - 1) + NODE_HEIGHT,
  };
}

/**
 * The list-based alternative to the map, carrying the same information rather than a
 * summary of it. One entry per node, naming its column and every edge it touches.
 */
export function describeMapNode(
  layout: MapLayout,
  node: MapNode,
  labelOf: (edge: MapEdge, direction: "out" | "in") => string,
): string[] {
  const out = layout.edges.filter((edge) => edge.fromId === node.item.id);
  const inbound = layout.edges.filter((edge) => edge.toId === node.item.id);
  return [
    ...out.map((edge) => `${labelOf(edge, "out")} ${edge.to.item.displayId} ${edge.to.item.title}`),
    ...inbound.map(
      (edge) => `${labelOf(edge, "in")} ${edge.from.item.displayId} ${edge.from.item.title}`,
    ),
  ];
}
