"use client";

/**
 * The Analysis Workspace — the product's signature screen.
 *
 * Three panels with distinct jobs (docs/design/INTERFACE.md §1): the **source** is the
 * evidence, the **requirements list** is the working surface, the **inspector** is the
 * detail of one item. Selecting a requirement highlights the exact span of the source
 * it came from; nothing here edits anything, which arrives with the review slice.
 *
 * How the three fit on a screen:
 *
 * | Width | Layout |
 * |---|---|
 * | ≥1280 (`xl`) | three grid columns; the inspector collapses and the list takes its space |
 * | 1024–1279 (`lg`) | source + requirements; the inspector is a right drawer over them |
 * | <1024 | one panel at a time, chosen with a segmented control, selection preserved |
 *
 * This component owns only *selection and view state*. Which items belong to which tab
 * and group is `lib/analysis/workspace-view.ts`, tested without a browser.
 */

import { useMemo, useState } from "react";
import type { AnalysisRunDetail } from "@/lib/analysis/queries";
import {
  EMPTY_FILTERS,
  ISSUE_TYPES,
  groupItems,
  partitionItems,
  runSummary,
  type GroupMode,
  type ItemFilters,
  type WorkspaceTab,
} from "@/lib/analysis/workspace-view";
import type { SourceDetail } from "@/lib/sources/types";
import { formatDate } from "@/app/workspace/_components/badges";
import { Inspector } from "./_components/inspector";
import { RequirementsPanel } from "./_components/requirements-panel";
import { SourcePanel } from "./_components/source-panel";
import { SummaryBar } from "./_components/summary-bar";

type Pane = "source" | "requirements" | "inspector";

export function AnalysisWorkspace({
  source,
  run,
}: {
  source: SourceDetail;
  run: AnalysisRunDetail;
}) {
  /*
   * Open on the first row the list actually shows, not the first row the database
   * returns — those differ, because items arrive ordered by display id ("AC-004" sorts
   * before "PS-004") while the panel groups by type. Selecting an item the reader
   * cannot see makes the inspector look unrelated to the list.
   */
  const initialSelectedId = useMemo(() => {
    const { requirements } = partitionItems(run.items);
    const pool = requirements.length > 0 ? requirements : run.items;
    return groupItems(pool, "type")[0]?.items[0]?.id ?? null;
  }, [run.items]);

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [tab, setTab] = useState<WorkspaceTab>("requirements");
  const [groupBy, setGroupBy] = useState<GroupMode>("type");
  const [filters, setFilters] = useState<ItemFilters>(EMPTY_FILTERS);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [pane, setPane] = useState<Pane>("requirements");
  const [scrollSignal, setScrollSignal] = useState(0);

  const { requirements, issues } = useMemo(() => partitionItems(run.items), [run.items]);
  const summary = useMemo(() => runSummary(run.items), [run.items]);
  const selected = run.items.find((item) => item.id === selectedId) ?? null;

  /** Relations name items by display id; selection works in ids. */
  function selectByDisplayId(displayId: string) {
    const target = run.items.find((item) => item.displayId === displayId);
    if (!target) return;
    setSelectedId(target.id);
    // Follow the link onto the tab that actually holds it, or the row stays invisible.
    setTab(ISSUE_TYPES.includes(target.type) ? "issues" : "requirements");
  }

  /** Switching to a single panel re-runs the source scroll (INTERFACE §12). */
  function showPane(next: Pane) {
    setPane(next);
    if (next === "source") setScrollSignal((value) => value + 1);
  }

  const columns = inspectorOpen
    ? "lg:grid-cols-[minmax(260px,32%)_minmax(0,1fr)] xl:grid-cols-[minmax(280px,30%)_minmax(0,1fr)_minmax(300px,28%)]"
    : "lg:grid-cols-[minmax(260px,32%)_minmax(0,1fr)] xl:grid-cols-[minmax(280px,30%)_minmax(0,1fr)]";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SummaryBar
        summary={summary}
        runDate={formatDate(run.createdAt)}
        sourceCount={1}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((open) => !open)}
      />

      {/* One panel at a time below lg — a portrait tablet cannot hold three readable columns. */}
      <div
        role="group"
        aria-label="Workspace panel"
        className="flex gap-1 border-b border-border-soft bg-chrome px-3 py-2 lg:hidden"
      >
        <Segment active={pane === "source"} onClick={() => showPane("source")}>
          Source
        </Segment>
        <Segment active={pane === "requirements"} onClick={() => showPane("requirements")}>
          Requirements
        </Segment>
        <Segment active={pane === "inspector"} onClick={() => showPane("inspector")}>
          Inspector
        </Segment>
      </div>

      <div
        className={`relative flex min-h-0 flex-1 overflow-hidden transition-[grid-template-columns]
                    duration-200 lg:grid ${columns}`}
      >
        <SourcePanel
          source={source}
          item={selected}
          scrollSignal={scrollSignal}
          className={`${pane === "source" ? "flex" : "hidden"} flex-1 lg:flex lg:border-r`}
        />

        <RequirementsPanel
          requirements={requirements}
          issues={issues}
          tab={tab}
          onTabChange={setTab}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          filters={filters}
          onFiltersChange={setFilters}
          selectedId={selectedId}
          onSelect={setSelectedId}
          className={`${pane === "requirements" ? "flex" : "hidden"} flex-1 lg:flex`}
        />

        {/* Drawer at lg, third column at xl, full panel below lg — one instance, so the
            inspector never loses its tab or scroll position when the layout changes. */}
        <Inspector
          item={selected}
          onSelectDisplayId={selectByDisplayId}
          onClose={() => setInspectorOpen(false)}
          className={`${pane === "inspector" ? "flex" : "hidden"} flex-1 ${
            inspectorOpen
              ? `lg:absolute lg:inset-y-0 lg:right-0 lg:z-20 lg:flex lg:w-[min(380px,85vw)] lg:border-l
                 lg:shadow-[0_8px_24px_rgba(27,26,24,0.12)]
                 xl:static xl:z-auto xl:w-auto xl:shadow-none`
              : "lg:hidden"
          }`}
        />
      </div>
    </div>
  );
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 flex-1 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 ${
        active
          ? "border-accent-border bg-accent-soft text-accent"
          : "border-border-soft bg-surface text-text-muted hover:bg-surface-hover"
      }`}
    >
      {children}
    </button>
  );
}
