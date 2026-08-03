/**
 * The public demo's engine run — genuine `runAnalysis()` output, not a fixture. These
 * tests are what stands between a content edit in `lib/demo/scenario.ts` and a broken
 * public page: a validation regression here fails CI, not a recruiter's browser.
 */

import { describe, expect, it } from "vitest";
import { buildDemoRun } from "../../lib/demo/build";
import { demoSourceText } from "../../lib/demo/scenario";
import { toDemoHistory, toDemoSourceDetail, toDemoWorkspaceRun } from "../../lib/demo/view";
import type { OutputLang } from "../../lib/contracts/analysis-input";

const LANGS: OutputLang[] = ["th", "en"];

describe.each(LANGS)("demo scenario (%s)", (lang) => {
  it("produces a valid, non-trivial analysis", async () => {
    const analysis = await buildDemoRun(lang);
    expect(analysis.items.length).toBeGreaterThanOrEqual(8);
    expect(analysis.items.length).toBeLessThanOrEqual(20);
  });

  it("cites only exact substrings of the source text", async () => {
    const analysis = await buildDemoRun(lang);
    const text = demoSourceText(lang);
    const cited = analysis.items.flatMap((item) => item.sourceReferences);
    expect(cited.length).toBeGreaterThan(0);
    for (const ref of cited) {
      expect(ref.offsetVerified).toBe(true);
      expect(ref.startOffset).toBeDefined();
      expect(ref.endOffset).toBeDefined();
      expect(text.slice(ref.startOffset!, ref.endOffset!)).toBe(ref.excerpt);
    }
  });

  it("gives every inferred or assumed item a rationale", async () => {
    const analysis = await buildDemoRun(lang);
    const unsupported = analysis.items.filter(
      (item) => item.evidenceClass === "inferred" || item.evidenceClass === "assumed",
    );
    expect(unsupported.length).toBeGreaterThan(0);
    for (const item of unsupported) {
      expect(item.rationale?.trim()).toBeTruthy();
    }
  });

  it("starts every item as draft — nothing is ever auto-approved", async () => {
    const analysis = await buildDemoRun(lang);
    for (const item of analysis.items) {
      expect(item.status).toBe("draft");
    }
  });

  it("is deterministic — a second call returns byte-identical item titles", async () => {
    const first = await buildDemoRun(lang);
    const second = await buildDemoRun(lang);
    expect(second.items.map((i) => i.title)).toEqual(first.items.map((i) => i.title));
  });
});

describe("demo view mapping", () => {
  it("gives every item an honestly empty history — nothing was ever reviewed", async () => {
    const analysis = await buildDemoRun("th");
    const history = toDemoHistory(analysis);
    for (const item of analysis.items) {
      expect(history[item.id]).toEqual({ versions: [], activities: [] });
    }
  });

  it("marks open_question and quality_finding items 'open', and nothing else", async () => {
    const analysis = await buildDemoRun("th");
    const run = toDemoWorkspaceRun(analysis);
    for (const item of run.items) {
      if (item.type === "open_question" || item.type === "quality_finding") {
        expect(item.workflowState).toBe("open");
      } else {
        expect(item.workflowState).toBeNull();
      }
    }
  });

  it("never fabricates a change request or a candidate outside a real raises_question edge", async () => {
    const analysis = await buildDemoRun("th");
    const run = toDemoWorkspaceRun(analysis);
    for (const item of run.items) {
      expect(item.changeRequests).toEqual([]);
    }
  });

  it("builds a source detail whose rawText matches the scenario exactly", () => {
    const source = toDemoSourceDetail("en");
    expect(source.rawText).toBe(demoSourceText("en"));
    expect(source.locked).toBe(true);
  });
});
