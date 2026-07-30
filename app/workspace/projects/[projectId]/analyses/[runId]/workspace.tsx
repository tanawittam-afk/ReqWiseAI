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

import { useCallback, useMemo, useState } from "react";
import type { ItemHistory } from "@/lib/review/history";
import {
  EMPTY_FILTERS,
  groupItems,
  partitionItems,
  runSummary,
  tabForType,
  type AnalysisWorkspaceRun,
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

const EMPTY_HISTORY: ItemHistory = { versions: [], activities: [] };

export function AnalysisWorkspace({
  source,
  run,
  history,
  canReview,
  currentUserId,
  initialItemId = null,
}: {
  source: SourceDetail;
  run: AnalysisWorkspaceRun;
  /** Every item's versions and activities, loaded with the page. Keyed by item id. */
  history: Record<string, ItemHistory>;
  /** False for an archived project: the record stays readable, nothing is writable. */
  canReview: boolean;
  currentUserId: string | null;
  /**
   * An item to open on, validated by the page against this run's items. Set by a link
   * from the Traceability matrix; `null` for an ordinary visit.
   */
  initialItemId?: string | null;
}) {
  /*
   * Open on the first row the list actually shows, not the first row the database
   * returns — those differ, because items arrive ordered by display id ("AC-004" sorts
   * before "PS-004") while the panel groups by type. Selecting an item the reader
   * cannot see makes the inspector look unrelated to the list.
   *
   * A deep link overrides that: arriving from traceability on FR-003 and landing on
   * BR-001 would lose the reader's place at the exact moment they crossed screens.
   */
  const initialSelectedId = useMemo(() => {
    if (initialItemId !== null) return initialItemId;
    const { requirements } = partitionItems(run.items);
    const pool = requirements.length > 0 ? requirements : run.items;
    return groupItems(pool, "type")[0]?.items[0]?.id ?? null;
  }, [run.items, initialItemId]);

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [tab, setTab] = useState<WorkspaceTab>(() => {
    // A question or a finding lives on its own tab, so a deep link to one must open
    // that tab — otherwise the item is selected on a list that does not contain it.
    const item = initialItemId
      ? run.items.find((candidate) => candidate.id === initialItemId)
      : undefined;
    return item ? tabForType(item.type) : "requirements";
  });
  const [groupBy, setGroupBy] = useState<GroupMode>("type");
  const [filters, setFilters] = useState<ItemFilters>(EMPTY_FILTERS);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [pane, setPane] = useState<Pane>("requirements");
  const [scrollSignal, setScrollSignal] = useState(0);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  /** A selection deferred because an unsaved edit would have been discarded by it. */
  const [blockedSelection, setBlockedSelection] = useState<string | null>(null);

  const { requirements, questions, findings } = useMemo(
    () => partitionItems(run.items),
    [run.items],
  );
  const summary = useMemo(() => runSummary(run.items), [run.items]);
  const selected = run.items.find((item) => item.id === selectedId) ?? null;
  const blocked = run.items.find((item) => item.id === blockedSelection) ?? null;

  /*
   * Switching panels keeps the form mounted (the panes are shown and hidden, not
   * mounted and unmounted), so a pending edit survives that on its own. Selecting a
   * *different* requirement is the move that would discard it — the edit form is keyed
   * by item id — so that is the one the workspace intercepts.
   */
  const requestSelect = useCallback(
    (id: string) => {
      // `dirty` covers a half-written requirement edit AND a half-written answer or
      // resolution note — both live in the inspector, both are keyed by item id, and
      // both would be discarded by moving the selection.
      if (dirty && id !== selectedId) {
        setBlockedSelection(id);
        return;
      }
      setSelectedId(id);
      setEditing(false);
      setDirty(false);
    },
    [dirty, selectedId],
  );

  function discardAndSelect() {
    if (blockedSelection) setSelectedId(blockedSelection);
    setBlockedSelection(null);
    setEditing(false);
    setDirty(false);
  }

  /*
   * Grouping modes are tab-specific: "review status" says nothing about a question and
   * "workflow state" says nothing about a requirement. Switching tabs therefore picks
   * that tab's first mode rather than carrying an inapplicable one across.
   */
  function changeTab(next: WorkspaceTab) {
    setTab(next);
    setGroupBy(next === "requirements" ? "type" : "workflow_state");
    setFilters(EMPTY_FILTERS);
  }

  /** Relations name items by display id; selection works in ids. */
  function selectByDisplayId(displayId: string) {
    const target = run.items.find((item) => item.displayId === displayId);
    if (!target) return;
    requestSelect(target.id);
    // Follow the link onto the tab that actually holds it, or the row stays invisible.
    changeTab(tabForType(target.type));
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

      {/* An unsaved edit is never dropped silently (docs/design/INTERFACE.md §12). */}
      {blocked ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 border-b border-warn-border bg-warn-soft px-3 py-2 text-[12.5px] text-warn"
        >
          <span>
            You have unsaved changes. Opening {blocked.displayId} will discard them.
          </span>
          <button
            type="button"
            onClick={discardAndSelect}
            className="ml-auto min-h-9 rounded-lg border border-warn-border px-2.5 font-medium transition-colors duration-150 hover:border-warn"
          >
            Discard and open {blocked.displayId}
          </button>
          <button
            type="button"
            onClick={() => setBlockedSelection(null)}
            className="min-h-9 rounded-lg px-2.5 font-medium underline underline-offset-2"
          >
            Keep editing
          </button>
        </div>
      ) : null}

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
          questions={questions}
          findings={findings}
          tab={tab}
          onTabChange={changeTab}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          filters={filters}
          onFiltersChange={setFilters}
          selectedId={selectedId}
          onSelect={requestSelect}
          className={`${pane === "requirements" ? "flex" : "hidden"} flex-1 lg:flex`}
        />

        {/* Drawer at lg, third column at xl, full panel below lg — one instance, so the
            inspector never loses its tab or scroll position when the layout changes. */}
        <Inspector
          item={selected}
          allItems={run.items}
          history={(selected && history[selected.id]) || EMPTY_HISTORY}
          projectId={run.projectId}
          runId={run.id}
          canReview={canReview}
          currentUserId={currentUserId}
          editing={editing}
          onEditingChange={setEditing}
          onDirtyChange={setDirty}
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
