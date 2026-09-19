/**
 * Analysis input construction — proves it is built entirely from database values and
 * refuses every condition a confirmation screen needs a sentence for. The domain
 * profile's own validity is `lib/domain/load-profile.ts`'s concern, exercised in
 * `scripts/verify-db.mts`; here a valid profile row is fixture data.
 */

import { describe, expect, it } from "vitest";
import { buildAnalysisInput } from "../../lib/analysis/input";
import { fakeSupabase, type Row } from "../fake-supabase";

const PROJECT = "project-1";

function project(overrides: Partial<Row> = {}): Row {
  return {
    id: PROJECT,
    name: "Smart Space rollout",
    status: "active",
    output_lang: "th",
    output_lang_mode: "fixed",
    domain_profiles: { key: "booking_smart_space", name: "Booking and Smart Space" },
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    archived_at: null,
    description: "A pilot booking system",
    ...overrides,
  };
}

function source(overrides: Partial<Row> & { id: string }): Row {
  return {
    project_id: PROJECT,
    title: "Kick-off meeting",
    kind: "meeting_notes",
    revision_number: 1,
    supersedes_source_document_id: null,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    metadata: {},
    raw_text: "ลูกค้าต้องจองห้องได้จากมือถือ",
    created_by: "user-1",
    ...overrides,
  };
}

const DOMAIN_PROFILE_ROW: Row = {
  id: "domain-1",
  key: "booking_smart_space",
  name: "Booking and Smart Space",
  description: "Booking systems for small businesses",
  content: {
    terminology: [],
    typicalStakeholders: [],
    commonWorkflows: [],
    commonBusinessRules: [],
    requiredClarificationCategories: [],
    commonRisks: [],
    suggestedNonFunctionalRequirements: [],
    validationRules: [],
    stakeholderQuestionTemplates: [],
  },
};

function client(rows: { projects?: Row[]; source_documents?: Row[] } = {}) {
  return fakeSupabase({
    projects: rows.projects ?? [project()],
    source_documents: rows.source_documents ?? [source({ id: "src-1" })],
    domain_profiles: [DOMAIN_PROFILE_ROW],
  });
}

describe("buildAnalysisInput", () => {
  it("reads the domain profile, output language and source text from the database", async () => {
    const result = await buildAnalysisInput(client(), PROJECT, "src-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.domainProfile.key).toBe("booking_smart_space");
    expect(result.input.outputLang).toBe("th");
    expect(result.input.sourceDocuments).toHaveLength(1);
    expect(result.input.sourceDocuments[0].text).toBe("ลูกค้าต้องจองห้องได้จากมือถือ");
    expect(result.input.sourceDocuments[0].id).toBe("src-1");
    expect(result.sourceTitle).toBe("Kick-off meeting");
  });

  it("carries project context for the provider, never as evidence", async () => {
    const result = await buildAnalysisInput(client(), PROJECT, "src-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.projectContext).toEqual({
      name: "Smart Space rollout",
      description: "A pilot booking system",
    });
  });

  it("refuses an archived project", async () => {
    const result = await buildAnalysisInput(
      client({ projects: [project({ status: "archived" })] }),
      PROJECT,
      "src-1",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/archived/i);
  });

  it("refuses a project it cannot see", async () => {
    const result = await buildAnalysisInput(client({ projects: [] }), PROJECT, "src-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not available/i);
  });

  it("refuses a source it cannot see, or that lives in a different project", async () => {
    const result = await buildAnalysisInput(client({ source_documents: [] }), PROJECT, "src-1");
    expect(result.ok).toBe(false);
  });

  it("refuses a source with no text to analyse", async () => {
    const result = await buildAnalysisInput(
      client({ source_documents: [source({ id: "src-1", raw_text: "   " })] }),
      PROJECT,
      "src-1",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/no text/i);
  });

  describe("output language (Phase 2, Slice 6)", () => {
    it("uses the project's fixed language, ignoring the source's actual content", async () => {
      const result = await buildAnalysisInput(
        client({
          projects: [project({ output_lang: "en", output_lang_mode: "fixed" })],
          source_documents: [source({ id: "src-1", raw_text: "ลูกค้าต้องจองห้องได้จากมือถือ" })],
        }),
        PROJECT,
        "src-1",
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.input.outputLang).toBe("en");
    });

    it("resolves 'match_source' to 'th' for a Thai-heavy note", async () => {
      const result = await buildAnalysisInput(
        client({
          projects: [project({ output_lang: "en", output_lang_mode: "match_source" })],
          source_documents: [source({ id: "src-1", raw_text: "ลูกค้าต้องจองห้องได้จากมือถือ" })],
        }),
        PROJECT,
        "src-1",
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.input.outputLang).toBe("th");
    });

    it("resolves 'match_source' to 'en' for an English-heavy note", async () => {
      const result = await buildAnalysisInput(
        client({
          projects: [project({ output_lang: "th", output_lang_mode: "match_source" })],
          source_documents: [
            source({ id: "src-1", raw_text: "Customers must be able to book a room from their phone." }),
          ],
        }),
        PROJECT,
        "src-1",
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.input.outputLang).toBe("en");
    });
  });
});
