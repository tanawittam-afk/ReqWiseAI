/**
 * Narrowing a workspace-wide item list.
 *
 * A deliberate sibling of `lib/analysis/workspace-view.ts`'s `filterItems`, not a
 * reuse of it: that one filters `AnalysisItemView`, which carries every excerpt and
 * relation of a single run, and searches inside them. This one filters
 * `WorkspaceItemRow`, which carries none of that on purpose (see `types.ts`), and adds
 * the one axis a cross-project list has and a single run does not — **which project**.
 *
 * Searching what is not loaded would be the dishonest option: a query that silently
 * failed to match an excerpt the row does not hold reads as "no such requirement".
 * So the haystack here is exactly what the row shows — display id, title, project.
 *
 * Pure and DB-free, so every rule is testable without a browser or a database.
 */

import { ITEM_TYPES, PRIORITIES, type ItemType, type Priority } from "../contracts/item-types.ts";
import { ITEM_STATUSES } from "../contracts/review.ts";
import type { WorkspaceItemRow } from "./types.ts";

export type WorkspaceFilters = {
  query: string;
  type: ItemType | "all";
  status: string | "all";
  priority: Priority | "all";
  projectId: string | "all";
  /** Archived projects are read-only; hidden by default, never deleted from the list. */
  includeArchived: boolean;
  /** Items with at least one located excerpt, only. */
  citedOnly: boolean;
};

export const EMPTY_WORKSPACE_FILTERS: WorkspaceFilters = {
  query: "",
  type: "all",
  status: "all",
  priority: "all",
  projectId: "all",
  includeArchived: false,
  citedOnly: false,
};

export function hasActiveWorkspaceFilter(filters: WorkspaceFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.projectId !== "all" ||
    filters.includeArchived ||
    filters.citedOnly
  );
}

export function filterWorkspaceItems(
  items: readonly WorkspaceItemRow[],
  filters: WorkspaceFilters,
): WorkspaceItemRow[] {
  const needle = filters.query.trim().toLowerCase();

  return items.filter((item) => {
    if (!filters.includeArchived && item.project.status === "archived") return false;
    if (filters.projectId !== "all" && item.project.id !== filters.projectId) return false;
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.priority !== "all" && item.priority !== filters.priority) return false;
    if (filters.citedOnly && !item.hasSourceEvidence) return false;
    if (needle === "") return true;

    return [item.displayId, item.title, item.project.name]
      .join("\n")
      .toLowerCase()
      .includes(needle);
  });
}

/**
 * The projects present in a list, in the order a reader meets them — so the project
 * filter offers exactly the projects that have requirements, never every project with
 * an empty option beside it.
 */
export function projectOptions(
  items: readonly WorkspaceItemRow[],
): Array<{ id: string; name: string; archived: boolean; count: number }> {
  const seen = new Map<string, { id: string; name: string; archived: boolean; count: number }>();
  for (const item of items) {
    const existing = seen.get(item.project.id);
    if (existing) existing.count += 1;
    else
      seen.set(item.project.id, {
        id: item.project.id,
        name: item.project.name,
        archived: item.project.status === "archived",
        count: 1,
      });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Filter dropdown options, in the vocabulary's own order — never insertion order. */
export const TYPE_OPTIONS: readonly ItemType[] = ITEM_TYPES;
export const STATUS_OPTIONS: readonly string[] = ITEM_STATUSES;
export const PRIORITY_OPTIONS: readonly Priority[] = PRIORITIES;
