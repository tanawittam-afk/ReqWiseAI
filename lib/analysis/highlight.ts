/**
 * Which source references become a visible highlight in the analysis result
 * workspace, and which are silently skipped.
 *
 * A reference without verified offsets contributes no range — its excerpt was
 * confirmed to occur in the text, but no exact span was proven, and the UI never
 * claims a span it cannot show correctly (CLAUDE.md: never invent, never repair).
 */

import type { AnalysisItemView } from "./queries";

export function computeHighlightRanges(
  item: Pick<AnalysisItemView, "sourceReferences"> | null,
): Array<readonly [number, number]> {
  return (item?.sourceReferences ?? [])
    .filter((ref) => ref.offsetVerified && ref.startOffset !== null && ref.endOffset !== null)
    .map((ref) => [ref.startOffset as number, ref.endOffset as number] as const)
    .sort((a, b) => a[0] - b[0]);
}
