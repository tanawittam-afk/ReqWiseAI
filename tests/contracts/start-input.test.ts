/**
 * The combined intake contract.
 *
 * One screen now submits a project and its first source together. That is a UX change
 * and must not become a security or evidence change: the same two schemas still decide
 * what is acceptable, the two field sets must not bleed into each other, and the raw
 * text must survive the extra hop byte for byte.
 *
 * The one genuinely new behaviour is the derived title, and the test that matters most
 * is the one proving the derivation reads `rawText` without replacing it.
 */

import { describe, expect, it } from "vitest";
import { readStartForm } from "../../lib/contracts/start";
import { DERIVED_SOURCE_TITLE_FALLBACK } from "../../lib/contracts/source";

const DOMAIN_ID = "3f1d2a5c-9b6e-4f8a-9c3d-1e2b4a6c8d0f";

const VALID: Record<string, string> = {
  name: "Smart Space booking",
  domainProfileId: DOMAIN_ID,
  outputLang: "th",
  description: "",
  businessObjective: "",
  knownStakeholders: "",
  title: "",
  kind: "meeting_notes",
  rawText: "Kick-off meeting\nFront desk needs same-day booking.",
  sourceDate: "",
  stakeholder: "",
  notes: "",
};

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

describe("readStartForm", () => {
  it("splits one submission into a valid project and a valid source", () => {
    const result = readStartForm(form(VALID));
    if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.fieldErrors)}`);

    expect(result.project.name).toBe("Smart Space booking");
    expect(result.project.domainProfileId).toBe(DOMAIN_ID);
    expect(result.project.outputLang).toBe("th");
    expect(result.source.kind).toBe("meeting_notes");
  });

  it("derives the source title when the user left it blank", () => {
    const result = readStartForm(form(VALID));
    if (!result.ok) throw new Error("expected ok");
    expect(result.source.title).toBe("Kick-off meeting");
  });

  it("keeps a title the user actually typed", () => {
    const result = readStartForm(form({ ...VALID, title: "Round two with ops" }));
    if (!result.ok) throw new Error("expected ok");
    expect(result.source.title).toBe("Round two with ops");
  });

  it("falls back rather than failing when the text has no usable first line", () => {
    // Whitespace-only rawText is refused by the schema, so the text here is real but
    // starts with blank lines and a line of punctuation-free spacing.
    const result = readStartForm(form({ ...VALID, rawText: "\n\n   \nreal content" }));
    if (!result.ok) throw new Error("expected ok");
    expect(result.source.title).toBe("real content");
    expect(result.source.title).not.toBe(DERIVED_SOURCE_TITLE_FALLBACK);
  });

  it("passes the raw text through byte for byte, CRLF and all", () => {
    const text = "  บันทึกการประชุม \r\n\r\n   keep   my    spacing\n\n\n";
    const result = readStartForm(form({ ...VALID, rawText: text }));
    if (!result.ok) throw new Error("expected ok");
    expect(result.source.rawText).toBe(text);
    // …while the derived title is the cleaned copy, not the original line.
    expect(result.source.title).toBe("บันทึกการประชุม");
  });

  it("reports errors from both halves at once", () => {
    const result = readStartForm(form({ ...VALID, name: "  ", rawText: "" }));
    if (result.ok) throw new Error("expected failure");
    expect(result.fieldErrors.name).toBeTruthy();
    expect(result.fieldErrors.rawText).toBeTruthy();
  });

  it("blames the text, not the title, when nothing was pasted", () => {
    const result = readStartForm(form({ ...VALID, rawText: "" }));
    if (result.ok) throw new Error("expected failure");
    expect(result.fieldErrors.rawText).toBeTruthy();
    expect(result.fieldErrors.title).toBeUndefined();
  });

  it("ignores server-owned fields a client tries to supply", () => {
    const result = readStartForm(
      form({
        ...VALID,
        status: "approved",
        organization_id: "spoofed",
        created_by: "spoofed",
        revisionNumber: "9",
        projectId: "spoofed",
      }),
    );
    if (!result.ok) throw new Error("expected ok");
    expect(Object.keys(result.project).sort()).toEqual(
      [
        "businessObjective",
        "description",
        "domainProfileId",
        "knownStakeholders",
        "name",
        "outputLang",
      ].sort(),
    );
    expect(Object.keys(result.source).sort()).toEqual(
      ["kind", "notes", "rawText", "sourceDate", "stakeholder", "title"].sort(),
    );
  });

  it("keeps the two field sets from bleeding into each other", () => {
    // `description` belongs to the project, `notes` to the source. A screen that read
    // one as the other would silently move a user's words into the wrong row.
    const result = readStartForm(
      form({ ...VALID, description: "project-level", notes: "source-level" }),
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.project.description).toBe("project-level");
    expect(result.source.notes).toBe("source-level");
  });
});
