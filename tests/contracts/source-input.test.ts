/**
 * The source input contract.
 *
 * Two jobs. The first is the ordinary one: reject what a database CHECK would reject,
 * earlier and with a sentence attached.
 *
 * The second is the one that matters more. Raw source text is audit evidence, and
 * every excerpt a requirement will ever cite is an offset into it. A schema that
 * trimmed, normalised newlines or collapsed blank lines would move those offsets
 * silently and forever. The tests below are what stops a well-meaning `.trim()` from
 * being added later.
 */

import { describe, expect, it } from "vitest";
import {
  DERIVED_SOURCE_TITLE_FALLBACK,
  deriveSourceTitle,
  fromMetadata,
  readSourceForm,
  SOURCE_KINDS,
  SOURCE_TEXT_MAX,
  SOURCE_TITLE_MAX,
  sourceContentSchema,
  toMetadata,
} from "../../lib/contracts/source";

const VALID = {
  title: "Kick-off meeting",
  kind: "meeting_notes",
  rawText: "Front desk needs same-day booking.",
  sourceDate: "",
  stakeholder: "",
  notes: "",
};

function parse(overrides: Record<string, unknown> = {}) {
  return sourceContentSchema.safeParse({ ...VALID, ...overrides });
}

describe("title", () => {
  it("rejects an empty title", () => {
    const result = parse({ title: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/title/i);
  });

  it("rejects a whitespace-only title", () => {
    expect(parse({ title: "   \t " }).success).toBe(false);
  });

  it("trims the title before it is persisted", () => {
    const result = parse({ title: "  Kick-off meeting  " });
    expect(result.success && result.data.title).toBe("Kick-off meeting");
  });

  it("rejects a title beyond the column ceiling", () => {
    expect(parse({ title: "x".repeat(201) }).success).toBe(false);
  });
});

describe("raw text", () => {
  it("rejects empty text", () => {
    expect(parse({ rawText: "" }).success).toBe(false);
  });

  it("rejects text that is only whitespace", () => {
    const result = parse({ rawText: "   \n\n\t  \n " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/whitespace/i);
  });

  it("rejects text beyond the column ceiling", () => {
    expect(parse({ rawText: "x".repeat(SOURCE_TEXT_MAX + 1) }).success).toBe(false);
  });

  // --- the verbatim guarantee -------------------------------------------------
  it("does NOT trim leading whitespace", () => {
    const result = parse({ rawText: "    indented opening line" });
    expect(result.success && result.data.rawText).toBe("    indented opening line");
  });

  it("does NOT trim a trailing newline", () => {
    const result = parse({ rawText: "last line\n" });
    expect(result.success && result.data.rawText).toBe("last line\n");
  });

  it("keeps multiple blank lines exactly as typed", () => {
    const text = "para one\n\n\n\npara two";
    const result = parse({ rawText: text });
    expect(result.success && result.data.rawText).toBe(text);
  });

  it("keeps bullets, tabs and CRLF line endings untouched", () => {
    const text = "- ข้อแรก\r\n\t• sub point\r\n";
    const result = parse({ rawText: text });
    expect(result.success && result.data.rawText).toBe(text);
  });

  it("keeps Thai and English text byte for byte", () => {
    const text = "ผู้ใช้ต้องการจองห้องได้ทันที\nThe guest wants to book on the spot.";
    const result = parse({ rawText: text });
    expect(result.success && result.data.rawText).toBe(text);
    expect(result.success && result.data.rawText.length).toBe(text.length);
  });

  it("preserves offsets, which is the whole reason for the rules above", () => {
    const text = "  Line one\n\nLine three says: same-day booking.\n";
    const result = parse({ rawText: text });
    const stored = result.success ? result.data.rawText : "";

    const start = text.indexOf("same-day booking");
    const end = start + "same-day booking".length;
    expect(stored.substring(start, end)).toBe("same-day booking");
  });
});

describe("source type", () => {
  it("accepts every kind the database enum knows", () => {
    for (const kind of SOURCE_KINDS) expect(parse({ kind }).success).toBe(true);
  });

  it("rejects a kind the enum does not have", () => {
    expect(parse({ kind: "voicemail" }).success).toBe(false);
  });
});

describe("optional metadata", () => {
  it("turns a blank optional field into null rather than an empty string", () => {
    const result = parse({ stakeholder: "  ", notes: "" });
    expect(result.success && result.data.stakeholder).toBeNull();
    expect(result.success && result.data.notes).toBeNull();
  });

  it("accepts a real calendar date", () => {
    expect(parse({ sourceDate: "2026-07-24" }).success).toBe(true);
  });

  it("rejects a date that does not exist", () => {
    expect(parse({ sourceDate: "2026-02-31" }).success).toBe(false);
  });

  it("rejects a date in the wrong shape", () => {
    expect(parse({ sourceDate: "24/07/2026" }).success).toBe(false);
  });

  it("stores only the metadata keys that were given", () => {
    const result = parse({ sourceDate: "2026-07-24", stakeholder: "Front Desk Manager" });
    expect(result.success && toMetadata(result.data)).toEqual({
      sourceDate: "2026-07-24",
      stakeholder: "Front Desk Manager",
    });
  });

  it("reads metadata back as nulls when keys are absent", () => {
    expect(fromMetadata({})).toEqual({ sourceDate: null, stakeholder: null, notes: null });
    expect(fromMetadata(null)).toEqual({ sourceDate: null, stakeholder: null, notes: null });
  });
});

describe("fields the client may never supply", () => {
  it.each([
    ["projectId", "11111111-1111-1111-1111-111111111111"],
    ["organizationId", "22222222-2222-2222-2222-222222222222"],
    ["createdBy", "33333333-3333-3333-3333-333333333333"],
    ["revisionNumber", 9],
    ["supersedesSourceDocumentId", "44444444-4444-4444-4444-444444444444"],
    ["documentKey", "55555555-5555-5555-5555-555555555555"],
    ["locked", false],
    ["analysisRunId", "66666666-6666-6666-6666-666666666666"],
  ])("rejects a payload carrying %s", (field, value) => {
    expect(parse({ [field]: value }).success).toBe(false);
  });
});

describe("readSourceForm", () => {
  function form(entries: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.append(key, value);
    return data;
  }

  it("reads only the six fields the form owns", () => {
    const read = readSourceForm(
      form({ ...VALID, revisionNumber: "9", projectId: "spoofed", createdBy: "spoofed" }),
    ) as Record<string, unknown>;

    expect(Object.keys(read).sort()).toEqual(
      ["kind", "notes", "rawText", "sourceDate", "stakeholder", "title"].sort(),
    );
  });

  it("passes the raw text through the reader untouched", () => {
    const text = "  keep   my    spacing\n\n\n";
    const read = readSourceForm(form({ ...VALID, rawText: text })) as { rawText: string };
    expect(read.rawText).toBe(text);
  });
});

describe("deriveSourceTitle", () => {
  it("uses the first line of pasted text", () => {
    expect(deriveSourceTitle("Kick-off meeting\nFront desk needs same-day booking.")).toBe(
      "Kick-off meeting",
    );
  });

  it("skips leading blank lines rather than returning an empty title", () => {
    expect(deriveSourceTitle("\n\n   \n  Sprint review \nrest of the notes")).toBe(
      "Sprint review",
    );
  });

  it("reads a CRLF document the same way as an LF one", () => {
    const body = "Meeting notes\r\nsecond line\r\n";
    expect(deriveSourceTitle(body)).toBe("Meeting notes");
    expect(deriveSourceTitle(body.replace(/\r\n/g, "\n"))).toBe("Meeting notes");
  });

  it("collapses the internal whitespace a pasted heading carries", () => {
    expect(deriveSourceTitle("Room\tbooking \u2014  discovery   call\nbody")).toBe(
      "Room booking \u2014 discovery call",
    );
  });

  it("handles Thai text", () => {
    expect(deriveSourceTitle("บันทึกการประชุม — โครงการระบบจองพื้นที่\nรายละเอียด")).toBe(
      "บันทึกการประชุม — โครงการระบบจองพื้นที่",
    );
  });

  it("never returns a title the schema would reject for length", () => {
    const derived = deriveSourceTitle(`${"ก".repeat(SOURCE_TITLE_MAX + 50)}\nbody`);
    expect(derived).toHaveLength(SOURCE_TITLE_MAX);
    expect(sourceContentSchema.safeParse({ ...VALID, title: derived }).success).toBe(true);
  });

  it("falls back when the text is only whitespace", () => {
    expect(deriveSourceTitle("   \n\t\n  ")).toBe(DERIVED_SOURCE_TITLE_FALLBACK);
    expect(deriveSourceTitle("")).toBe(DERIVED_SOURCE_TITLE_FALLBACK);
  });

  it("leaves the raw text it was handed byte-for-byte identical", () => {
    const text = "  Kick-off \r\n\r\n   keep   my    spacing\n\n\n";
    const before = text;
    deriveSourceTitle(text);
    expect(text).toBe(before);
    // and the value that reaches the schema is still the original, not the cleaned title
    const parsed = sourceContentSchema.parse({ ...VALID, rawText: text, title: "x" });
    expect(parsed.rawText).toBe(before);
  });
});
