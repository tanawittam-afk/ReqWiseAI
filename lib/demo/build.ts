/**
 * Runs the real engine against the demo scenario — no database, no auth, no HTTP,
 * exactly like `runAnalysis()` itself promises. This is what makes the public demo
 * honest: the item a visitor reads is genuine validated output of the shipped
 * pipeline (provider → `validateAnalysis()` → `normalizeAnalysis()`), not a
 * hand-written picture of one.
 *
 * Memoized per language at module scope — the inputs are constants, so there is
 * nothing to recompute on a second call, whether that call comes from another
 * request or a second render on the same one.
 */

import type { OutputLang } from "../contracts/analysis-input";
import type { NormalizedAnalysis } from "../contracts/normalized";
import { bookingSmartSpaceProfile } from "../domain/profiles/booking-smart-space";
import { createMockProvider } from "../providers/mock/mock-provider";
import { runAnalysis } from "../analysis/run-analysis";
import { demoSourceDocument } from "./scenario";
import { demoPorts } from "./ports";

const cache = new Map<OutputLang, NormalizedAnalysis>();

export async function buildDemoRun(lang: OutputLang): Promise<NormalizedAnalysis> {
  const cached = cache.get(lang);
  if (cached) return cached;

  const source = demoSourceDocument(lang);
  const result = await runAnalysis(
    createMockProvider(),
    {
      domainProfile: bookingSmartSpaceProfile,
      sourceDocuments: [source],
      outputLang: lang,
    },
    demoPorts(),
  );

  if (result.status !== "valid") {
    // A failure here means the demo scenario itself stopped exercising the engine
    // cleanly — a content bug, not a visitor-facing error to recover from. Fail the
    // build/render loudly rather than show a broken demo.
    throw new Error(
      `demo scenario (${lang}) did not produce a valid analysis: ${
        result.status === "invalid" ? JSON.stringify(result.issues) : result.error.message
      }`,
    );
  }

  cache.set(lang, result.analysis);
  return result.analysis;
}
