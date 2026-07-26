"use client";

/**
 * The Traceability workspace.
 *
 * Owns view state — which pane, which filters, which item is selected — and nothing
 * else. Every decision about *what the data means* (which rows the matrix has, which
 * items are orphans, where a node sits on the map) lives in `lib/traceability/`, pure
 * and tested without a browser, exactly as `lib/analysis/workspace-view.ts` is for the
 * Analysis Workspace.
 *
 * Layout, following `docs/design/INTERFACE.md` and the slice brief:
 *
 * | Width | Layout |
 * |---|---|
 * | ≥1280 (`xl`) | toolbar, one-row coverage summary, matrix or map, inspector at the right |
 * | 1024–1279 (`lg`) | matrix or map full width; the inspector is a drawer over it |
 * | <1024 | one pane at a time via a segmented control, selection preserved |
 *
 * The selected item survives every one of those transitions, and survives switching
 * between the matrix and the map — a reviewer following one requirement down the chain
 * should not lose their place by changing how they are looking at it.
 */

import { useCallback, useMemo, useState } from "react";
import type { CoverageKey } from "@/lib/traceability/coverage";
import { computeCoverage } from "@/lib/traceability/coverage";
import { incoming, outgoing } from "@/lib/traceability/graph";
import { EMPTY_TRACE_FILTERS, filterGraph, hasActiveTraceFilter, type TraceFilters } from "@/lib/traceability/filters";
import { layoutMap } from "@/lib/traceability/map";
import { buildMatrixRows } from "@/lib/traceability/matrix";
import { workspaceHref } from "@/lib/traceability/queries";
import type { TraceRun } from "@/lib/traceability/queries";
import type { TraceGraph, TraceItem } from "@/lib/traceability/types";
import { ITEM_TYPES } from "@/lib/contracts/item-types";
import { formatDate } from "@/app/workspace/_components/badges";
import { CoverageRow } from "./_components/coverage-row";
import { TraceInspector } from "./_components/inspector";
import { MapView } from "./_components/map-view";
import { MatrixView } from "./_components/matrix-view";
import { TYPE_LABEL } from "../analyses/[runId]/_components/labels";

type View = "matrix" | "map";

/**
 * The narrow-screen pane.
 *
 * `"board"` rather than `"matrix" | "map"` on purpose: which board is showing is
 * already `view`, and giving the switcher its own copy of that made both the Matrix
 * and the Map button read as pressed at once. One fact, one place.
 */
type Pane = "coverage" | "board" | "inspector";

const STATUSES = ["draft", "needs_clarification", "reviewed", "approved", "rejected"] as const;
const PRIORITIES = ["critical", "high", "medium", "low", "unassigned"] as const;

