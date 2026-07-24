/**
 * Source loaders.
 *
 * These prove the query is right — which filters are applied, what shape comes back,
 * that lock state is derived rather than read, and that a missing row is a null rather
 * than a throw. Whether a row is visible at all is RLS's decision and is verified
 * against the real database in `scripts/verify-sources.mts`.
 */

import { describe, expect, it } from "vitest";
import { buildPreview, countSources, getSource, listSources } from "../../lib/sources/queries";
import { fakeSupabase, type Row } from "../fake-supabase";

const PROJECT = "project-1";

function source(overrides: Partial<Row> & { id: string }): Row {
  return {
    project_id: PROJECT,
    title: `Source ${overrides.id}`,
    kind: "meeting_notes",
    revision_number: 1,
    supersedes_source_document_id: null,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    metadata: {},
    raw_text: "Front desk needs same-day booking.",
    created_by: "user-1",
    ...overrides,
  };
}

describe("listSources", () => {
  it("returns only the sources of the project in the route", async () => {
    const client = fakeSupabase({
      source_documents: [
        source({ id: "s1" }),
        source({ id: "s2" }),
        source({ id: "other", project_id: "project-2" }),
      ],
    });

    const rows = await listSources(client, PROJECT);
    expect(rows.map((r) => r.id)).toEqual(["s1", "s2"]);
  });

  it("orders newest first", async () => {
    const client = fakeSupabase({
      source_documents: [
        source({ id: "older", created_at: "2026-07-01T00:00:00.000Z" }),
        source({ id: "newest", created_at: "2026-07-24T00:00:00.000Z" }),
        source({ id: "middle", created_at: "2026-07-10T00:00:00.000Z" }),
      ],
    });

    const rows = await listSources(client, PROJECT);
    expect(rows.map((r) => r.id)).toEqual(["newest", "middle", "older"]);
  });

  it("honours a limit, for the overview's recent list", async () => {
    const client = fakeSupabase({
      source_documents: [
        source({ id: "a", created_at: "2026-07-01T00:00:00.000Z" }),
        source({ id: "b", created_at: "2026-07-02T00:00:00.000Z" }),
        source({ id: "c", created_at: "2026-07-03T00:00:00.000Z" }),
      ],
    });

    const rows = await listSources(client, PROJECT, { limit: 2 });
    expect(rows.map((r) => r.id)).toEqual(["c", "b"]);
  });

  it("derives the lock from analysis runs, not from a column", async () => {
    const client = fakeSupabase({
      source_documents: [source({ id: "cited" }), source({ id: "untouched" })],
      analysis_runs: [{ id: "run-1", project_id: PROJECT, source_document_id: "cited" }],
    });

    const rows = await listSources(client, PROJECT);
    expect(rows.find((r) => r.id === "cited")?.locked).toBe(true);
    expect(rows.find((r) => r.id === "untouched")?.locked).toBe(false);
  });

  it("maps into the presentation shape without leaking tenancy columns", async () => {
    const client = fakeSupabase({ source_documents: [source({ id: "s1" })] });
    const [row] = await listSources(client, PROJECT);

    expect(row).toEqual({
      id: "s1",
      title: "Source s1",
      kind: "meeting_notes",
      revisionNumber: 1,
      locked: false,
      supersedesId: null,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
      sourceDate: null,
      characterCount: "Front desk needs same-day booking.".length,
      preview: "Front desk needs same-day booking.",
    });
    expect(row).not.toHaveProperty("created_by");
    expect(row).not.toHaveProperty("project_id");
  });

  it("surfaces a query failure instead of pretending the list is empty", async () => {
    const client = fakeSupabase(
      { source_documents: [source({ id: "s1" })] },
      { failTable: "source_documents", failWith: "down" },
    );
    await expect(listSources(client, PROJECT)).rejects.toThrow(/source list query failed/);
  });
});

describe("getSource", () => {
  const client = () =>
    fakeSupabase({
      source_documents: [
        source({ id: "rev1", revision_number: 1, raw_text: "  original\n\ntext\n" }),
        source({
          id: "rev2",
          revision_number: 2,
          supersedes_source_document_id: "rev1",
          metadata: { sourceDate: "2026-07-24", stakeholder: "Front Desk Manager" },
        }),
        source({ id: "elsewhere", project_id: "project-2" }),
      ],
      analysis_runs: [{ id: "run-1", project_id: PROJECT, source_document_id: "rev1" }],
    });

  it("returns the raw text exactly as stored", async () => {
    const detail = await getSource(client(), PROJECT, "rev1");
    expect(detail?.rawText).toBe("  original\n\ntext\n");
  });

  it("supports substring addressing after a full round trip", async () => {
    const detail = await getSource(client(), PROJECT, "rev1");
    const text = detail?.rawText ?? "";
    const start = text.indexOf("text");
    expect(text.substring(start, start + 4)).toBe("text");
  });

  it("reports a cited revision as locked and counts the runs", async () => {
    const detail = await getSource(client(), PROJECT, "rev1");
    expect(detail?.locked).toBe(true);
    expect(detail?.analysisRunCount).toBe(1);
  });

  it("finds the successor of a superseded revision", async () => {
    const detail = await getSource(client(), PROJECT, "rev1");
    expect(detail?.supersededById).toBe("rev2");
    expect(detail?.supersededByRevision).toBe(2);
  });

  it("maps the revision chain from the newer revision's side too", async () => {
    const detail = await getSource(client(), PROJECT, "rev2");
    expect(detail?.supersedesId).toBe("rev1");
    expect(detail?.supersededById).toBeNull();
    expect(detail?.locked).toBe(false);
  });

  it("reads optional metadata back into named fields", async () => {
    const detail = await getSource(client(), PROJECT, "rev2");
    expect(detail?.metadata).toEqual({
      sourceDate: "2026-07-24",
      stakeholder: "Front Desk Manager",
      notes: null,
    });
  });

  it("returns null for an unknown id", async () => {
    expect(await getSource(client(), PROJECT, "does-not-exist")).toBeNull();
  });

  it("returns null for a real source id under the wrong project", async () => {
    // The same answer another tenant's id gets: nothing is confirmed either way.
    expect(await getSource(client(), PROJECT, "elsewhere")).toBeNull();
  });
});

describe("countSources", () => {
  it("counts only this project's documents", async () => {
    const client = fakeSupabase({
      source_documents: [
        source({ id: "s1" }),
        source({ id: "s2" }),
        source({ id: "other", project_id: "project-2" }),
      ],
    });
    expect(await countSources(client, PROJECT)).toBe(2);
  });
});

describe("buildPreview", () => {
  it("condenses for display only, and says so by never being stored", () => {
    expect(buildPreview("  first line  \n\n  second line \nthird")).toBe(
      "first line · second line",
    );
  });

  it("truncates a long opening line", () => {
    const preview = buildPreview("x".repeat(400));
    expect(preview.length).toBeLessThanOrEqual(160);
    expect(preview.endsWith("…")).toBe(true);
  });
});
