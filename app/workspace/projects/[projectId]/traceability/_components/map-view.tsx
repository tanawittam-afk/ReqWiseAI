"use client";

/**
 * The relationship map — plain SVG over an HTML column layout.
 *
 * What it deliberately is not: canvas, WebGL, a graph library, physics, or anything
 * that moves on its own. `docs/design/INTERFACE.md` rules all of those out, and
 * CLAUDE.md rules out permanent glowing relationship lines. Edges are static strokes
 * between coordinates `lib/traceability/map.ts` computed; there is no animation loop
 * and nothing re-lays-out on hover.
 *
 * Edges are drawn in an SVG layer behind the nodes, which are real focusable buttons
 * in normal document order. That ordering is the point: the map is navigable by Tab
 * and readable by a screen reader as a list of columns, and the SVG is `aria-hidden`
 * decoration over information that already exists in the DOM.
 *
 * The list alternative below the map carries every edge, with its label — not a
 * summary. A reader who cannot see the lines gets the same graph, in sentences.
 */

import { Icon } from "@/app/_components/icon";
import {
  COLUMN_WIDTH,
  NODE_HEIGHT,
  columnX,
  layoutSize,
  nodeY,
  type MapLayout,
  type MapNode,
} from "@/lib/traceability/map";
import type { TraceItem } from "@/lib/traceability/types";
import { LEGACY_BADGE, relationPhrase } from "./labels";

export function MapView({
  layout,
  selectedId,
  onSelect,
}: {
  layout: MapLayout;
  selectedId: string | null;
  onSelect: (item: TraceItem) => void;
}) {
  const size = layoutSize(layout);

  // `layoutMap` drops empty columns, so an empty `columns` means an empty graph.
  if (layout.columns.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-4 py-6 text-sm text-text-muted">
        No items match the current filters.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {/*
       * Horizontal scroll is confined to this box — the design brief asks for a
       * controllable horizontal scroll on tablet landscape, and the page body must
       * never scroll sideways.
       */}
      <div
        className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4"
        tabIndex={0}
        role="group"
        aria-label="Relationship map. Scrollable. Every node is also listed below."
      >
        <div className="relative" style={{ width: size.width, height: size.height + 28 }}>
          {/* Column headings, above the nodes they label. */}
          {layout.columns.map((column, index) => (
            <div
              key={column.type}
              aria-hidden="true"
              className="absolute text-[11px] font-semibold uppercase tracking-wide text-text-faint"
              style={{ left: columnX(index), top: 0, width: COLUMN_WIDTH }}
            >
              {column.label}
            </div>
          ))}

          {/* Edges. Decoration: every one of them is also a sentence in the list below. */}
          <svg
            aria-hidden="true"
            focusable="false"
            className="pointer-events-none absolute left-0"
            style={{ top: 28, width: size.width, height: size.height }}
            width={size.width}
            height={size.height}
          >
            {layout.edges.map((edge) => (
              <Edge key={`${edge.fromId}-${edge.toId}-${edge.type}`} edge={edge} />
            ))}
          </svg>

          {/* Nodes, in document order, column by column. */}
          {layout.columns.map((column) =>
            column.nodes.map((node) => (
              <Node
                key={node.item.id}
                node={node}
                selected={node.item.id === selectedId}
                onSelect={onSelect}
              />
            )),
          )}
        </div>
      </div>

      <details className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-3 py-2">
        <summary className="min-h-11 cursor-pointer text-xs font-medium text-text-muted">
          Map as a list ({layout.edges.length} relation
          {layout.edges.length === 1 ? "" : "s"})
        </summary>
        <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-text-muted">
          {layout.edges.map((edge) => (
            <li key={`list-${edge.fromId}-${edge.toId}-${edge.type}`}>
              <span className="font-mono text-text">{edge.from.item.displayId}</span>{" "}
              {edge.from.item.title} — {relationPhrase(edge.type, "out")} —{" "}
              <span className="font-mono text-text">{edge.to.item.displayId}</span>{" "}
              {edge.to.item.title}
              {edge.legacy ? ` (${LEGACY_BADGE})` : ""}
            </li>
          ))}
          {layout.edges.length === 0 ? (
            <li>No relations between the items currently shown.</li>
          ) : null}
        </ul>
      </details>
    </div>
  );
}

function Edge({ edge }: { edge: MapLayout["edges"][number] }) {
  const x1 = columnX(edge.from.column) + COLUMN_WIDTH;
  const y1 = nodeY(edge.from.row) + NODE_HEIGHT / 2;
  const x2 = columnX(edge.to.column);
  const y2 = nodeY(edge.to.row) + NODE_HEIGHT / 2;
  // A gentle cubic so two edges between adjacent columns stay distinguishable. The
  // curve is geometry, not motion: nothing here animates.
  const mid = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  return (
    <path
      d={d}
      fill="none"
      stroke="var(--border-strong)"
      strokeWidth={1.25}
      // Legacy edges are dashed as well as labelled, so the distinction survives a
      // monochrome print and a colour-blind reader alike.
      strokeDasharray={edge.legacy ? "4 3" : undefined}
    />
  );
}

function Node({
  node,
  selected,
  onSelect,
}: {
  node: MapNode;
  selected: boolean;
  onSelect: (item: TraceItem) => void;
}) {
  const { item } = node;
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-pressed={selected}
      className={`absolute flex flex-col gap-0.5 overflow-hidden rounded-[var(--radius-card)] border px-2.5 py-1.5 text-left transition-colors ${
        selected
          ? "border-accent-border bg-accent-soft"
          : "border-border-soft bg-surface hover:bg-surface-hover"
      }`}
      style={{
        left: columnX(node.column),
        top: nodeY(node.row) + 28,
        width: COLUMN_WIDTH,
        height: NODE_HEIGHT,
      }}
    >
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] font-semibold text-text-muted">
          {item.displayId}
        </span>
        <span className="truncate text-[10px] capitalize text-text-faint">
          {item.status.replace(/_/g, " ")}
        </span>
        {item.priority !== "unassigned" ? (
          <span className="truncate text-[10px] capitalize text-text-faint">{item.priority}</span>
        ) : null}
      </span>
      <span className="line-clamp-2 text-[11px] leading-snug text-text">{item.title}</span>
      <span className="sr-only">
        {item.hasSourceEvidence ? "Cited in the source." : "No source citation."}
      </span>
      {item.hasSourceEvidence ? (
        <span className="absolute right-2 top-1.5 text-signal">
          <Icon name="quote" size={10} />
        </span>
      ) : null}
    </button>
  );
}