export function TraceabilityView({
  projectId,
  projectName,
  graph,
  runs,
  archived,
  initialRunId,
}: {
  projectId: string;
  projectName: string;
  graph: TraceGraph;
  runs: TraceRun[];
  archived: boolean;
  /** From `?run=`, so a link out of one analysis lands on that analysis's items. */
  initialRunId: string | null;
}) {
  const [filters, setFilters] = useState<TraceFilters>({
    ...EMPTY_TRACE_FILTERS,
    runId: initialRunId ?? "all",
  });
  const [view, setView] = useState<View>("matrix");
  const [pane, setPane] = useState<Pane>("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [onlyGaps, setOnlyGaps] = useState(false);

  /*
   * Coverage is computed on the WHOLE graph, before filtering. "Show me the orphans"
   * has to mean orphans in the project — an item that looks orphaned only because a
   * filter hid its neighbour is a filtering artefact, not a finding.
   */
  const coverage = useMemo(() => computeCoverage(graph), [graph]);
  const filtered = useMemo(
    () => filterGraph(graph, filters, coverage),
    [graph, filters, coverage],
  );

  const { rows, truncated } = useMemo(() => buildMatrixRows(filtered), [filtered]);
  const visibleRows = useMemo(
    () => (onlyGaps ? rows.filter((row) => row.hasGap) : rows),
    [rows, onlyGaps],
  );
  const layout = useMemo(() => layoutMap(filtered), [filtered]);

  // The selected item is looked up in the *unfiltered* graph, so filtering to a subset
  // does not silently blank the inspector for an item the reader is still working on.
  const selected = useMemo(
    () => graph.items.find((item) => item.id === selectedId) ?? null,
    [graph.items, selectedId],
  );
  const selectedOut = useMemo(
    () => (selected ? outgoing(graph, selected.id) : []),
    [graph, selected],
  );
  const selectedIn = useMemo(
    () => (selected ? incoming(graph, selected.id) : []),
    [graph, selected],
  );

  const select = useCallback((item: TraceItem) => {
    setSelectedId(item.id);
    setInspectorOpen(true);
  }, []);

  const selectById = useCallback((itemId: string) => {
    setSelectedId(itemId);
    setInspectorOpen(true);
  }, []);

  const setFilter = useCallback(<K extends keyof TraceFilters>(key: K, value: TraceFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const onCoverageFilter = useCallback((key: CoverageKey | "none") => {
    setFilters((current) => ({ ...current, coverage: key }));
  }, []);

  const board =
    view === "matrix" ? (
      <MatrixView
        rows={visibleRows}
        truncated={truncated}
        matchedCount={filtered.items.length}
        selectedId={selectedId}
        onSelect={select}
      />
    ) : (
      <MapView layout={layout} selectedId={selectedId} onSelect={select} />
    );

  const inspector = (
    <TraceInspector
      item={selected}
      outgoing={selectedOut}
      incoming={selectedIn}
      coverage={coverage}
      workspaceHref={selected ? workspaceHref(projectId, selected) : null}
      archived={archived}
      onSelect={selectById}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 sm:px-5">
      <Toolbar
        projectName={projectName}
        filters={filters}
        setFilter={setFilter}
        runs={runs}
        view={view}
        setView={setView}
        onlyGaps={onlyGaps}
        setOnlyGaps={setOnlyGaps}
        onClear={() => setFilters({ ...EMPTY_TRACE_FILTERS })}
        inspectorOpen={inspectorOpen}
        setInspectorOpen={setInspectorOpen}
        shown={filtered.items.length}
        total={graph.items.length}
      />

      {/* Tablet portrait and phone: one pane at a time, selection preserved. */}
      <div className="lg:hidden">
        <PaneSwitcher pane={pane} setPane={setPane} view={view} setView={setView} />
      </div>

      {/* Desktop and tablet landscape. */}
      <div className="hidden min-h-0 flex-1 lg:flex lg:flex-col lg:gap-3">
        <CoverageRow coverage={coverage} active={filters.coverage} onFilter={onCoverageFilter} />
        <div
          className={`grid min-h-0 flex-1 gap-3 ${
            inspectorOpen ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "xl:grid-cols-1"
          }`}
        >
          <div className="flex min-h-0 flex-col">{board}</div>
          {inspectorOpen ? (
            <aside
              aria-label="Item inspector"
              className="min-h-0 overflow-auto max-lg:hidden xl:block"
            >
              {inspector}
            </aside>
          ) : null}
        </div>
        {/*
         * Tablet landscape (lg, below xl): the inspector is a drawer beneath the board
         * rather than a third column, because a 340px column at 1024px leaves the
         * matrix too narrow to read.
         */}
        {inspectorOpen ? (
          <aside aria-label="Item inspector" className="max-h-[38vh] overflow-auto xl:hidden">
            {inspector}
          </aside>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        {pane === "coverage" ? (
          <CoverageRow coverage={coverage} active={filters.coverage} onFilter={onCoverageFilter} />
        ) : pane === "inspector" ? (
          inspector
        ) : (
          board
        )}
      </div>

      {hasActiveTraceFilter(filters) && filtered.items.length === 0 ? (
        <p role="status" className="text-xs text-text-muted">
          No items match. Clear the filters to see the whole project.
        </p>
      ) : null}
    </div>
  );
}

function Toolbar({
  projectName,
  filters,
  setFilter,
  runs,
  view,
  setView,
  onlyGaps,
  setOnlyGaps,
  onClear,
  inspectorOpen,
  setInspectorOpen,
  shown,
  total,
}: {
  projectName: string;
  filters: TraceFilters;
  setFilter: <K extends keyof TraceFilters>(key: K, value: TraceFilters[K]) => void;
  runs: TraceRun[];
  view: View;
  setView: (view: View) => void;
  onlyGaps: boolean;
  setOnlyGaps: (value: boolean) => void;
  onClear: () => void;
  inspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
  shown: number;
  total: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="text-sm font-semibold tracking-[-0.005em] text-text">Traceability</h1>
      <span className="text-xs text-text-faint">{projectName}</span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-text-faint">
          <span className="sr-only">Search items</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => setFilter("query", event.target.value)}
            placeholder="Search id or title"
            className="min-h-11 w-44 rounded-lg border border-border-soft bg-surface px-2.5 text-sm text-text
                       placeholder:text-text-faint focus:border-accent-border focus:outline-none"
          />
        </label>

        <Select
          label="Type"
          value={filters.type}
          onChange={(value) => setFilter("type", value as TraceFilters["type"])}
          options={[
            { value: "all", label: "All types" },
            ...ITEM_TYPES.map((type) => ({ value: type, label: TYPE_LABEL[type] })),
          ]}
        />
        <Select
          label="Status"
          value={filters.status}
          onChange={(value) => setFilter("status", value)}
          options={[
            { value: "all", label: "All statuses" },
            ...STATUSES.map((status) => ({
              value: status,
              label: status.replace(/_/g, " "),
            })),
          ]}
        />
        <Select
          label="Priority"
          value={filters.priority}
          onChange={(value) => setFilter("priority", value)}
          options={[
            { value: "all", label: "All priorities" },
            ...PRIORITIES.map((priority) => ({ value: priority, label: priority })),
          ]}
        />
        {runs.length > 1 ? (
          <Select
            label="Analysis run"
            value={filters.runId}
            onChange={(value) => setFilter("runId", value)}
            options={[
              { value: "all", label: `All runs (${runs.length})` },
              ...runs.map((run) => ({
                value: run.id,
                label: `${formatDate(run.createdAt)} · ${run.itemCount} items`,
              })),
            ]}
          />
        ) : null}

        <span className="text-xs tabular-nums text-text-faint">
          {shown} / {total}
        </span>

        <button
          type="button"
          onClick={onClear}
          className="min-h-11 rounded-lg border border-border-soft px-2.5 text-xs font-medium text-text-muted
                     transition-colors hover:bg-surface-hover hover:text-text"
        >
          Clear filters
        </button>

        {/* View switch. Two buttons rather than a select: it is the primary control. */}
        <div role="group" aria-label="View" className="flex rounded-lg border border-border-soft">
          {(["matrix", "map"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`min-h-11 px-3 text-xs font-medium capitalize transition-colors first:rounded-l-lg last:rounded-r-lg ${
                view === option ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface-hover"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {view === "matrix" ? (
          <label className="flex min-h-11 items-center gap-1.5 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={onlyGaps}
              onChange={(event) => setOnlyGaps(event.target.checked)}
              className="size-4"
            />
            Only rows with a gap
          </label>
        ) : null}

        <button
          type="button"
          aria-expanded={inspectorOpen}
          onClick={() => setInspectorOpen(!inspectorOpen)}
          className="hidden min-h-11 rounded-lg border border-border-soft px-2.5 text-xs font-medium
                     text-text-muted transition-colors hover:bg-surface-hover hover:text-text lg:block"
        >
          {inspectorOpen ? "Hide inspector" : "Show inspector"}
        </button>
      </div>
    </div>
  );
}

/**
 * Four tabs over three panes: Matrix and Map are two views of the same board slot, so
 * selecting either sets `pane = "board"` and switches `view`. Exactly one is pressed
 * at any moment, because `active` is derived from that single pair rather than from a
 * second copy of the same fact.
 */
function PaneSwitcher({
  pane,
  setPane,
  view,
  setView,
}: {
  pane: Pane;
  setPane: (pane: Pane) => void;
  view: View;
  setView: (view: View) => void;
}) {
  const tabs: Array<{ label: string; active: boolean; select: () => void }> = [
    {
      label: "Coverage",
      active: pane === "coverage",
      select: () => setPane("coverage"),
    },
    {
      label: "Matrix",
      active: pane === "board" && view === "matrix",
      select: () => {
        setView("matrix");
        setPane("board");
      },
    },
    {
      label: "Map",
      active: pane === "board" && view === "map",
      select: () => {
        setView("map");
        setPane("board");
      },
    },
    {
      label: "Inspector",
      active: pane === "inspector",
      select: () => setPane("inspector"),
    },
  ];

  return (
    <div
      role="group"
      aria-label="Traceability panes"
      className="flex overflow-x-auto rounded-lg border border-border-soft bg-surface"
    >
      {tabs.map((tab) => (
        <button
          key={tab.label}
          type="button"
          aria-pressed={tab.active}
          onClick={tab.select}
          className={`min-h-11 flex-1 whitespace-nowrap px-3 text-xs font-medium transition-colors ${
            tab.active ? "bg-accent-soft text-accent" : "text-text-muted"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-border-soft bg-surface px-2 text-xs capitalize
                   text-text-muted focus:border-accent-border focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
