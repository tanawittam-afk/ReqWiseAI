/**
 * The mock provider's gap-filter step (Phase 3, Slice 4) — deterministic, rule-based,
 * same discipline as `strategy.ts`: no `Date.now`, no `Math.random`, no network, a
 * pure function of its input.
 *
 * Real Gemini judges meaning; this cannot. What it can do honestly is drop the
 * mechanical noise a heuristic segmenter lets through — greetings, scheduling
 * logistics, meta-commentary about the meeting itself — and keep everything else as a
 * candidate gap. A false positive here costs a reviewer one glance at the Quality tab;
 * a false negative hides a real gap, which is the worse failure to test against.
 */

import type { GapCandidate } from "../../types";

const TITLE_MAX = 160;

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** Thai and English chit-chat/logistics markers — meeting mechanics, not requirements. */
const NOISE_MARKERS = [
  // English
  "good morning",
  "good afternoon",
  "thanks for joining",
  "let's get started",
  "see you next time",
  "attendees:",
  "agenda:",
  // Thai — greetings, attendee lists, scheduling housekeeping.
  "สวัสดี",
  "ขอบคุณที่",
  "ผู้เข้าร่วม",
  "วันที่ประชุม",
  "นัดครั้งหน้า",
];

const MIN_GAP_LENGTH = 8;

function isNoise(text: string): boolean {
  const lower = text.toLowerCase();
  if (text.trim().length < MIN_GAP_LENGTH) return true;
  return NOISE_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
}

export type MockGapFilterResult = {
  key: string;
  is_gap: boolean;
  title?: string;
  description?: string;
};

/** Deterministic and DB-free, same convention as `generateRuntimeAnalysis`. */
export function filterGapCandidates(candidates: readonly GapCandidate[]): { results: MockGapFilterResult[] } {
  const results = candidates.map((candidate) => {
    if (isNoise(candidate.text)) {
      return { key: candidate.key, is_gap: false };
    }
    return {
      key: candidate.key,
      is_gap: true,
      title: clip(candidate.text, TITLE_MAX),
      description: `The source discusses this, but no requirement in this run currently covers it: "${clip(candidate.text, 300)}"`,
    };
  });
  return { results };
}
