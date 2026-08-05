"use client";

/**
 * Every requirement in the workspace, filtered in the browser.
 *
 * Client-side filtering, deliberately: the whole list is already loaded (up to
 * `WORKSPACE_ITEM_LIMIT`), so narrowing it is instant and needs no round trip — the
 * same choice the analysis workspace's requirements panel makes for the same reason.
 * When the server hit its ceiling the page says so out loud rather than letting a
 * filter search a partial list and report an honest-looking zero.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { FacetSelect } from "@/app/_components/ui/select";
import { EmptyState } from "@/app/_components/ui/empty-state";
import {
  EMPTY_WORKSPACE_FILTERS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  filterWorkspaceItems,
  hasActiveWorkspaceFilter,
  projectOptions,
  type WorkspaceFilters,
} from "@/lib/workspace/filters";
import type { ItemType, Priority } from "@/lib/contracts/item-types";
import type { WorkspaceItemRow } from "@/lib/workspace/types";
import { useLocale } from "@/lib/i18n";
import { PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, labelFor } from "../_components/item-labels";
import { ItemRow, ItemRowList } from "../_components/workspace-item-row";

export function RequirementsView({
  items,
  /**
   * From `?project=` — the project sub-nav's "Requirements" tab lands here pre-filtered
   * rather than duplicating this whole view per project. It is a **starting** value, not
   * a bound one: changing the dropdown afterwards is not supposed to fight the URL. An
   * id naming a project with no visible items simply matches nothing, which is the same
   * answer RLS would give.
   */
  initialProjectId,
}: {
  items: WorkspaceItemRow[];
  initialProjectId?: string;
}) {
  const [filters, setFilters] = useState<WorkspaceFilters>(
    initialProjectId
      ? { ...EMPTY_WORKSPACE_FILTERS, projectId: initialProjectId, includeArchived: true }
      : EMPTY_WORKSPACE_FILTERS,
  );
  const locale = useLocale();

  const projects = useMemo(() => projectOptions(items), [items]);
  const visible = useMemo(() => filterWorkspaceItems(items, filters), [items, filters]);
  const active = hasActiveWorkspaceFilter(filters);

  const set = <K extends keyof WorkspaceFilters>(key: K, value: WorkspaceFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <>
      <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-chrome p-3">
        <label className="flex flex-col gap-1">
          <span className="sr-only">
            {locale === "th" ? "ค้นหาความต้องการ" : "Search requirements"}
          </span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => set("query", event.target.value)}
            placeholder={
              locale === "th"
                ? "ค้นหาด้วยรหัส ชื่อ หรือชื่อโปรเจกต์"
                : "Search by id, statement or project"
            }
            className="min-h-11 w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-sm text-text placeholder:text-text-faint"
          />
        </label>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <FacetSelect
            label="Project"
            value={filters.projectId}
            onChange={(value) => set("projectId", value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.count})
                {project.archived ? " — archived" : ""}
              </option>
            ))}
          </FacetSelect>

          <FacetSelect
            label="Type"
            value={filters.type}
            onChange={(value) => set("type", value as ItemType | "all")}
          >
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type]}
              </option>
            ))}
          </FacetSelect>

          <FacetSelect
            label="Status"
            value={filters.status}
            onChange={(value) => set("status", value)}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {labelFor(STATUS_LABEL, status)}
              </option>
            ))}
          </FacetSelect>

          <FacetSelect
            label="Priority"
            value={filters.priority}
            onChange={(value) => set("priority", value as Priority | "all")}
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {labelFor(PRIORITY_LABEL, priority)}
              </option>
            ))}
          </FacetSelect>

          <label className="flex min-h-11 items-center gap-1.5 text-xs text-text-faint lg:min-h-0">
            <input
              type="checkbox"
              checked={filters.citedOnly}
              onChange={(event) => set("citedOnly", event.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            <span>Cited only</span>
          </label>

          <label className="flex min-h-11 items-center gap-1.5 text-xs text-text-faint lg:min-h-0">
            <input
              type="checkbox"
              checked={filters.includeArchived}
              onChange={(event) => set("includeArchived", event.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            <span>Include archived projects</span>
          </label>

          {active ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_WORKSPACE_FILTERS)}
              className="min-h-11 rounded-[var(--radius-card)] px-2 text-xs font-medium text-accent underline underline-offset-2 lg:min-h-9"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-text-muted" role="status">
        {visible.length} of {items.length} shown
      </p>

      {visible.length === 0 ? (
        active ? (
          <EmptyState
            icon="search"
            title="No requirement matches these filters"
            body="Clear a filter or the search term and try again."
            action={
              <button
                type="button"
                onClick={() => setFilters(EMPTY_WORKSPACE_FILTERS)}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            icon="paste"
            title="No requirements yet"
            body="Nothing has been analysed in this workspace yet. Start a project and paste
              its source text — requirements appear here as soon as a run finishes."
            action={
              <Link
                href="/workspace/projects/new"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
              >
                Start a project
              </Link>
            }
          />
        )
      ) : (
        <ItemRowList>
          {visible.map((item) => (
            <li key={item.id}>
              <ItemRow item={item} />
            </li>
          ))}
        </ItemRowList>
      )}
    </>
  );
}
