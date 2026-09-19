/**
 * The pure, code-only half of Phase 3's gap check: excerpt location, statement
 * segmentation, and uncovered-statement detection. No AI, no database — the rules
 * worth protecting are the honest ones: a repeated excerpt covers every occurrence,
 * a not-found excerpt never throws, and a partially-cited statement still counts as
 * uncovered when most of it is undiscussed.
 */

import { describe, expect, it } from "vitest";
import {
  computeCoverageGapItems,
  coveredRanges,
  locateExcerpt,
  segmentStatements,
  uncoveredStatements,
} from "../../lib/analysis/coverage-gaps";
import type { AnalysisInput } from "../../lib/contracts/analysis-input";
import type { NormalizedItem } from "../../lib/contracts/normalized";
import type { AiProvider, GapCandidate, ProviderGeneration } from "../../lib/providers/types";
import type { RunAnalysisResult } from "../../lib/analysis/run-analysis";
import { bookingSmartSpaceProfile } from "../../lib/domain/profiles/booking-smart-space";

function itemWithRefs(excerpts: string[]): NormalizedItem {
  return {
    id: "id-1",
    displayId: "FR-001",
    providerKey: "key-1",
    type: "functional_requirement",
    title: "A requirement",
    description: "",
    priority: "medium",
    status: "draft",
    versionNo: 1,
    evidenceClass: "stated",
    origin: "source_analysis",
    confidence: 0.8,
    sourceReferences: excerpts.map((excerpt) => ({
      id: `ref-${excerpt}`,
      sourceDocumentId: "src-1",
      sourceDocumentKey: "key-1",
      excerpt,
      offsetVerified: false,
    })),
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
  };
}

describe("locateExcerpt", () => {
  it("finds a single occurrence", () => {
    const rawText = "You may cancel any time.";
    const result = locateExcerpt("cancel", rawText);
    expect(result).toEqual([{ start: rawText.indexOf("cancel"), end: rawText.indexOf("cancel") + 6 }]);
  });

  it("finds every occurrence of a repeated excerpt", () => {
    const result = locateExcerpt("ab", "ab cd ab ef ab");
    expect(result).toEqual([
      { start: 0, end: 2 },
      { start: 6, end: 8 },
      { start: 12, end: 14 },
    ]);
  });

  it("returns empty, never throws, when the excerpt is not found", () => {
    const result = locateExcerpt("nonexistent phrase", "some other text entirely");
    expect(result).toEqual([]);
  });

  it("returns empty for an empty excerpt rather than matching everywhere", () => {
    expect(locateExcerpt("", "any text")).toEqual([]);
  });
});

describe("coveredRanges", () => {
  it("aggregates ranges across multiple items and references", () => {
    const rawText = "First topic here. Second topic here.";
    const items = [itemWithRefs(["First topic"]), itemWithRefs(["Second topic"])];
    const result = coveredRanges(items, rawText);
    expect(result).toEqual([
      { start: rawText.indexOf("First topic"), end: rawText.indexOf("First topic") + 11 },
      { start: rawText.indexOf("Second topic"), end: rawText.indexOf("Second topic") + 12 },
    ]);
  });

  it("returns empty for items with no source references", () => {
    expect(coveredRanges([itemWithRefs([])], "some text")).toEqual([]);
  });
});

describe("segmentStatements", () => {
  it("splits a simple multi-sentence text on terminators", () => {
    const rawText = "First sentence. Second sentence! Third one?";
    const result = segmentStatements(rawText);
    expect(result.map((r) => rawText.slice(r.start, r.end))).toEqual([
      "First sentence.",
      "Second sentence!",
      "Third one?",
    ]);
  });

  it("trims leading and trailing whitespace from each span", () => {
    const rawText = "  Padded statement.   Another one.  ";
    const result = segmentStatements(rawText);
    expect(result.map((r) => rawText.slice(r.start, r.end))).toEqual([
      "Padded statement.",
      "Another one.",
    ]);
  });

  it("returns nothing for an empty string", () => {
    expect(segmentStatements("")).toEqual([]);
  });

  it("treats a newline as a hard boundary even without terminating punctuation — the Thai case", () => {
    const rawText = [
      "ความต้องการหลักคืออยากให้ลูกค้าจองเองได้จากมือถือ และเห็นห้องว่างแบบเรียลไทม์",
      "คุณต้นเสริมว่าหน้าร้านยังต้องรับลูกค้า walk-in ได้อยู่",
    ].join("\n");
    const result = segmentStatements(rawText);
    expect(result).toHaveLength(2);
    expect(rawText.slice(result[0].start, result[0].end)).toBe(
      "ความต้องการหลักคืออยากให้ลูกค้าจองเองได้จากมือถือ และเห็นห้องว่างแบบเรียลไทม์",
    );
    expect(rawText.slice(result[1].start, result[1].end)).toBe(
      "คุณต้นเสริมว่าหน้าร้านยังต้องรับลูกค้า walk-in ได้อยู่",
    );
  });

  it("drops stray fragments shorter than the minimum statement length", () => {
    const rawText = "K. Here is a real statement worth keeping.";
    const result = segmentStatements(rawText);
    expect(result.map((r) => rawText.slice(r.start, r.end))).toEqual([
      "Here is a real statement worth keeping.",
    ]);
  });
});

