/**
 * Source highlight range selection for the analysis result workspace — which
 * references become a visible `<mark>` and which are silently skipped because no
 * exact span was proven for them.
 */

import { describe, expect, it } from "vitest";
import {
  buildSourceSegments,
  computeHighlightRanges,
  findMatchRanges,
} from "../../lib/analysis/highlight";
import type { AnalysisItemView } from "../../lib/analysis/queries";

function refs(list: AnalysisItemView["sourceReferences"]): Pick<AnalysisItemView, "sourceReferences"> {
  return { sourceReferences: list };
}

describe("computeHighlightRanges", () => {
  it("returns nothing for a null item", () => {
    expect(computeHighlightRanges(null)).toEqual([]);
  });

  it("returns nothing when no reference has verified offsets", () => {
    const item = refs([
      { excerpt: "x", startOffset: null, endOffset: null, evidenceStrength: null, offsetVerified: false },
    ]);
    expect(computeHighlightRanges(item)).toEqual([]);
  });

  it("skips a reference whose offsets were never verified, even if present", () => {
    const item = refs([
      { excerpt: "x", startOffset: 5, endOffset: 10, evidenceStrength: null, offsetVerified: false },
    ]);
    expect(computeHighlightRanges(item)).toEqual([]);
  });

  it("includes a verified reference's exact range", () => {
    const item = refs([
      { excerpt: "x", startOffset: 5, endOffset: 10, evidenceStrength: null, offsetVerified: true },
    ]);
    expect(computeHighlightRanges(item)).toEqual([[5, 10]]);
  });

  it("sorts multiple verified references by position", () => {
    const item = refs([
      { excerpt: "b", startOffset: 20, endOffset: 25, evidenceStrength: null, offsetVerified: true },
      { excerpt: "a", startOffset: 1, endOffset: 4, evidenceStrength: null, offsetVerified: true },
    ]);
    expect(computeHighlightRanges(item)).toEqual([
      [1, 4],
      [20, 25],
    ]);
  });
});

describe("findMatchRanges", () => {
  it("matches nothing for an empty or whitespace query", () => {
    expect(findMatchRanges("booking", "")).toEqual([]);
    expect(findMatchRanges("booking", "   ")).toEqual([]);
  });

  it("finds every occurrence, case-insensitively", () => {
    expect(findMatchRanges("Room room ROOM", "room")).toEqual([
      [0, 4],
      [5, 9],
      [10, 14],
    ]);
  });

  it("finds Thai text", () => {
    expect(findMatchRanges("การคืนเงินและการยกเลิก", "คืนเงิน")).toEqual([[3, 10]]);
  });
});

describe("buildSourceSegments", () => {
  it("returns the whole text as one plain run when nothing is marked", () => {
    expect(buildSourceSegments("hello", [])).toEqual([
      { text: "hello", kind: "plain", citationIndex: null },
    ]);
  });

  it("numbers citations in document order so prev/next can address them", () => {
    const segments = buildSourceSegments("abcdefghij", [
      [6, 8],
      [1, 3],
    ]);
    expect(segments).toEqual([
      { text: "a", kind: "plain", citationIndex: null },
      { text: "bc", kind: "citation", citationIndex: 0 },
      { text: "def", kind: "plain", citationIndex: null },
      { text: "gh", kind: "citation", citationIndex: 1 },
      { text: "ij", kind: "plain", citationIndex: null },
    ]);
  });

  it("skips an overlapping citation rather than mis-rendering the span", () => {
    const segments = buildSourceSegments("abcdefghij", [
      [1, 5],
      [3, 7],
    ]);
    expect(segments.filter((s) => s.kind === "citation")).toEqual([
      { text: "bcde", kind: "citation", citationIndex: 0 },
    ]);
  });

  it("lets a citation win over a search match, marking only what is left over", () => {
    // "cd" is cited; searching "bcde" may only light "b" and "e".
    const segments = buildSourceSegments("abcdef", [[2, 4]], [[1, 5]]);
    expect(segments).toEqual([
      { text: "a", kind: "plain", citationIndex: null },
      { text: "b", kind: "match", citationIndex: null },
      { text: "cd", kind: "citation", citationIndex: 0 },
      { text: "e", kind: "match", citationIndex: null },
      { text: "f", kind: "plain", citationIndex: null },
    ]);
  });

  it("drops a match entirely swallowed by a citation", () => {
    const segments = buildSourceSegments("abcdef", [[1, 5]], [[2, 4]]);
    expect(segments.filter((s) => s.kind === "match")).toEqual([]);
  });

  it("preserves the text exactly — concatenating the runs returns the source", () => {
    const text = "  ลูกค้าต้องการจองห้อง\r\n\tstaff must see bookings\n";
    const segments = buildSourceSegments(text, [[2, 8]], findMatchRanges(text, "staff"));
    expect(segments.map((s) => s.text).join("")).toBe(text);
  });
});
