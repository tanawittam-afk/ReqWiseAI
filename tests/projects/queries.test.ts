/**
 * Project loaders.
 *
 * These prove the *query* is right — the filter that is applied, the shape that comes
 * back, and that a missing row is a null rather than a throw. Whether a row is visible
 * at all is RLS's decision and is verified against the real database in
 * `scripts/verify-projects.mts`.
 */

import { describe, expect, it } from "vitest";
import { countProjects, getProject, listProjects } from "../../lib/projects/queries";
import { fakeSupabase, type Row } from "../fake-supabase";

const BOOKING = { key: "booking_smart_space", name: "Booking and Smart Space" };

function project(overrides: Partial<Row> & { id: string; status: string }): Row {
  return {
    name: `Project ${overrides.id}`,
    output_lang: "th",
    output_lang_mode: "fixed",
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-24T00:00:00.000Z",
    archived_at: null,
    domain_profiles: BOOKING,
    source_documents: [{ count: 0 }],
    analysis_items: [{ count: 0 }],
    description: null,
    business_objective: null,
    known_stakeholders: null,
    archive_reason: null,
    ...overrides,
  };
}

const ROWS: Row[] = [
  project({ id: "p-active-1", status: "active" }),
  project({ id: "p-active-2", status: "active" }),
  project({ id: "p-archived", status: "archived", archived_at: "2026-07-24T10:00:00.000Z" }),
];

describe("listProjects", () => {
  it("returns only active projects under the active filter", async () => {
    const rows = await listProjects(fakeSupabase({ projects: ROWS }), "active");
    expect(rows.map((r) => r.id)).toEqual(["p-active-1", "p-active-2"]);
    expect(rows.every((r) => r.status === "active")).toBe(true);
  });

  it("returns only archived projects under the archived filter", async () => {
    const rows = await listProjects(fakeSupabase({ projects: ROWS }), "archived");
    expect(rows.map((r) => r.id)).toEqual(["p-archived"]);
  });

  it("returns everything under the all filter", async () => {
    const rows = await listProjects(fakeSupabase({ projects: ROWS }), "all");
    expect(rows).toHaveLength(3);
  });

  it("maps the row into the presentation shape without leaking tenancy columns", async () => {
    const [first] = await listProjects(fakeSupabase({ projects: ROWS }), "active");
    expect(first).toEqual({
      id: "p-active-1",
      name: "Project p-active-1",
      status: "active",
      outputLang: "th",
      outputLangMode: "fixed",
      domain: BOOKING,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
      archivedAt: null,
      sourceDocumentCount: 0,
      analysisItemCount: 0,
      qualityScore: null,
    });
    expect(first).not.toHaveProperty("organization_id");
    expect(first).not.toHaveProperty("created_by");
  });

  it("reads the embedded counts that give each card its totals", async () => {
    const rows = await listProjects(
      fakeSupabase({
        projects: [
          project({
            id: "p1",
            status: "active",
            source_documents: [{ count: 2 }],
            analysis_items: [{ count: 31 }],
          }),
        ],
      }),
      "active",
    );
    expect(rows[0].sourceDocumentCount).toBe(2);
    expect(rows[0].analysisItemCount).toBe(31);
  });

  it("treats a missing aggregate as zero rather than undefined", async () => {
    const rows = await listProjects(
      fakeSupabase({
        projects: [{ ...project({ id: "p1", status: "active" }), source_documents: null }],
      }),
      "active",
    );
    expect(rows[0].sourceDocumentCount).toBe(0);
  });

  it("accepts an embedded domain returned as a one-element array", async () => {
    const rows = await listProjects(
      fakeSupabase({ projects: [project({ id: "p1", status: "active", domain_profiles: [BOOKING] })] }),
      "active",
    );
    expect(rows[0].domain).toEqual(BOOKING);
  });

  it("surfaces a query failure instead of pretending the list is empty", async () => {
    const client = fakeSupabase({ projects: ROWS }, { failTable: "projects", failWith: "down" });
    await expect(listProjects(client, "active")).rejects.toThrow(/project list query failed/);
  });

  describe("output language mode (Phase 2, Slice 6)", () => {
    it("carries a project's match_source preference through", async () => {
      const rows = await listProjects(
        fakeSupabase({
          projects: [project({ id: "p1", status: "active", output_lang_mode: "match_source" })],
        }),
        "active",
      );
      expect(rows[0].outputLangMode).toBe("match_source");
    });
  });

  describe("quality score (Phase 2, Slice 3)", () => {
    it("merges each project's score from the view by project id, never mixing them up", async () => {
      const rows = await listProjects(
        fakeSupabase({
          projects: [
            project({ id: "p-active-1", status: "active" }),
            project({ id: "p-active-2", status: "active" }),
          ],
          project_quality_scores: [
            { project_id: "p-active-1", quality_score: 62 },
            { project_id: "p-active-2", quality_score: 100 },
          ],
        }),
        "active",
      );
      expect(rows.find((r) => r.id === "p-active-1")?.qualityScore).toBe(62);
      expect(rows.find((r) => r.id === "p-active-2")?.qualityScore).toBe(100);
    });

    it("is null, not 0, for a project with no row in the view yet", async () => {
      const rows = await listProjects(
        fakeSupabase({
          projects: [project({ id: "p-no-runs", status: "active" })],
          project_quality_scores: [],
        }),
        "active",
      );
      expect(rows[0].qualityScore).toBeNull();
    });

    it("surfaces a quality-score query failure rather than silently dropping every score", async () => {
      const client = fakeSupabase(
        { projects: ROWS },
        { failTable: "project_quality_scores", failWith: "down" },
      );
      await expect(listProjects(client, "active")).rejects.toThrow(/quality score query failed/);
    });
  });
});

describe("getProject", () => {
  const client = () =>
    fakeSupabase({
      projects: [
        project({
          id: "p-detail",
          status: "active",
          source_documents: [{ count: 1 }],
          analysis_items: [{ count: 7 }],
        }),
        ...ROWS,
      ],
      analysis_runs: [{ id: "r1", project_id: "p-detail" }],
    });

  it("returns the detail shape with embedded and counted children", async () => {
    const detail = await getProject(client(), "p-detail");
    expect(detail?.id).toBe("p-detail");
    // Sources and items ride along with the row; runs are counted separately.
    expect(detail?.sourceDocumentCount).toBe(1);
    expect(detail?.analysisItemCount).toBe(7);
    expect(detail?.analysisRunCount).toBe(1);
    expect(detail?.knownStakeholders).toEqual([]);
  });

  it("returns null for an unknown project — the same answer another tenant's id gets", async () => {
    expect(await getProject(client(), "does-not-exist")).toBeNull();
  });

  it("carries the quality score too (Phase 2, Slice 3)", async () => {
    const detail = await getProject(
      fakeSupabase({
        projects: [project({ id: "p-detail", status: "active" })],
        analysis_runs: [{ id: "r1", project_id: "p-detail" }],
        project_quality_scores: [{ project_id: "p-detail", quality_score: 77 }],
      }),
      "p-detail",
    );
    expect(detail?.qualityScore).toBe(77);
  });
});

describe("countProjects", () => {
  it("counts each state separately", async () => {
    expect(await countProjects(fakeSupabase({ projects: ROWS }))).toEqual({
      active: 2,
      archived: 1,
    });
  });
});
