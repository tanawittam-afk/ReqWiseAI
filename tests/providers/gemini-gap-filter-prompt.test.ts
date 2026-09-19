import { describe, expect, it } from "vitest";
import {
  buildGapFilterPrompt,
  GEMINI_GAP_FILTER_PROMPT_VERSION,
} from "../../lib/providers/gemini/gap-filter-prompt";
import { bookingInput } from "../helpers";

describe("buildGapFilterPrompt", () => {
  it("includes the candidates verbatim and the application-owned rules", () => {
    const input = bookingInput();
    const candidates = [
      { key: "gap-0", text: "The team has not decided on the notification channel." },
    ];
    const prompt = buildGapFilterPrompt(candidates, input);

    expect(GEMINI_GAP_FILTER_PROMPT_VERSION).toBe("reqwise-gemini-gap-filter/1.0");
    expect(prompt).toContain("The team has not decided on the notification channel.");
    expect(prompt).toContain('"results"');
    expect(prompt).toContain("Do not return markdown fences");
    expect(prompt).toContain("Never invent a gap");
  });

  it("never merges into the main analysis contract — its own, smaller schema", () => {
    const prompt = buildGapFilterPrompt([{ key: "gap-0", text: "text" }], bookingInput());
    expect(prompt).not.toContain('"schema_version"');
    expect(prompt).not.toContain("Allowed relation types");
  });

  it("tells the provider is_gap:false candidates need no title or description", () => {
    const prompt = buildGapFilterPrompt([{ key: "gap-0", text: "text" }], bookingInput());
    expect(prompt).toContain("omit");
    expect(prompt).toContain("`title` and `description`");
  });
});
