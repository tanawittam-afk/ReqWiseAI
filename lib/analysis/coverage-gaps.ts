/**
 * Coverage-gap detection: the pure, code-only half of Phase 3 ("Gap check") — locating
 * where each item's excerpt actually sits in the source text, segmenting the source
 * into statement-level spans, and deciding which of those spans nothing cites.
 *
 * The AI step that filters these candidates down to genuine gaps (dropping chit-chat,
 * logistics, already-implied content) is a separate concern (a provider call) — this
 * file only ever produces *candidates*, never a verdict. No database, no provider, no
 * HTTP — same discipline as `run-analysis.ts`, testable deterministically.
 */

import type { AnalysisInput } from "../contracts/analysis-input";
import { gapFilterOutputSchema } from "../contracts/gap-filter-output";
import type { NormalizedItem } from "../contracts/normalized";
import type { AiProvider, GapCandidate } from "../providers/types";
import type { ItemPayload } from "./persist";
import type { RunAnalysisResult } from "./run-analysis";

export type TextRange = { start: number; end: number };

/** A span shorter than this is noise (a stray fragment from splitting), not a
 *  candidate worth sending to the AI filter — that step judges meaning, not length. */
const MIN_STATEMENT_LENGTH = 3;

/** A statement counts as covered once at least this fraction of its own length
 *  overlaps some cited range. Partial citation of a long statement still leaves most
 *  of it undiscussed by any requirement. */
const COVERAGE_OVERLAP_THRESHOLD = 0.5;

/**
 * Every occurrence of `excerpt` inside `rawText`, not just the first — a repeated
 * excerpt covers every place it appears (the master plan's own rule: "An excerpt
 * found in several places counts as covering all of them"). An excerpt not found at
 * all (the provider paraphrased, or offsets already existed and disagree) yields no
 * range — never throws; source text legitimately need not contain every citation
 * verbatim from every provider.
 */
export function locateExcerpt(excerpt: string, rawText: string): TextRange[] {
  if (excerpt.length === 0) return [];

  const ranges: TextRange[] = [];
  let from = 0;
  for (;;) {
    const index = rawText.indexOf(excerpt, from);
    if (index === -1) break;
    ranges.push({ start: index, end: index + excerpt.length });
    from = index + excerpt.length;
  }
  return ranges;
}

/** All covered ranges across every item's every source reference. */
export function coveredRanges(items: readonly NormalizedItem[], rawText: string): TextRange[] {
  const ranges: TextRange[] = [];
  for (const item of items) {
    for (const ref of item.sourceReferences) {
      ranges.push(...locateExcerpt(ref.excerpt, rawText));
    }
  }
  return ranges;
}

/**
 * Splits `rawText` into statement-level spans, offsets into `rawText` itself (not a
 * copy) so a caller can slice the original string back out. A heuristic, not a
 * semantic judgment — that is the AI filter's job downstream, not this function's:
 *
 *  - A newline is always a boundary. Meeting notes here are one topic per line (see
 *    `lib/providers/mock/fixtures/booking-smart-space.source.ts`), and Thai text
 *    commonly carries no sentence-ending punctuation at all — for a Thai paragraph
 *    with no `.`/`!`/`?`, the whole line becomes one statement, which is the correct
 *    granularity for this corpus style.
 *  - Within a line, `.`/`!`/`?` further split multi-sentence English paragraphs.
 *  - Leading/trailing whitespace is trimmed from each span, and empty or
 *    under-`MIN_STATEMENT_LENGTH` spans are dropped — noise a heuristic can safely
 *    discard, not a decision that needs the AI step.
 */
export function segmentStatements(rawText: string): TextRange[] {
  const statements: TextRange[] = [];
  for (const match of rawText.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const raw = match[0];
    const rawStart = match.index;
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length < MIN_STATEMENT_LENGTH) continue;
    const start = rawStart + leading;
    statements.push({ start, end: start + trimmed.length });
  }
  return statements;
}

