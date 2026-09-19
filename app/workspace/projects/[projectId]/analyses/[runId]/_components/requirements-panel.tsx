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
  type QualityScoreBreakdown,
  type WorkspaceTab,
} from "@/lib/analysis/workspace-view";
import { WORKFLOW_STATE_LABEL, type WorkflowState } from "@/lib/contracts/workflow";
import { EVIDENCE_LABEL, PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, confidencePercent, labelFor } from "@/app/workspace/_components/item-labels";
import { AddRequirementForm } from "./add-requirement-form";
import { QualityPanel } from "./quality-panel";
import { RequirementRow } from "./requirement-row";
import { T } from "@/app/_components/t";
import { Button } from "@/app/_components/ui/button";
import { pick, useLocale } from "@/lib/i18n";

/** Stable reference for the quality tab, which renders no item list — a fresh `[]`
 * literal on every render would defeat the memos below that depend on `items`. */
const NO_ITEMS: AnalysisItemView[] = [];

const GROUP_MODE_LABEL: Record<GroupMode, { en: string; th: string }> = {
  type: { en: "Type", th: "ประเภท" },
  source_order: { en: "Source order", th: "ลำดับต้นทาง" },
  review_status: { en: "Review status", th: "สถานะตรวจสอบ" },
  priority: { en: "Priority", th: "ลำดับความสำคัญ" },
  workflow_state: { en: "Workflow state", th: "สถานะเวิร์กโฟลว์" },
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
  quality,
  tab,
  onTabChange,
  groupBy,
  onGroupByChange,
  filters,
  onFiltersChange,
  selectedId,
  onSelect,
  onSelectDisplayId,
  projectId,
  runId,
  sourceId,
  addingRequirement,
  addPrefillExcerpt,
  onOpenAddRequirement,
  onCloseAddRequirement,
  className = "",
}: {
  requirements: AnalysisItemView[];
  questions: AnalysisItemView[];
  findings: AnalysisItemView[];
  quality: QualityScoreBreakdown;
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  groupBy: GroupMode;
  onGroupByChange: (mode: GroupMode) => void;
  filters: ItemFilters;
  onFiltersChange: (filters: ItemFilters) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSelectDisplayId: (displayId: string) => void;
  projectId: string;
  runId: string;
  sourceId: string;
  addingRequirement: boolean;
  addPrefillExcerpt: string | null;
  onOpenAddRequirement: (prefillExcerpt?: string | null) => void;
  onCloseAddRequirement: () => void;
  className?: string;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const locale = useLocale();

  const items =
    tab === "questions" ? questions : tab === "findings" ? findings : tab === "quality" ? NO_ITEMS : requirements;
  const workflowTab = tab === "questions" || tab === "findings";
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
      aria-label={pick(locale, "Requirements", "ข้อกำหนด")}
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-border-soft bg-surface ${className}`}
    >
      <div className="flex items-center gap-1 border-b border-border-soft px-3 pt-2">
        <Tab active={tab === "requirements"} count={requirements.length} onClick={() => onTabChange("requirements")}>
          <T en="Requirements" th="ข้อกำหนด" />
        </Tab>
        <Tab active={tab === "questions"} count={questions.length} onClick={() => onTabChange("questions")}>
          <T en="Open questions" th="คำถามที่เปิดอยู่" />
        </Tab>
        <Tab active={tab === "findings"} count={findings.length} onClick={() => onTabChange("findings")}>
          <T en="Quality findings" th="ข้อค้นพบด้านคุณภาพ" />
        </Tab>
        <Tab active={tab === "quality"} count={quality.score} onClick={() => onTabChange("quality")}>
          <T en="Quality" th="คุณภาพ" />
        </Tab>
      </div>

      {tab === "quality" ? (
        <QualityPanel
          breakdown={quality}
          findings={findings}
          onSelectDisplayId={onSelectDisplayId}
          onAddFromFinding={(excerpt) => onOpenAddRequirement(excerpt)}
        />
      ) : (
        <>
          {tab === "requirements" && addingRequirement ? (
            <AddRequirementForm
              projectId={projectId}
              runId={runId}
              sourceId={sourceId}
              prefillExcerpt={addPrefillExcerpt}
              onDone={onCloseAddRequirement}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-3 py-2">
            {tab === "requirements" && !addingRequirement ? (
              <button
                type="button"
                onClick={() => onOpenAddRequirement()}
                className="min-h-11 lg:min-h-9 rounded-[var(--radius-card)] border border-border-soft bg-surface px-2.5 text-xs font-medium
                           text-text-muted transition-colors duration-150 hover:bg-surface-hover"
              >
                <T en="+ Add requirement" th="+ เพิ่มข้อกำหนด" />
              </button>
            ) : null}
            <label className="flex min-w-[9rem] flex-1 items-center gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-2.5 focus-within:border-accent-border">
              <span className="text-text-faint">
                <Icon name="search" size={14} />
              </span>
              <span className="sr-only">
                <T en="Search requirements" th="ค้นหาข้อกำหนด" />
              </span>
              <input
                type="search"
                value={filters.query}
                onChange={(event) => set({ query: event.target.value })}
                placeholder={pick(locale, "Search", "ค้นหา")}
                className="min-h-11 lg:min-h-9 w-full min-w-0 bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
              />
            </label>

            <label className="flex items-center gap-1.5 text-xs text-text-faint">
              <span>
                <T en="Group" th="จัดกลุ่ม" />
              </span>
              <Select value={groupBy} onChange={(value) => onGroupByChange(value as GroupMode)}>
                {groupModesFor(tab).map((mode) => (
                  <option key={mode} value={mode}>
                    {pick(locale, GROUP_MODE_LABEL[mode].en, GROUP_MODE_LABEL[mode].th)}
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
              {hasActiveFilter(filters) ? (
                <T en="Filter · on" th="ตัวกรอง · เปิดอยู่" />
              ) : (
                <T en="Filter" th="ตัวกรอง" />
              )}
            </button>

            <span className="ml-auto shrink-0 text-xs tabular-nums text-text-faint">
              {visible.length === items.length ? (
                <T
                  en={`${items.length} item${items.length === 1 ? "" : "s"}`}
                  th={`${items.length} รายการ`}
                />
              ) : (
                <T
                  en={`${visible.length} of ${items.length}`}
                  th={`${visible.length} จาก ${items.length}`}
                />
              )}
            </span>
          </div>

          {filtersOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border-soft bg-surface-muted px-3 py-2">
          {workflowTab ? (
            <FacetSelect
              label={pick(locale, "State", "สถานะ")}
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
              <FacetSelect
                label={pick(locale, "Type", "ประเภท")}
                value={filters.type}
                onChange={(value) => set({ type: value as ItemFilters["type"] })}
              >
                {presentTypes.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABEL[type]}
                  </option>
                ))}
              </FacetSelect>
              <FacetSelect
                label={pick(locale, "Priority", "ลำดับความสำคัญ")}
                value={filters.priority}
                onChange={(value) => set({ priority: value as ItemFilters["priority"] })}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </FacetSelect>
              <FacetSelect
                label={pick(locale, "Status", "สถานะ")}
                value={filters.status}
                onChange={(value) => set({ status: value })}
              >
                {presentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {labelFor(STATUS_LABEL, status)}
                  </option>
                ))}
              </FacetSelect>
            </>
          )}
          <FacetSelect
            label={pick(locale, "Evidence", "หลักฐาน")}
            value={filters.evidenceClass}
            onChange={(value) => set({ evidenceClass: value })}
          >
            {EVIDENCE_CLASSES.map((evidenceClass) => (
              <option key={evidenceClass} value={evidenceClass}>
                {EVIDENCE_LABEL[evidenceClass]}
              </option>
            ))}
          </FacetSelect>
          {hasActiveFilter(filters) ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                set({ type: "all", priority: "all", status: "all", evidenceClass: "all", workflowState: "all" })
              }
            >
              <T en="Clear filters" th="ล้างตัวกรอง" />
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* A stable gutter keeps the group-header statistics off the scrollbar, and stops
          the whole list shifting sideways when a filter removes enough rows to remove it. */}
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            {items.length === 0 ? (
              tab === "questions" ? (
                <T en="This run raised no open questions." th="รอบนี้ไม่มีคำถามที่เปิดอยู่" />
              ) : tab === "findings" ? (
                <T en="This run found no quality issues." th="รอบนี้ไม่พบปัญหาด้านคุณภาพ" />
              ) : (
                <T en="This run produced no requirements." th="รอบนี้ไม่ได้สร้างข้อกำหนด" />
              )
            ) : (
              <T
                en="No item matches the current search and filters."
                th="ไม่มีรายการที่ตรงกับคำค้นหาและตัวกรองปัจจุบัน"
              />
            )}
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
                      {stats.averageConfidence === null ? null : (
                        <T
                          en={`avg ${confidencePercent(stats.averageConfidence)}`}
                          th={`เฉลี่ย ${confidencePercent(stats.averageConfidence)}`}
                        />
                      )}
                      <span aria-hidden="true"> · </span>
                      <T
                        en={`${stats.citedCount}/${stats.count} cited`}
                        th={`มีการอ้างอิง ${stats.citedCount}/${stats.count}`}
                      />
                    </span>
                  </button>
                </h3>
                {isCollapsed ? null : (
                  <ul className="flex flex-col gap-1.5 px-2 py-1.5">
                    {group.items.map((item) => (
                      <li key={item.id}>
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
        </>
      )}
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
  const locale = useLocale();
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-faint">
      <span>{label}</span>
      <Select value={value} onChange={onChange}>
        <option value="all">{pick(locale, "All", "ทั้งหมด")}</option>
        {children}
      </Select>
    </label>
  );
}
