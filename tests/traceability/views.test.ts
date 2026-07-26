/**
 * Matrix rows, map layout, the accessible list alternatives, and filtering.
 *
 * The most important assertions here are the negative ones: that a gap is a *rendered
 * cell* rather than a blank, that the list alternative carries the same information as
 * the grid rather than a summary, and that filtering never leaves an edge pointing at
 * an item that is no longer on screen.
 */

import { describe, expect, it } from "vitest";
import { buildMatrixRows, describeMatrixRow } from "../../lib/traceability/matrix";
import { MAP_COLUMNS, describeMapNode, layoutMap, layoutSize } from "../../lib/traceability/map";
import {
  EMPTY_TRACE_FILTERS,
  filterGraph,
  hasActiveTraceFilter,
} from "../../lib/traceability/filters";
import { computeCoverage } from "../../lib/traceability/coverage";
import { relationPhrase } from "../../lib/traceability/labels";
import { RUN_B, legacyGraph, sampleGraph } from "./fixtures";

describe("matrix rows", () => {
  it("builds the full spine as one row when every level is present", () => {
    const { rows } = buildMatrixRows(sampleGraph());
    const complete = rows.find((row) => row.itemIds.join(",") === "obj1,br1,fr1,us1,ac1");
    expect(complete).toBeDefined();
    expect(complete?.hasGap).toBe(false);
    expect(complete?.cells.every((cell) => cell.kind === "item")).toBe(true);
  });

  it("renders a gap as a missing cell with a reason, never as a blank", () => {
    const { rows } = buildMatrixRows(sampleGraph());
    const objectiveRow = rows.find((row) => row.itemIds[0] === "obj2");
    expect(objectiveRow).toBeDefined();
    const missing = objectiveRow?.cells.filter((cell) => cell.kind === "missing") ?? [];
    expect(missing.length).toBeGreaterThan(0);
    for (const cell of missing) {
      if (cell.kind !== "missing") continue;
      expect(cell.reason.length).toBeGreaterThan(0);
    }
  });

  it("still produces rows for a requirement with no objective above it", () => {
    // Without this the matrix would silently omit every requirement in a run whose
    // objective was never extracted.
    const { rows } = buildMatrixRows(sampleGraph());
    const br2Row = rows.find((row) => row.itemIds[0] === "br2");
    expect(br2Row).toBeDefined();
    expect(br2Row?.cells[0].kind).toBe("not_applicable");
    expect(br2Row?.cells[1].kind).toBe("item");
  });

  it("marks levels above a row's own root as not applicable, not as missing", () => {
    // Reporting them as missing would restate the same absence once per descendant.
    const { rows } = buildMatrixRows(sampleGraph());
    const row = rows.find((r) => r.itemIds[0] === "br2");
    expect(row?.cells[0].kind).toBe("not_applicable");
  });

  it("produces one row per leaf when a parent has several children", () => {
    const graph = sampleGraph();
    graph.items.push({
      id: "ac2",
      displayId: "AC-002",
      type: "acceptance_criterion",
      title: "second criterion",
      status: "draft",
      priority: "unassigned",
      workflowState: null,
      analysisRunId: "run-a",
      hasSourceEvidence: true,
    });
    graph.relations.push({
      fromItemId: "us1",
      toItemId: "ac2",
      type: "validated_by",
      legacy: false,
    });
    const { rows } = buildMatrixRows(graph);
    const throughUs1 = rows.filter((row) => row.itemIds.includes("us1"));
    expect(throughUs1.length).toBe(2);
  });

  it("reads a legacy derives_from chain as a complete row", () => {
    const { rows } = buildMatrixRows(legacyGraph());
    expect(rows.length).toBe(1);
    expect(rows[0].itemIds).toEqual(["obj1", "br1", "fr1", "us1", "ac1"]);
    expect(rows[0].hasGap).toBe(false);
  });

  it("truncates rather than growing without bound, and says so", () => {
    const { rows, truncated } = buildMatrixRows(sampleGraph(), { maxRows: 2 });
    expect(rows.length).toBe(2);
    expect(truncated).toBe(true);
  });

  it("describes a row in words, naming the gaps as well as the items", () => {
    const { rows } = buildMatrixRows(sampleGraph());
    const gapRow = rows.find((row) => row.hasGap);
    expect(gapRow).toBeDefined();
    if (!gapRow) return;
    const text = describeMatrixRow(gapRow);
    expect(text).toMatch(/missing /);
    // Every cell contributes, so the sentence has as many clauses as the row has cells.
    expect(text.split(", then ").length).toBe(gapRow.cells.length);
  });
});