function overlapLength(a: TextRange, b: TextRange): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/**
 * A statement is uncovered when no single covered range overlaps at least
 * `COVERAGE_OVERLAP_THRESHOLD` of its own length. Checked against each covered range
 * independently (not their union) — this keeps the rule simple and matches how
 * citations actually land in practice: one excerpt, one contiguous span.
 */
export function uncoveredStatements(
  statements: readonly TextRange[],
  covered: readonly TextRange[],
): TextRange[] {
  return statements.filter((statement) => {
    const length = statement.end - statement.start;
    if (length === 0) return false;
    const bestCoverage = covered.reduce(
      (best, range) => Math.max(best, overlapLength(statement, range)),
      0,
    );
    return bestCoverage / length < COVERAGE_OVERLAP_THRESHOLD;
  });
}

/**
 * The orchestration seam (Phase 3, Slice 5): code-locate → segment → find gaps →
 * ask the provider to filter them → shape survivors as `coverage_gap` item payloads,
 * ready to ride in `persistAnalysisResult()`'s own `p_items` array — the same run,
 * same transaction as the main analysis, never a second RPC.
 *
 * **Fail-open by design** (owner-confirmed): any failure here — a malformed source, a
 * provider error, output that fails `gapFilterOutputSchema` — is caught and logged,
 * and an empty array is returned. The main analysis is never affected; a real run
 * still happened and its slot is not refunded. The Quality tab's gap list is simply
 * empty for that run, never rendered as a guess.
 *
 * Returns `[]` immediately, with **no provider call**, whenever there are zero
 * candidate statements — most runs will hit this path, and it is the reason a gap
 * check never costs a second call on a well-covered source.
 */
export async function computeCoverageGapItems(
  provider: AiProvider,
  input: AnalysisInput,
  result: RunAnalysisResult,
): Promise<ItemPayload[]> {
  if (result.status !== "valid") return [];

  try {
    const rawText = input.sourceDocuments[0]?.text ?? "";
    if (rawText.length === 0) return [];

    const covered = coveredRanges(result.analysis.items, rawText);
    const statements = segmentStatements(rawText);
    const candidateRanges = uncoveredStatements(statements, covered);
    if (candidateRanges.length === 0) return [];

    const candidates: GapCandidate[] = candidateRanges.map((range, index) => ({
      key: `gap-${index}`,
      text: rawText.slice(range.start, range.end),
    }));
    const rangeByKey = new Map(candidates.map((candidate, index) => [candidate.key, candidateRanges[index]]));

    const generation = await provider.filterCoverageGaps(candidates, input);
    const parsed = gapFilterOutputSchema.safeParse(generation.raw);
    if (!parsed.success) {
      console.error("[analysis] coverage-gap filter output failed validation, continuing without it");
      return [];
    }

    const items: ItemPayload[] = [];
    for (const gap of parsed.data.results) {
      if (!gap.is_gap || gap.title === undefined || gap.description === undefined) continue;
      const range = rangeByKey.get(gap.key);
      if (!range) continue; // a key the provider invented — drop rather than guess

      items.push({
        local_key: gap.key,
        provider_key: gap.key,
        item_type: "coverage_gap",
        title: gap.title,
        description: gap.description,
        priority: "unassigned",
        evidence_class: "stated",
        origin: "quality_rule",
        // A binary yes/no judgment, not a graded extraction — 1.0 is the honest value,
        // the same reasoning `add_manual_requirement()` already applies to a human's
        // own judgment.
        confidence: 1.0,
        rationale: null,
        attributes: null,
        source_references: [
          {
            excerpt: rawText.slice(range.start, range.end),
            start_offset: range.start,
            end_offset: range.end,
            evidence_strength: null,
            offset_verified: true,
          },
        ],
      });
    }
    return items;
  } catch (error) {
    console.error(`[analysis] coverage-gap check failed, continuing without it: ${error}`);
    return [];
  }
}
