/**
 * The Thai-ratio detector (Phase 2, Slice 6 of the "Usable Product" master plan) —
 * decides which concrete language a "match source" project resolves to. Code-decided,
 * never the AI: the model is told what language to write in, it is never asked to
 * guess (CLAUDE.md's "the AI assists, it never decides" applies here as much as
 * anywhere else in this product).
 *
 * Pure and DB-free, like `workspace-view.ts` — the same reason: a decision this
 * consequential (it picks the language every requirement in a run is written in) needs
 * to be testable without a browser or a database.
 */

/** Thai script — U+0E00 to U+0E7F. */
const THAI_CHAR = /[฀-๿]/g;

/** Unicode letters, any script — the denominator. Digits, punctuation and whitespace
 * are deliberately excluded: a note that is mostly numbers and Thai labels should
 * still read as Thai, not as "mostly non-letters, so English by default". */
const ANY_LETTER = /\p{L}/gu;

/** The master plan's own threshold: "Thai characters are more than ~30% of the notes". */
const THAI_RATIO_THRESHOLD = 0.3;

/**
 * `"en"` for empty or symbol-only text — there is nothing to match, and English is the
 * safer default for a source with no letters at all (an empty paste should not silently
 * flip a project to Thai).
 */
export function detectDominantLanguage(text: string): "th" | "en" {
  const letterCount = text.match(ANY_LETTER)?.length ?? 0;
  if (letterCount === 0) return "en";

  const thaiCount = text.match(THAI_CHAR)?.length ?? 0;
  return thaiCount / letterCount > THAI_RATIO_THRESHOLD ? "th" : "en";
}
