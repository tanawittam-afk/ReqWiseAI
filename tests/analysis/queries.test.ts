/**
 * Analysis run loaders — the shape returned, cross-project isolation, grouped
 * counts, and that a run's error is never rendered as raw provider output or a raw
 * issue list. Visibility itself is RLS's job, proven in scripts/verify-analysis.mts.
 */

import { describe, expect, it } from "vitest";
import { getAnalysisRun, listAnalysisRuns, safeErrorSummary } from "../../lib/analysis/queries";
import { fakeSupabase, type Row } from "../fake-supabase";

const PROJECT = "project-1";
const RUN = "run-1";

function run(overrides: Partial<Row> = {}): Row {
  return {
    id: RUN,
    project_id: PROJECT,
    source_document_id: "source-1",
    validation_status: "valid",
    output_lang: "th",
    schema_version: "1.0.0",
    created_at: "2026-07-25T00:00:00.000Z",
    error: null,
    ...overrides,
  };
}

function item(overrides: Partial<Row> & { id: string }): Row {
  return {
    project_id: PROJECT,
    analysis_run_id: RUN,
    display_id: "BR-001",
    provider_key: "br-1",
    item_type: "business_requirement",
    title: "Title",
    description: "Description",
    priority: "unassigned",
    status: "draft",
    evidence_class: "stated",
    origin: "source_analysis",
    confidence: 0.8,
    rationale: null,
    attributes: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("getAnalysisRun", () => {
  it("returns null for a run id under the wrong project", async () => {
    const client = fakeSupabase({ analysis_runs: [run({ project_id: "other-project" })] });
    expect(await getAnalysisRun(client, PROJECT, RUN)).toBeNull();
  });

  it("returns null for an unknown run id", async () => {
    const client = fakeSupabase({ analysis_runs: [] });
    expect(await getAnalysisRun(client, PROJECT, RUN)).toBeNull();
  });

  it("groups items by type for the summary", async () => {
    const client = fakeSupabase({
      analysis_runs: [run()],
      analysis_items: [
        item({ id: "i1", item_type: "business_requirement" }),
        item({ id: "i2", item_type: "business_requirement" }),
        item({ id: "i3", item_type: "risk" }),
      ],
    });

    const detail = await getAnalysisRun(client, PROJECT, RUN);
    expect(detail?.summary.itemCount).toBe(3);
    expect(detail?.summary.byType.business_requirement).toBe(2);
    expect(detail?.summary.byType.risk).toBe(1);
  });

  it("resolves a relation's to_item_id into the related item's display id", async () => {
    const client = fakeSupabase({
      analysis_runs: [run()],
      analysis_items: [
        item({ id: "i1", display_id: "FR-001", item_type: "functional_requirement" }),
        item({ id: "i2", display_id: "BR-001", item_type: "business_requirement" }),
      ],
      item_relations: [{ from_item_id: "i1", to_item_id: "i2", project_id: PROJECT }],
    });

    const detail = await getAnalysisRun(client, PROJECT, RUN);
    const fr = detail?.items.find((i) => i.id === "i1");
    expect(fr?.relatedDisplayIds).toEqual(["BR-001"]);
  });

  it("attaches source references to the right item", async () => {
    const client = fakeSupabase({
      analysis_runs: [run()],
      analysis_items: [item({ id: "i1" })],
      item_source_references: [
        {
          item_id: "i1",
          excerpt: "quoted text",
          start_offset: 0,
          end_offset: 11,
          evidence_strength: 0.9,
          offset_verified: true,
        },
      ],
    });

    const detail = await getAnalysisRun(client, PROJECT, RUN);
    expect(detail?.items[0].sourceReferences).toEqual([
      { excerpt: "quoted text", startOffset: 0, endOffset: 11, evidenceStrength: 0.9, offsetVerified: true },
    ]);
  });

  it("excludes soft-deleted items", async () => {
    const client = fakeSupabase({
      analysis_runs: [run()],
      analysis_items: [item({ id: "i1" }), item({ id: "i2", deleted_at: "2026-07-25T00:00:00.000Z" })],
    });

    const detail = await getAnalysisRun(client, PROJECT, RUN);
    expect(detail?.items.map((i) => i.id)).toEqual(["i1"]);
  });
});

describe("listAnalysisRuns", () => {
  it("returns only runs for the given source, newest first", async () => {
    const client = fakeSupabase({
      analysis_runs: [
        run({ id: "old", source_document_id: "source-1", created_at: "2026-07-01T00:00:00.000Z" }),
        run({ id: "new", source_document_id: "source-1", created_at: "2026-07-25T00:00:00.000Z" }),
        run({ id: "other-source", source_document_id: "source-2", created_at: "2026-07-30T00:00:00.000Z" }),
      ],
    });

    const rows = await listAnalysisRuns(client, PROJECT, "source-1");
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });
});

describe("safeErrorSummary", () => {
  it("returns null for a valid run", () => {
    expect(safeErrorSummary("valid", null)).toBeNull();
  });

  it("never echoes the raw error message for a provider_error run", () => {
    const summary = safeErrorSummary("provider_error", { category: "provider_error", message: "raw internal detail with a stack trace" });
    expect(summary?.message).not.toMatch(/stack trace/);
  });

  it("counts issues without rendering their raw contents for an invalid run", () => {
    const summary = safeErrorSummary("invalid", {
      category: "validation_failed",
      issues: [{ kind: "schema_error", code: "x", path: "items[0].title", message: "internal detail" }],
    });
    expect(summary?.message).toMatch(/1 issue/);
    expect(summary?.message).not.toMatch(/internal detail|items\[0\]/);
  });
});
