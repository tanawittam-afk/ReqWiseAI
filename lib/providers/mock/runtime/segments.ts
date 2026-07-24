/**
 * Splitting a source document into citable spans, with exact offsets.
 *
 * Every offset produced here indexes into the **string that was passed in** — which
 * is the string the database returned, which is the string the browser submitted.
 * Nothing is normalised on the way through: LF stays LF, CRLF stays CRLF, tabs and
 * blank lines survive. That is not a nicety, it is the whole contract — a citation
 * is only evidence if `text.slice(start, end) === excerpt` holds against the stored
 * text (AI-OUTPUT-CONTRACT.md §D.5).
 *
 * Domain-blind by construction: nothing in this file knows what business the text is
 * about. Concept detection lives in `lexicon.ts`, item shaping in `strategy.ts`.
 */

/** A citable span. `text.slice(start, end) === excerpt` is guaranteed. */
export type Segment = {
  /** Position in the source, in the order they appear. Stable identity for a span. */
  index: number;
  excerpt: string;
  start: number;
  end: number;
};

/** Longest span a single citation may carry (the schema caps `excerpt` at 2000). */
export const MAX_EXCERPT = 500;

const WHITESPACE = /\s/;

/**
 * Narrows `[start, end)` to its non-whitespace core and caps its length, keeping the
 * offsets in step with the text. Returns null when the span is entirely whitespace.
 *
 * Trimming here is not optional bookkeeping: the provider schema applies `.trim()` to
 * `excerpt`, so a span with a trailing newline would arrive at validation shortened
 * while its offsets still described the longer span — and fail. Trimming first, and
 * moving both offsets with it, is what keeps the two in agreement.
 */
export function citeSpan(
  text: string,
  start: number,
  end: number,
  maxLength = MAX_EXCERPT,
): Segment | null {
  let from = Math.max(0, start);
  let to = Math.min(text.length, end);

  while (from < to && WHITESPACE.test(text[from])) from += 1;
  while (to > from && WHITESPACE.test(text[to - 1])) to -= 1;
  if (from >= to) return null;

  if (to - from > maxLength) {
    to = from + maxLength;
    // Capping can land on whitespace; re-trim the tail so the invariant still holds.
    while (to > from && WHITESPACE.test(text[to - 1])) to -= 1;
    if (from >= to) return null;
  }

  return { index: 0, excerpt: text.slice(from, to), start: from, end: to };
}

/**
 * Line-based segmentation.
 *
 * Lines are the unit a person actually writes meeting notes in, and — unlike
 * sentence splitting — they work identically for Thai, which does not terminate
 * sentences with a period. Blank lines are dropped as segments but still consume
 * their offsets, so segment N's offsets are absolute, never cumulative-relative.
 *
 * Handles CRLF, LF and lone CR without rewriting any of them.
 */
export function segmentSource(text: string): Segment[] {
  const segments: Segment[] = [];
  let lineStart = 0;
  let cursor = 0;

  const push = (from: number, to: number) => {
    const span = citeSpan(text, from, to);
    if (span) segments.push({ ...span, index: segments.length });
  };

  while (cursor < text.length) {
    const char = text[cursor];
    if (char === "\n" || char === "\r") {
      push(lineStart, cursor);
      // CRLF is one break, not two.
      cursor += char === "\r" && text[cursor + 1] === "\n" ? 2 : 1;
      lineStart = cursor;
      continue;
    }
    cursor += 1;
  }
  push(lineStart, text.length);

  return segments;
}

/**
 * The first segment that satisfies `predicate`, or null.
 *
 * Deliberately first-match rather than best-match: when a document repeats the same
 * sentence, "the first occurrence" is a rule a reader can verify by eye, and the
 * offsets belong to that specific occurrence because each segment carries its own.
 * Nothing here ever calls `indexOf` on the excerpt — that is the bug this shape
 * exists to make impossible.
 */
export function firstMatch(
  segments: readonly Segment[],
  predicate: (segment: Segment) => boolean,
): Segment | null {
  for (const segment of segments) {
    if (predicate(segment)) return segment;
  }
  return null;
}

/**
 * The highest-scoring segment, ties broken by earliest position.
 *
 * `>` rather than `>=` is what makes the tie-break "earliest wins", and that is what
 * makes the choice deterministic for a document containing two identical lines.
 */
export function bestMatch(
  segments: readonly Segment[],
  score: (segment: Segment) => number,
): Segment | null {
  let best: Segment | null = null;
  let bestScore = 0;

  for (const segment of segments) {
    const value = score(segment);
    if (value > bestScore) {
      best = segment;
      bestScore = value;
    }
  }
  return best;
}
