/**
 * Segmentation and citation offsets.
 *
 * The invariant under test throughout is the one the whole traceability story rests
 * on: `text.slice(segment.start, segment.end) === segment.excerpt`, against the text
 * exactly as stored — no newline normalisation, no trimming of the source, no
 * reconstruction from form input.
 */

import { describe, expect, it } from "vitest";
import { citeSpan, firstMatch, bestMatch, segmentSource } from "../../lib/providers/mock/runtime/segments";

/** The property every consumer depends on. */
function assertExact(text: string, segments: ReturnType<typeof segmentSource>) {
  for (const segment of segments) {
    expect(text.slice(segment.start, segment.end)).toBe(segment.excerpt);
  }
}

describe("segmentSource — newline handling", () => {
  it("keeps offsets exact for LF input", () => {
    const text = "first line\nsecond line\nthird line";
    const segments = segmentSource(text);
    expect(segments.map((s) => s.excerpt)).toEqual(["first line", "second line", "third line"]);
    assertExact(text, segments);
  });

  it("keeps offsets exact for CRLF input, without rewriting the newlines", () => {
    const text = "first line\r\nsecond line\r\nthird line";
    const segments = segmentSource(text);
    expect(segments.map((s) => s.excerpt)).toEqual(["first line", "second line", "third line"]);
    assertExact(text, segments);
    // CRLF costs two characters; the second line therefore starts at 12, not 11.
    expect(segments[1].start).toBe(12);
  });

  it("treats a lone CR as a break too", () => {
    const text = "first\rsecond";
    const segments = segmentSource(text);
    expect(segments.map((s) => s.excerpt)).toEqual(["first", "second"]);
    assertExact(text, segments);
  });

  it("survives leading whitespace, blank runs and a trailing newline", () => {
    const text = "   leading spaces\n\n\n\tindented\n";
    const segments = segmentSource(text);
    expect(segments.map((s) => s.excerpt)).toEqual(["leading spaces", "indented"]);
    assertExact(text, segments);
    // The whitespace is skipped for the citation but never removed from the source.
    expect(segments[0].start).toBe(3);
    expect(text).toContain("\n\n\n");
  });

  it("returns nothing for whitespace-only text", () => {
    expect(segmentSource("   \n\n\t  ")).toEqual([]);
  });

  it("handles Thai, English and mixed text identically", () => {
    const text = "ลูกค้าต้องการจองห้อง\nStaff must verify check-in\nลูกค้า wants a refund";
    const segments = segmentSource(text);
    expect(segments).toHaveLength(3);
    assertExact(text, segments);
  });
});

describe("segmentSource — repeated identical text", () => {
  const text = "ต้องมีระบบจอง\nอย่างอื่น\nต้องมีระบบจอง";

  it("gives each occurrence its own offsets", () => {
    const segments = segmentSource(text);
    expect(segments[0].excerpt).toBe(segments[2].excerpt);
    expect(segments[0].start).not.toBe(segments[2].start);
    assertExact(text, segments);
  });

  it("firstMatch deterministically selects the first occurrence, offsets included", () => {
    const segments = segmentSource(text);
    const chosen = firstMatch(segments, (s) => s.excerpt.includes("ระบบจอง"));
    expect(chosen?.index).toBe(0);
    expect(chosen?.start).toBe(0);
    expect(text.slice(chosen!.start, chosen!.end)).toBe(chosen!.excerpt);
  });

  it("bestMatch breaks a score tie towards the earlier occurrence", () => {
    const segments = segmentSource(text);
    // Both matching segments score identically; the first must win.
    const chosen = bestMatch(segments, (s) => (s.excerpt.includes("ระบบจอง") ? 5 : 0));
    expect(chosen?.index).toBe(0);
  });
});

describe("citeSpan", () => {
  it("narrows a span to its non-whitespace core and moves both offsets with it", () => {
    const text = "abc   hello   def";
    const span = citeSpan(text, 3, 14);
    expect(span?.excerpt).toBe("hello");
    expect(text.slice(span!.start, span!.end)).toBe(span!.excerpt);
  });

  it("returns null when the span is only whitespace", () => {
    expect(citeSpan("abc   def", 3, 6)).toBeNull();
  });

  it("caps a long span and keeps the invariant after capping", () => {
    const text = `${"x".repeat(50)} ${"y".repeat(50)}`;
    const span = citeSpan(text, 0, text.length, 51);
    expect(span!.excerpt.length).toBeLessThanOrEqual(51);
    expect(text.slice(span!.start, span!.end)).toBe(span!.excerpt);
    // Capping landed on the space; the tail was re-trimmed rather than left dangling.
    expect(span!.excerpt.endsWith(" ")).toBe(false);
  });

  it("clamps out-of-range bounds instead of producing a bad offset", () => {
    const text = "hello";
    const span = citeSpan(text, -5, 500);
    expect(span?.excerpt).toBe("hello");
    expect(text.slice(span!.start, span!.end)).toBe("hello");
  });
});
