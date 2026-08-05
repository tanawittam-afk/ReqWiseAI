"use client";

/**
 * The centre panel: the primary working surface.
 *
 * A compact structured list, not a stack of cards — an analyst's first move is to scan
 * everything the run produced, and a card that shows four items per screen makes that
 * impossible (docs/design/INTERFACE.md §3). Grouping, search and filters narrow the
 * list; nothing here changes an item, which is slice 5's job.
 *
 * The Issues tab is the analysis talking about itself: open questions it could not
 * settle, and quality findings about the requirements. Keeping them off the
 * Requirements tab is a correctness rule, not a layout preference — an unanswered
 * question must never read as a finding.
 */

import { useMemo, useState } from "react";
import { Icon } from "@/app/_components/icon";
import type { AnalysisItemView } from "@/lib/analysis/queries";
import { EVIDENCE_CLASSES, PRIORITIES, type ItemType } from "@/lib/contracts/item-types";
import {
  filterItems,
  groupItems,
  groupStats,
  hasActiveFilter,
  type GroupMode,
  type ItemFilters,
  type WorkspaceTab,
} from "@/lib/analysis/workspace-view";
import { WORKFLOW_STATE_LABEL, type WorkflowState } from "@/lib/contracts/workflow";
import { EVIDENCE_LABEL, PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, confidencePercent, labelFor } from "@/app/workspace/_components/item-labels";
import { RequirementRow } from "./requirement-row";

const GROUP_MODE_LABEL: Record<GroupMode, string> = {
  type: "Type",
  source_order: "Source order",
  review_status: "Review status",
  priority: "Priority",
  workflow_state: "Workflow state",
};

/**
 * Grouping by review status or priority is meaningless on a tab whose items have
 * neither; grouping by workflow state is meaningless on the requirements tab. Offering
 * a mode that puts every row in one bucket is worse than not offering it.
 */
function groupModesFor(tab: WorkspaceTab): GroupMode[] {
  if (tab === "requirements") return ["type", "source_order", "review_status", "priority"];
  return ["workflow_state", "source_order"];
}

