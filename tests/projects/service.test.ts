/**
 * `createProject()`'s output-language mapping and `setOutputLanguage()` (Phase 2,
 * Slices 6/7). Not a general `lib/projects/service.ts` suite — the rest of that file's
 * behavior is exercised indirectly through `start-project-action.test.ts`'s mocks;
 * this covers only the logic this phase actually added.
 */

import { describe, expect, it } from "vitest";
import { createProject, setOutputLanguage } from "../../lib/projects/service";
import { fakeSupabase, type Row } from "../fake-supabase";

const PROFILE_ID = "3f1a9b0e-7c2d-4a55-9c31-8b0c1d2e3f44";
const ORG_ID = "org-1";

function baseTables(): Record<string, Row[]> {
  return {
    // `resolvePersonalOrganization()` filters on the dotted embedded-resource key
    // `organizations.is_personal` — the fake client treats a filter as a plain
    // `row[column] === value` lookup, so a literal key of that exact name works.
    organization_members: [{ organization_id: ORG_ID, "organizations.is_personal": true }],
    domain_profiles: [{ id: PROFILE_ID, is_active: true }],
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Smart Space booking",
    domainProfileId: PROFILE_ID,
    outputLang: "th" as const,
    description: null,
    businessObjective: null,
    knownStakeholders: [],
    ...overrides,
  };
}

describe("createProject — output language mapping", () => {
  it("writes a fixed language straight through, with mode 'fixed'", async () => {
    const client = fakeSupabase(baseTables());
    const result = await createProject(client, validInput({ outputLang: "en" }));

    expect(result.ok).toBe(true);
    const write = client.writes.find((w) => w.table === "projects");
    expect(write?.payload.output_lang).toBe("en");
    expect(write?.payload.output_lang_mode).toBe("fixed");
  });

  it("writes a placeholder language and mode 'match_source' for 'match_source'", async () => {
    const client = fakeSupabase(baseTables());
    const result = await createProject(client, validInput({ outputLang: "match_source" }));

    expect(result.ok).toBe(true);
    const write = client.writes.find((w) => w.table === "projects");
    expect(write?.payload.output_lang).toBe("th");
    expect(write?.payload.output_lang_mode).toBe("match_source");
  });
});

describe("setOutputLanguage", () => {
  it("passes the project id and the raw preference to the RPC", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { set_project_output_language: { data: null, error: null } } },
    );
    const result = await setOutputLanguage(client, { projectId: "project-1", outputLang: "match_source" });

    expect(result).toEqual({ ok: true, data: null });
    expect(client.rpcCalls[0]).toEqual({
      name: "set_project_output_language",
      args: { p_project: "project-1", p_mode: "match_source" },
    });
  });

  it("translates an archived-project refusal", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { set_project_output_language: { error: { message: "project is archived and read-only; restore it first" } } } },
    );
    const result = await setOutputLanguage(client, { projectId: "project-1", outputLang: "en" });
    expect(result).toEqual({
      ok: false,
      error: "This project is archived and read-only. Restore it to make changes.",
    });
  });

  it("translates a not-found/not-visible refusal without naming a table", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { set_project_output_language: { error: { message: "project not found or not visible" } } } },
    );
    const result = await setOutputLanguage(client, { projectId: "project-1", outputLang: "en" });
    expect(result).toEqual({ ok: false, error: "This project is unavailable." });
  });

  it("falls back to a generic sentence for an unrecognized refusal", async () => {
    const client = fakeSupabase({}, { rpc: { set_project_output_language: { error: { message: "boom" } } } });
    const result = await setOutputLanguage(client, { projectId: "project-1", outputLang: "en" });
    expect(result).toEqual({ ok: false, error: "The output language could not be changed." });
  });
});