describe("uncoveredStatements", () => {
  it("excludes a fully covered statement", () => {
    const statement = { start: 0, end: 20 };
    const result = uncoveredStatements([statement], [{ start: 0, end: 20 }]);
    expect(result).toEqual([]);
  });

  it("includes a fully uncovered statement", () => {
    const statement = { start: 0, end: 20 };
    const result = uncoveredStatements([statement], [{ start: 100, end: 120 }]);
    expect(result).toEqual([statement]);
  });

  it("includes a statement whose covered overlap is under the 50% threshold", () => {
    const statement = { start: 0, end: 20 };
    // covers [0,5) — 5 of 20 chars, 25%
    const result = uncoveredStatements([statement], [{ start: 0, end: 5 }]);
    expect(result).toEqual([statement]);
  });

  it("excludes a statement whose covered overlap is at or above the 50% threshold", () => {
    const statement = { start: 0, end: 20 };
    // covers [0,10) — exactly 50%
    const result = uncoveredStatements([statement], [{ start: 0, end: 10 }]);
    expect(result).toEqual([]);
  });

  it("returns empty when there are no statements", () => {
    expect(uncoveredStatements([], [{ start: 0, end: 10 }])).toEqual([]);
  });
});

function inputWithText(text: string): AnalysisInput {
  return {
    domainProfile: bookingSmartSpaceProfile,
    sourceDocuments: [{ key: "src-1", id: "src-1", title: "Notes", text }],
    outputLang: "en",
  };
}

function validResult(items: NormalizedItem[] = []): RunAnalysisResult {
  return {
    status: "valid",
    raw: {},
    analysis: {
      schemaVersion: "1.0.0",
      items,
      relations: [],
      summary: { itemCount: items.length, unresolvedQuestionCount: 0, lowConfidenceCount: 0 },
    },
    metadata: { provider: "mock", model: null, promptVersion: null },
  };
}

function fakeProvider(
  filter: (candidates: GapCandidate[]) => Promise<ProviderGeneration> | ProviderGeneration,
): AiProvider {
  return {
    name: "mock",
    deterministic: true,
    async generate() {
      throw new Error("not used in these tests");
    },
    async filterCoverageGaps(candidates: GapCandidate[]) {
      return filter(candidates);
    },
  };
}

describe("computeCoverageGapItems", () => {
  it("returns [] and never calls the provider when the run is not valid", async () => {
    let called = false;
    const provider = fakeProvider(() => {
      called = true;
      return { raw: { results: [] }, metadata: { provider: "mock", model: null, promptVersion: null } };
    });
    const invalidResult: RunAnalysisResult = {
      status: "invalid",
      raw: {},
      issues: [],
      metadata: { provider: "mock", model: null, promptVersion: null },
    };

    const items = await computeCoverageGapItems(provider, inputWithText("Some text."), invalidResult);
    expect(items).toEqual([]);
    expect(called).toBe(false);
  });

  it("returns [] and never calls the provider when there are zero candidates", async () => {
    let called = false;
    const provider = fakeProvider(() => {
      called = true;
      return { raw: { results: [] }, metadata: { provider: "mock", model: null, promptVersion: null } };
    });
    const text = "The only statement here.";
    const items = await computeCoverageGapItems(
      provider,
      inputWithText(text),
      validResult([itemWithRefs([text])]),
    );
    expect(items).toEqual([]);
    expect(called).toBe(false);
  });

  it("builds a coverage_gap item payload from a genuine gap", async () => {
    const text = "This topic is never covered by any requirement in this run.";
    const provider = fakeProvider((candidates) => ({
      raw: {
        results: candidates.map((c) => ({
          key: c.key,
          is_gap: true,
          title: "Uncovered topic",
          description: "The source discusses this but nothing covers it.",
        })),
      },
      metadata: { provider: "mock", model: null, promptVersion: null },
    }));

    const items = await computeCoverageGapItems(provider, inputWithText(text), validResult([]));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      item_type: "coverage_gap",
      origin: "quality_rule",
      evidence_class: "stated",
      priority: "unassigned",
      title: "Uncovered topic",
      description: "The source discusses this but nothing covers it.",
    });
    expect(items[0].source_references).toEqual([
      {
        excerpt: text,
        start_offset: 0,
        end_offset: text.length,
        evidence_strength: null,
        offset_verified: true,
      },
    ]);
  });

  it("drops a candidate the provider marked is_gap: false", async () => {
    const text = "A candidate that turns out to be chit-chat, not a real gap.";
    const provider = fakeProvider((candidates) => ({
      raw: { results: candidates.map((c) => ({ key: c.key, is_gap: false })) },
      metadata: { provider: "mock", model: null, promptVersion: null },
    }));

    const items = await computeCoverageGapItems(provider, inputWithText(text), validResult([]));
    expect(items).toEqual([]);
  });

  it("fails open — invalid provider output yields [] rather than throwing", async () => {
    const text = "A candidate statement long enough to become a gap.";
    const provider = fakeProvider(() => ({
      raw: { not: "the right shape at all" },
      metadata: { provider: "mock", model: null, promptVersion: null },
    }));

    const items = await computeCoverageGapItems(provider, inputWithText(text), validResult([]));
    expect(items).toEqual([]);
  });

  it("fails open — a provider that throws yields [] rather than propagating", async () => {
    const text = "A candidate statement long enough to become a gap.";
    const provider = fakeProvider(() => {
      throw new Error("provider exploded");
    });

    const items = await computeCoverageGapItems(provider, inputWithText(text), validResult([]));
    expect(items).toEqual([]);
  });

  it("drops a result whose key the provider invented, matching no real candidate", async () => {
    const text = "A candidate statement long enough to become a gap.";
    const provider = fakeProvider(() => ({
      raw: {
        results: [
          { key: "not-a-real-key", is_gap: true, title: "Fake", description: "Hallucinated key." },
        ],
      },
      metadata: { provider: "mock", model: null, promptVersion: null },
    }));

    const items = await computeCoverageGapItems(provider, inputWithText(text), validResult([]));
    expect(items).toEqual([]);
  });
});