export function RequirementsPanel({
  requirements,
  questions,
  findings,
  tab,
  onTabChange,
  groupBy,
  onGroupByChange,
  filters,
  onFiltersChange,
  selectedId,
  onSelect,
  className = "",
}: {
  requirements: AnalysisItemView[];
  questions: AnalysisItemView[];
  findings: AnalysisItemView[];
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  groupBy: GroupMode;
  onGroupByChange: (mode: GroupMode) => void;
  filters: ItemFilters;
  onFiltersChange: (filters: ItemFilters) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const items = tab === "questions" ? questions : tab === "findings" ? findings : requirements;
  const workflowTab = tab !== "requirements";
  const visible = useMemo(() => filterItems(items, filters), [items, filters]);
  const groups = useMemo(() => groupItems(visible, groupBy), [visible, groupBy]);

  // Only offer facets the run actually contains — an empty filter is a dead end.
  const presentTypes = useMemo(
    () => [...new Set(items.map((item) => item.type))] as ItemType[],
    [items],
  );
  const presentStatuses = useMemo(
    () => [...new Set(items.map((item) => item.status))],
    [items],
  );
  const presentWorkflowStates = useMemo(
    () => [...new Set(items.map((item) => item.workflowState).filter((s): s is string => s !== null))],
    [items],
  );

  const set = (patch: Partial<ItemFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <section
      aria-label="Requirements"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-border-soft bg-surface ${className}`}
    >
      <div className="flex items-center gap-1 border-b border-border-soft px-3 pt-2">
        <Tab active={tab === "requirements"} count={requirements.length} onClick={() => onTabChange("requirements")}>
          Requirements
        </Tab>
        <Tab active={tab === "questions"} count={questions.length} onClick={() => onTabChange("questions")}>
          Open questions
        </Tab>
        <Tab active={tab === "findings"} count={findings.length} onClick={() => onTabChange("findings")}>
          Quality findings
        </Tab>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-3 py-2">
        <label className="flex min-w-[9rem] flex-1 items-center gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-2.5 focus-within:border-accent-border">
          <span className="text-text-faint">
            <Icon name="search" size={14} />
          </span>
          <span className="sr-only">Search requirements</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => set({ query: event.target.value })}
            placeholder="Search"
            className="min-h-11 lg:min-h-9 w-full min-w-0 bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
          />
        </label>

        <label className="flex items-center gap-1.5 text-xs text-text-faint">
          <span>Group</span>
          <Select value={groupBy} onChange={(value) => onGroupByChange(value as GroupMode)}>
            {groupModesFor(tab).map((mode) => (
              <option key={mode} value={mode}>
                {GROUP_MODE_LABEL[mode]}
              </option>
            ))}
          </Select>
        </label>

        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          className={`min-h-11 lg:min-h-9 rounded-[var(--radius-card)] border px-2.5 text-xs font-medium transition-colors duration-150 ${
            hasActiveFilter(filters)
              ? "border-accent-border bg-accent-soft text-accent"
              : "border-border-soft bg-surface text-text-muted hover:bg-surface-hover"
          }`}
        >
          Filter{hasActiveFilter(filters) ? " · on" : ""}
        </button>

        <span className="ml-auto shrink-0 text-xs tabular-nums text-text-faint">
          {visible.length === items.length
            ? `${items.length} item${items.length === 1 ? "" : "s"}`
            : `${visible.length} of ${items.length}`}
        </span>
      </div>

      {filtersOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border-soft bg-surface-muted px-3 py-2">
          {workflowTab ? (
            <FacetSelect
              label="State"
              value={filters.workflowState}
              onChange={(value) => set({ workflowState: value })}
            >
              {presentWorkflowStates.map((state) => (
                <option key={state} value={state}>
                  {WORKFLOW_STATE_LABEL[state as WorkflowState] ?? state}
                </option>
              ))}
            </FacetSelect>
          ) : (
            <>
              <FacetSelect label="Type" value={filters.type} onChange={(value) => set({ type: value as ItemFilters["type"] })}>
                {presentTypes.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABEL[type]}
                  </option>
                ))}
              </FacetSelect>
              <FacetSelect label="Priority" value={filters.priority} onChange={(value) => set({ priority: value as ItemFilters["priority"] })}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </FacetSelect>
              <FacetSelect label="Status" value={filters.status} onChange={(value) => set({ status: value })}>
                {presentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {labelFor(STATUS_LABEL, status)}
                  </option>
                ))}
              </FacetSelect>
            </>
          )}
          <FacetSelect label="Evidence" value={filters.evidenceClass} onChange={(value) => set({ evidenceClass: value })}>
            {EVIDENCE_CLASSES.map((evidenceClass) => (
              <option key={evidenceClass} value={evidenceClass}>
                {EVIDENCE_LABEL[evidenceClass]}
              </option>
            ))}
          </FacetSelect>
          {hasActiveFilter(filters) ? (
            <button
              type="button"
              onClick={() =>
                set({ type: "all", priority: "all", status: "all", evidenceClass: "all", workflowState: "all" })
              }
              className="min-h-11 lg:min-h-9 rounded-[var(--radius-card)] px-2 text-xs font-medium text-accent underline underline-offset-2"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {/* A stable gutter keeps the group-header statistics off the scrollbar, and stops
          the whole list shifting sideways when a filter removes enough rows to remove it. */}
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            {items.length === 0
              ? tab === "questions"
                ? "This run raised no open questions."
                : tab === "findings"
                  ? "This run found no quality issues."
                  : "This run produced no requirements."
              : "No item matches the current search and filters."}
          </p>
        ) : (
          groups.map((group) => {
            const stats = groupStats(group.items);
            const isCollapsed = collapsed[group.key] ?? false;
            return (
              <div key={group.key} className="border-b border-border-soft last:border-b-0">
                <h3>
                  <button
                    type="button"
                    onClick={() => setCollapsed((state) => ({ ...state, [group.key]: !isCollapsed }))}
                    aria-expanded={!isCollapsed}
                    /* Shorter than the 44px touch minimum on purpose: a group header is
                       a full-width strip, so the target is large in the axis that
                       matters, and every header spent on chrome is a requirement the
                       reader cannot see. */
                    className="flex min-h-10 w-full items-center gap-2 bg-surface-muted px-3.5 py-2 text-left
                               transition-colors duration-150 hover:bg-surface-hover"
                  >
                    <span className="grid w-3 place-items-center text-text-faint">
                      <Icon name={isCollapsed ? "chevron-right" : "chevron-down"} size={11} />
                    </span>
                    <span className="truncate text-xs font-semibold text-text">{group.label}</span>
                    <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted ring-1 ring-border-soft">
                      {stats.count}
                    </span>
                    <span className="ml-auto shrink-0 text-[11px] tabular-nums text-text-faint">
                      {stats.averageConfidence === null
                        ? null
                        : `avg ${confidencePercent(stats.averageConfidence)}`}
                      <span aria-hidden="true"> · </span>
                      {stats.citedCount}/{stats.count} cited
                    </span>
                  </button>
                </h3>
                {isCollapsed ? null : (
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.id} className="border-t border-border-soft first:border-t-0">
                        <RequirementRow
                          item={item}
                          active={item.id === selectedId}
                          onSelect={() => onSelect(item.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function Tab({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors duration-150 ${
        active
          ? "border-b-accent font-semibold text-text"
          : "border-b-transparent text-text-muted hover:text-text"
      }`}
    >
      {children}
      <span className="rounded-full bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
        {count}
      </span>
    </button>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-11 lg:min-h-9 rounded-[var(--radius-card)] border border-border-soft bg-surface px-2 text-xs font-medium text-text
                 transition-colors duration-150 hover:bg-surface-hover"
    >
      {children}
    </select>
  );
}

function FacetSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-faint">
      <span>{label}</span>
      <Select value={value} onChange={onChange}>
        <option value="all">All</option>
        {children}
      </Select>
    </label>
  );
}