describe("map layout", () => {
  it("puts every spine type in its own column, in spine order", () => {
    const layout = layoutMap(sampleGraph());
    // The sample graph populates all six columns, so none is dropped here.
    expect(layout.columns.map((column) => column.type)).toEqual(
      MAP_COLUMNS.map((column) => column.type),
    );
    expect(layout.columns[0].nodes.every((node) => node.item.type === "business_objective")).toBe(
      true,
    );
  });

  it("sends every off-spine type to the trailing column rather than dropping it", () => {
    const layout = layoutMap(sampleGraph());
    const aside = layout.columns[layout.asideColumnIndex];
    const types = aside.nodes.map((node) => node.item.type).sort();
    expect(types).toEqual(
      ["constraint", "open_question", "problem_statement", "quality_finding", "risk", "stakeholder"].sort(),
    );
  });

  it("drops empty columns so a filtered map is not pushed off the right edge", () => {
    /*
     * The bug this pins: filtering to open questions left only the trailing column
     * populated, and the five empty spine columns before it pushed the only content
     * out of a horizontally-scrolling box. The reader saw a blank map.
     */
    const graph = sampleGraph();
    const questionsOnly = {
      ...graph,
      items: graph.items.filter((item) => item.type === "open_question"),
      relations: [],
    };
    const layout = layoutMap(questionsOnly);
    expect(layout.columns.length).toBe(1);
    expect(layout.columns[0].type).toBe("__aside");
    expect(layout.asideColumnIndex).toBe(0);
    // And the first (only) column starts at x = 0, on screen.
    expect(layout.columns[0].nodes[0].column).toBe(0);
  });

  it("reports asideColumnIndex as -1 when the filter left nothing off-spine", () => {
    const graph = sampleGraph();
    const spineOnly = {
      ...graph,
      items: graph.items.filter((item) => item.type === "business_requirement"),
      relations: [],
    };
    const layout = layoutMap(spineOnly);
    expect(layout.columns.length).toBe(1);
    expect(layout.asideColumnIndex).toBe(-1);
  });

  it("returns no columns at all for an empty graph", () => {
    const layout = layoutMap({ projectId: "p", items: [], relations: [] });
    expect(layout.columns).toEqual([]);
    expect(layout.asideColumnIndex).toBe(-1);
  });

  it("orders nodes by display id, so the layout is stable between visits", () => {
    const first = layoutMap(sampleGraph());
    const shuffled = sampleGraph();
    shuffled.items.reverse();
    const second = layoutMap(shuffled);
    expect(second.columns.map((c) => c.nodes.map((n) => n.item.displayId))).toEqual(
      first.columns.map((c) => c.nodes.map((n) => n.item.displayId)),
    );
  });

  it("keeps every edge whose endpoints are both on the map", () => {
    const layout = layoutMap(sampleGraph());
    expect(layout.edges.length).toBe(sampleGraph().relations.length);
  });

  it("marks a legacy edge so the UI can dash and badge it", () => {
    const layout = layoutMap(legacyGraph());
    expect(layout.edges.length).toBe(4);
    expect(layout.edges.every((edge) => edge.legacy)).toBe(true);
  });

  it("reports a size that covers every node", () => {
    const layout = layoutMap(sampleGraph());
    const size = layoutSize(layout);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });

  it("describes a node with every edge it touches, in both directions", () => {
    const layout = layoutMap(sampleGraph());
    const br1 = layout.columns
      .flatMap((column) => column.nodes)
      .find((node) => node.item.id === "br1");
    expect(br1).toBeDefined();
    if (!br1) return;
    const lines = describeMapNode(layout, br1, (edge, direction) =>
      relationPhrase(edge.type, direction),
    );
    // One out (implemented_by FR-001) and one in (supports, from OBJ-001).
    expect(lines.length).toBe(2);
    expect(lines.some((line) => line.includes("FR-001"))).toBe(true);
    expect(lines.some((line) => line.includes("OBJ-001"))).toBe(true);
  });
});

