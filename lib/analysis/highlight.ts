/**
 * Which source references become a visible highlight in the analysis result
 * workspace, and which are silently skipped.
 *
 * A reference without verified offsets contributes no range — its excerpt was
 * confirmed to occur in the text, but no exact span was proven, and the UI never
 * claims a span it cannot show correctly (CLAUDE.md: never invent, never repair).
 *
 * The same module also cuts the source text into the runs the panel renders, so that
 * citations and find-in-document matches can share one document without either
 * corrupting the other.
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

export type Range = readonly [number, number];

/**
 * Every occurrence of `query` in `text`, case-insensitively — the source panel's
 * find-in-document. Empty and whitespace-only queries match nothing, so an empty search
 * box never lights the whole document up.
 */
export function findMatchRanges(text: string, query: string): Range[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const haystack = text.toLowerCase();
  const ranges: Range[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    ranges.push([at, at + needle.length] as const);
    from = at + needle.length;
  }
  return ranges;
}

export type SourceSegment = {
  text: string;
  kind: "plain" | "citation" | "match";
  /** Position of this citation among the item's citations — drives prev/next. */
  citationIndex: number | null;
};

/**
 * The source text cut into renderable runs.
 *
 * Two kinds of mark can want the same characters: the selected item's citation and a
 * find-in-document match. **Citation wins** — it is evidence, and evidence outranks a
 * transient search. Overlapping citations are skipped rather than merged, preserving the
 * rule the workspace has followed since slice 4: never render a span that would misstate
 * where a requirement came from.
 *
 * Offsets index the *stored* text, exactly as validated — see HANDOFF.md, "Verbatim text".
 */
export function buildSourceSegments(
  text: string,
  citations: readonly Range[],
  matches: readonly Range[] = [],
): SourceSegment[] {
  const marks: Array<{ start: number; end: number; kind: "citation" | "match"; index: number | null }> = [];

  let citationCursor = 0;
  let citationIndex = 0;
  for (const [start, end] of [...citations].sort((a, b) => a[0] - b[0])) {
    if (start < citationCursor || end <= start) continue;
    marks.push({ start, end, kind: "citation", index: citationIndex });
    citationIndex += 1;
    citationCursor = end;
  }

  for (const [start, end] of matches) {
    if (end <= start) continue;
    // Trim the match around every citation it touches; what survives still gets marked.
    let pieces: Array<[number, number]> = [[start, end]];
    for (const mark of marks.filter((m) => m.kind === "citation")) {
      const next: Array<[number, number]> = [];
      for (const [pieceStart, pieceEnd] of pieces) {
        if (mark.end <= pieceStart || mark.start >= pieceEnd) {
          next.push([pieceStart, pieceEnd]);
          continue;
        }
        if (pieceStart < mark.start) next.push([pieceStart, mark.start]);
        if (mark.end < pieceEnd) next.push([mark.end, pieceEnd]);
      }
      pieces = next;
    }
    for (const [pieceStart, pieceEnd] of pieces) {
      marks.push({ start: pieceStart, end: pieceEnd, kind: "match", index: null });
    }
  }

  marks.sort((a, b) => a.start - b.start);

  const segments: SourceSegment[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start > cursor) {
      segments.push({ text: text.slice(cursor, mark.start), kind: "plain", citationIndex: null });
    }
    segments.push({
      text: text.slice(mark.start, mark.end),
      kind: mark.kind,
      citationIndex: mark.index,
    });
    cursor = mark.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), kind: "plain", citationIndex: null });
  }

  return segments;
}
