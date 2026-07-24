/**
 * Source highlight range selection for the analysis result workspace — which
 * references become a visible `<mark>` and which are silently skipped because no
 * exact span was proven for them.
 */

import { describe, expect, it } from "vitest";
import { computeHighlightRanges } from "../../lib/analysis/highlight";
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