describe("filters", () => {
  const coverage = computeCoverage(sampleGraph());

  it("reports no active filter for the empty state", () => {
    expect(hasActiveTraceFilter(EMPTY_TRACE_FILTERS)).toBe(false);
    expect(hasActiveTraceFilter({ ...EMPTY_TRACE_FILTERS, type: "risk" })).toBe(true);
  });

  it("returns the graph unchanged when nothing is filtered", () => {
    const graph = sampleGraph();
    const result = filterGraph(graph, EMPTY_TRACE_FILTERS, coverage);
    expect(result.items.length).toBe(graph.items.length);
    expect(result.relations.length).toBe(graph.relations.length);
  });

  it("drops an edge as soon as either endpoint is filtered out", () => {
    const result = filterGraph(
      sampleGraph(),
      { ...EMPTY_TRACE_FILTERS, type: "business_requirement" },
      coverage,
    );
    expect(result.items.every((item) => item.type === "business_requirement")).toBe(true);
    // Every relation in the fixture crosses types, so none survives.
    expect(result.relations).toEqual([]);
  });

  it("filters by analysis run", () => {
    const result = filterGraph(sampleGraph(), { ...EMPTY_TRACE_FILTERS, runId: RUN_B }, coverage);
    expect(result.items.map((item) => item.id)).toEqual(["risk1"]);
  });

  it("filters by status and by priority", () => {
    const approved = filterGraph(
      sampleGraph(),
      { ...EMPTY_TRACE_FILTERS, status: "approved" },
      coverage,
    );
    expect(approved.items.map((item) => item.id).sort()).toEqual(["br3", "br4"]);

    const graph = sampleGraph();
    const br1 = graph.items.find((item) => item.id === "br1");
    if (br1) br1.priority = "critical";
    const critical = filterGraph(graph, { ...EMPTY_TRACE_FILTERS, priority: "critical" }, coverage);
    expect(critical.items.map((item) => item.id)).toEqual(["br1"]);
  });

  it("searches display id and title, case-insensitively", () => {
    const result = filterGraph(sampleGraph(), { ...EMPTY_TRACE_FILTERS, query: "fr-00" }, coverage);
    expect(result.items.map((item) => item.id).sort()).toEqual(["fr1", "fr2", "fr3"]);
  });

  it("applies a coverage filter against the unfiltered report", () => {
    // "Show me the orphans" must mean orphans in the project — not items that became
    // orphaned because a filter hid their neighbour.
    const result = filterGraph(sampleGraph(), { ...EMPTY_TRACE_FILTERS, coverage: "orphan" }, coverage);
    expect(result.items.map((item) => item.id).sort()).toEqual(["obj2", "risk1"]);
  });

  it("preserves the selected item's identity across a filter change", () => {
    // The view looks the selection up in the unfiltered graph, so filtering to a
    // subset does not blank the inspector for an item the reader is still working on.
    const graph = sampleGraph();
    const filtered = filterGraph(graph, { ...EMPTY_TRACE_FILTERS, type: "risk" }, coverage);
    expect(filtered.items.some((item) => item.id === "br1")).toBe(false);
    expect(graph.items.some((item) => item.id === "br1")).toBe(true);
  });
});
