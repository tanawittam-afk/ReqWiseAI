/**
 * Pure graph helpers over a `TraceGraph`.
 *
 * No database, no React, no I/O — the same discipline `lib/analysis/workspace-view.ts`
 * keeps, and for the same reason: every decision the traceability screens make about
 * *which* items relate to which is testable without a browser or a Postgres.
 */

import {
  canonicalHierarchyEdge,
  isHierarchicalRelationType,
  type RelationType,
} from "../contracts/relations";
import type { TraceGraph, TraceItem, TraceRelation } from "./types";

export type RelationEnd = {
  relation: TraceRelation;
  /** The item at the other end. `null` when it is outside the current filter. */
  other: TraceItem | null;
};

export function itemsById(graph: TraceGraph): Map<string, TraceItem> {
  return new Map(graph.items.map((item) => [item.id, item]));
}

/** Relations leaving an item, in the direction they are stored. */
export function outgoing(graph: TraceGraph, itemId: string): RelationEnd[] {
  const byId = itemsById(graph);
  return graph.relations
    .filter((r) => r.fromItemId === itemId)
    .map((relation) => ({ relation, other: byId.get(relation.toItemId) ?? null }));
}

/** Relations arriving at an item. Read with the inverse label in the inspector. */
export function incoming(graph: TraceGraph, itemId: string): RelationEnd[] {
  const byId = itemsById(graph);
  return graph.relations
    .filter((r) => r.toItemId === itemId)
    .map((relation) => ({ relation, other: byId.get(relation.fromItemId) ?? null }));
}

/**
 * The hierarchical spine as a parent → children adjacency map, with `derives_from`
 * flipped so a legacy run reads in the same direction as a typed one.
 */
export function spineChildren(graph: TraceGraph): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const relation of graph.relations) {
    if (!isHierarchicalRelationType(relation.type)) continue;
    const edge = canonicalHierarchyEdge(relation.type, relation.fromItemId, relation.toItemId);
    if (edge === null) continue;
    const [parent, child] = edge;
    const list = children.get(parent) ?? [];
    if (!list.includes(child)) list.push(child);
    children.set(parent, list);
  }
  return children;
}

/**
 * Children of `parent` that are of a given type, following the spine.
 *
 * Used by the matrix to walk OBJ → BR → FR → US → AC one column at a time. Type is
 * checked rather than assumed, because `validated_by` may run from a requirement as
 * well as a story, so "the children of this FR" is not automatically "the stories".
 */
export function childrenOfType(
  graph: TraceGraph,
  children: Map<string, string[]>,
  parentId: string,
  type: string,
): TraceItem[] {
  const byId = itemsById(graph);
  return (children.get(parentId) ?? [])
    .map((id) => byId.get(id))
    .filter((item): item is TraceItem => item !== undefined && item.type === type);
}

/** Every item that has at least one relation, in either direction. */
export function linkedItemIds(graph: TraceGraph): Set<string> {
  const linked = new Set<string>();
  for (const relation of graph.relations) {
    linked.add(relation.fromItemId);
    linked.add(relation.toItemId);
  }
  return linked;
}

/**
 * Cycles already committed to the database, over the hierarchical spine.
 *
 * Slice 6B refuses to *write* one, but 189 relations predate that rule. Reporting a
 * pre-existing loop as a warning is the honest treatment: rewriting it would mean
 * deciding which edge the analysis "meant", which is a reviewer's judgement and not a
 * migration's. Returned as the item ids on the loop so the UI can name them.
 */
export function findExistingCycles(graph: TraceGraph): string[][] {
  const children = spineChildren(graph);
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seen = new Set<string>();

  function visit(node: string): void {
    colour.set(node, GREY);
    stack.push(node);
    for (const child of children.get(node) ?? []) {
      const state = colour.get(child) ?? WHITE;
      if (state === GREY) {
        const loop = stack.slice(stack.indexOf(child));
        // Same loop reached from a different entry point is the same finding.
        const signature = [...loop].sort().join(" ");
        if (!seen.has(signature)) {
          seen.add(signature);
          cycles.push(loop);
        }
        continue;
      }
      if (state === WHITE) visit(child);
    }
    stack.pop();
    colour.set(node, BLACK);
  }

  for (const node of children.keys()) {
    if ((colour.get(node) ?? WHITE) === WHITE) visit(node);
  }
  return cycles;
}

/** Relation types present in a graph, for the legend and the filter. */
export function relationTypesPresent(graph: TraceGraph): RelationType[] {
  const present = new Set<RelationType>();
  for (const relation of graph.relations) present.add(relation.type);
  return [...present];
}
