/**
 * Narrowing the workspace-wide requirement list.
 *
 * The rules worth protecting: archived projects stay out unless asked for, search
 * matches only what the row actually shows (searching an excerpt the row never loaded
 * would report an honest-looking zero), and the project filter offers exactly the
 * projects that have requirements.
 */

import { describe, expect, it } from "vitest";
import {
  EMPTY_WORKSPACE_FILTERS,
  filterWorkspaceItems,
  hasActiveWorkspaceFilter,
  projectOptions,
} from "../../lib/workspace/filters";
import type { ItemType } from "../../lib/contracts/item-types";
import type { WorkspaceItemRow, WorkspaceProjectRef } from "../../lib/workspace/types";

const ALPHA: WorkspaceProjectRef = { id: "a", name: "Alpha booking", status: "active" };
const BETA: WorkspaceProjectRef = { id: "b", name: "Beta intake", status: "active" };
const OLD: WorkspaceProjectRef = { id: "c", name: "Closed pilot", status: "archived" };

let seq = 0;

function item(overrides: Partial<WorkspaceItemRow> & { type: ItemType }): WorkspaceItemRow {
  seq += 1;
  return {
    id: `item-${seq}`,
    displayId: `BR-${String(seq).padStart(3, "0")}`,
    title: "The system shall confirm a booking",
    priority: "unassigned",
    status: "draft",
    evidenceClass: "stated",
    confidence: 0.8,
    updatedAt: "2026-08-01T00:00:00.000Z",
    workflowState: null,
    analysisRunId: "run-1",
    project: ALPHA,
    hasSourceEvidence: true,
    ...overrides,
  };
}

describe("filterWorkspaceItems", () => {
  it("hides archived projects by default and shows them on request", () => {
    const items = [
      item({ type: "business_requirement" }),
      item({ type: "business_requirement", project: OLD }),
    ];
    expect(filterWorkspaceItems(items, EMPTY_WORKSPACE_FILTERS)).toHaveLength(1);
    expect(
      filterWorkspaceItems(items, { ...EMPTY_WORKSPACE_FILTERS, includeArchived: true }),
    ).toHaveLength(2);
  });

  it("matches the display id, the statement and the project name — and nothing else", () => {
    const items = [
      item({ type: "business_requirement", displayId: "FR-042", title: "Refund a booking" }),
      item({ type: "business_requirement", title: "Send a receipt", project: BETA }),
    ];
    const find = (query: string) =>
      filterWorkspaceItems(items, { ...EMPTY_WORKSPACE_FILTERS, query });

    expect(find("fr-042")).toHaveLength(1);
    expect(find("refund")).toHaveLength(1);
    expect(find("beta")).toHaveLength(1);
    expect(find("nothing here")).toHaveLength(0);
  });

  it("combines facets rather than replacing one with the next", () => {
    const items = [
      item({ type: "business_requirement", status: "draft", priority: "high" }),
      item({ type: "business_requirement", status: "approved", priority: "high" }),
      item({ type: "risk", status: "draft", priority: "high" }),
    ];
    expect(
      filterWorkspaceItems(items, {
        ...EMPTY_WORKSPACE_FILTERS,
        type: "business_requirement",
        status: "draft",
        priority: "high",
      }),
    ).toHaveLength(1);
  });

  it("filters to cited items only when asked", () => {
    const items = [
      item({ type: "business_requirement", hasSourceEvidence: true }),
      item({ type: "assumption", hasSourceEvidence: false }),
    ];
    expect(
      filterWorkspaceItems(items, { ...EMPTY_WORKSPACE_FILTERS, citedOnly: true }),
    ).toHaveLength(1);
  });

  it("filters to one project", () => {
    const items = [
      item({ type: "business_requirement" }),
      item({ type: "business_requirement", project: BETA }),
    ];
    expect(
      filterWorkspaceItems(items, { ...EMPTY_WORKSPACE_FILTERS, projectId: BETA.id }),
    ).toEqual([items[1]]);
  });
});

describe("hasActiveWorkspaceFilter", () => {
  it("is false for the empty filters and true for each axis on its own", () => {
    expect(hasActiveWorkspaceFilter(EMPTY_WORKSPACE_FILTERS)).toBe(false);
    expect(hasActiveWorkspaceFilter({ ...EMPTY_WORKSPACE_FILTERS, query: "x" })).toBe(true);
    expect(hasActiveWorkspaceFilter({ ...EMPTY_WORKSPACE_FILTERS, type: "risk" })).toBe(true);
    expect(hasActiveWorkspaceFilter({ ...EMPTY_WORKSPACE_FILTERS, includeArchived: true })).toBe(
      true,
    );
    expect(hasActiveWorkspaceFilter({ ...EMPTY_WORKSPACE_FILTERS, citedOnly: true })).toBe(true);
  });

  it("ignores whitespace-only search text", () => {
    expect(hasActiveWorkspaceFilter({ ...EMPTY_WORKSPACE_FILTERS, query: "   " })).toBe(false);
  });
});

describe("projectOptions", () => {
  it("offers each project once, counted, alphabetically, archived flagged", () => {
    const options = projectOptions([
      item({ type: "business_requirement", project: BETA }),
      item({ type: "risk", project: ALPHA }),
      item({ type: "risk", project: ALPHA }),
      item({ type: "risk", project: OLD }),
    ]);

    expect(options.map((option) => option.name)).toEqual([
      "Alpha booking",
      "Beta intake",
      "Closed pilot",
    ]);
    expect(options[0].count).toBe(2);
    expect(options[2].archived).toBe(true);
  });

  it("offers nothing for an empty list, rather than every project with a zero", () => {
    expect(projectOptions([])).toEqual([]);
  });
});
