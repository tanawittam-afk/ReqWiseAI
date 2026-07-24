/**
 * The source write path.
 *
 * What is proven here is the *request* this layer issues: which fields it sets, which
 * it refuses to take from the caller, and where it reads a revision's identity from.
 * The fake enforces no rules, which is the point — if the payload is wrong, no
 * database is being asked to save the code from itself.
 *
 * The rules themselves (archived projects, locked revisions, chain integrity) are
 * enforced by triggers and proven in `scripts/verify-sources.mts` against real
 * Postgres. Here the archived case is checked because the *service* refuses it before
 * the database ever sees it, which is what turns a raw trigger error into a sentence.
 */

import { describe, expect, it } from "vitest";
import {
  createSource,
  createSourceRevision,
  updateSource,
} from "../../lib/sources/service";
import { sourceContentSchema } from "../../lib/contracts/source";
import { fakeSupabase, type Row } from "../fake-supabase";

const PROJECT = "project-1";

const INPUT = sourceContentSchema.parse({
  title: "  Kick-off meeting  ",
  kind: "meeting_notes",
  rawText: "  Front desk needs same-day booking.\n\n\n- และต้องเช็คอินเองได้\n",
  sourceDate: "2026-07-24",
  stakeholder: "Front Desk Manager",
  notes: "",
});

function client(options: { status?: string; sources?: Row[]; userId?: string | null } = {}) {
  return fakeSupabase(
    {
      projects: [{ id: PROJECT, status: options.status ?? "active" }],
      source_documents: options.sources ?? [],
    },
    { userId: options.userId },
  );
}

describe("createSource", () => {
  it("writes the raw text verbatim and the title trimmed", async () => {
    const supabase = client();
    const result = await createSource(supabase, PROJECT, INPUT);

    expect(result.ok).toBe(true);
    const payload = supabase.writes[0].payload;
    expect(payload.raw_text).toBe(INPUT.rawText);
    expect(payload.title).toBe("Kick-off meeting");
  });

  it("takes project and creator from the server, never from the input", async () => {
    const supabase = client({ userId: "the-session-user" });
    await createSource(supabase, PROJECT, INPUT);

    const payload = supabase.writes[0].payload;
    expect(payload.project_id).toBe(PROJECT);
    expect(payload.created_by).toBe("the-session-user");
  });

  it("omits revision identity so the column defaults are the only writer", async () => {
    const supabase = client();
    await createSource(supabase, PROJECT, INPUT);

    const payload = supabase.writes[0].payload;
    expect(payload).not.toHaveProperty("revision_number");
    expect(payload).not.toHaveProperty("document_key");
    expect(payload).not.toHaveProperty("supersedes_source_document_id");
  });

  it("stores only the optional metadata that was given", async () => {
    const supabase = client();
    await createSource(supabase, PROJECT, INPUT);

    expect(supabase.writes[0].payload.metadata).toEqual({
      sourceDate: "2026-07-24",
      stakeholder: "Front Desk Manager",
    });
  });

  it("refuses an archived project and writes nothing", async () => {
    const supabase = client({ status: "archived" });
    const result = await createSource(supabase, PROJECT, INPUT);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/archived/i);
    expect(supabase.writes).toHaveLength(0);
  });

  it("refuses a project it cannot see, with the not-found wording", async () => {
    const supabase = fakeSupabase({ projects: [], source_documents: [] });
    const result = await createSource(supabase, PROJECT, INPUT);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/not available/i);
    expect(supabase.writes).toHaveLength(0);
  });

  it("refuses when the session has gone", async () => {
    const supabase = client({ userId: null });
    const result = await createSource(supabase, PROJECT, INPUT);

    expect(result.ok).toBe(false);
    expect(supabase.writes).toHaveLength(0);
  });
});

describe("updateSource", () => {
  const existing = (): Row[] => [
    {
      id: "rev1",
      project_id: PROJECT,
      title: "old",
      kind: "meeting_notes",
      raw_text: "old text",
      metadata: {},
      revision_number: 1,
      created_by: "user-1",
    },
  ];

  it("updates only the content columns, addressed by project and id", async () => {
    const supabase = client({ sources: existing() });
    const result = await updateSource(supabase, PROJECT, "rev1", INPUT);

    expect(result.ok).toBe(true);
    const payload = supabase.writes[0].payload;
    expect(Object.keys(payload).sort()).toEqual(["kind", "metadata", "raw_text", "title"]);
    expect(payload.raw_text).toBe(INPUT.rawText);
  });

  it("treats zero matched rows as a refusal, not an empty success", async () => {
    const supabase = client({ sources: [] });
    const result = await updateSource(supabase, PROJECT, "missing", INPUT);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/no longer editable/i);
  });

  it("refuses an archived project before issuing the update", async () => {
    const supabase = client({ status: "archived", sources: existing() });
    const result = await updateSource(supabase, PROJECT, "rev1", INPUT);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/archived/i);
    expect(supabase.writes).toHaveLength(0);
  });
});

describe("createSourceRevision", () => {
  const locked = (): Row[] => [
    {
      id: "rev1",
      project_id: PROJECT,
      document_key: "doc-key-1",
      revision_number: 1,
      title: "Kick-off meeting",
      kind: "meeting_notes",
      raw_text: "original",
      metadata: {},
      created_by: "user-1",
    },
  ];

  it("reads the revision identity from the database, not from the caller", async () => {
    const supabase = client({ sources: locked() });
    const result = await createSourceRevision(supabase, PROJECT, "rev1", INPUT);

    expect(result.ok).toBe(true);
    const payload = supabase.writes[0].payload;
    expect(payload.document_key).toBe("doc-key-1");
    expect(payload.revision_number).toBe(2);
    expect(payload.supersedes_source_document_id).toBe("rev1");
    expect(payload.project_id).toBe(PROJECT);
  });

  it("carries the edited text into the new revision verbatim", async () => {
    const supabase = client({ sources: locked() });
    await createSourceRevision(supabase, PROJECT, "rev1", INPUT);

    expect(supabase.writes[0].payload.raw_text).toBe(INPUT.rawText);
  });

  it("leaves the previous revision untouched", async () => {
    const sources = locked();
    const supabase = client({ sources });
    await createSourceRevision(supabase, PROJECT, "rev1", INPUT);

    const previous = sources.find((row) => row.id === "rev1");
    expect(previous?.raw_text).toBe("original");
    expect(previous?.revision_number).toBe(1);
    expect(supabase.writes.every((write) => write.kind === "insert")).toBe(true);
  });

  it("refuses when the predecessor is not visible under this project", async () => {
    const supabase = client({ sources: [] });
    const result = await createSourceRevision(supabase, PROJECT, "rev1", INPUT);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/not available/i);
    expect(supabase.writes).toHaveLength(0);
  });

  it("refuses an archived project before reading anything", async () => {
    const supabase = client({ status: "archived", sources: locked() });
    const result = await createSourceRevision(supabase, PROJECT, "rev1", INPUT);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/archived/i);
    expect(supabase.writes).toHaveLength(0);
  });
});
