import { describe, expect, it } from "vitest";
import { buildGeminiPrompt, GEMINI_PROMPT_VERSION } from "../../lib/providers/gemini/prompt";
import { bookingInput } from "../helpers";

describe("buildGeminiPrompt", () => {
  it("includes the source verbatim and the application-owned rules", () => {
    const input = bookingInput();
    const prompt = buildGeminiPrompt(input);

    expect(GEMINI_PROMPT_VERSION).toBe("reqwise-gemini/1.0");
    expect(prompt).toContain(input.sourceDocuments[0].text);
    expect(prompt).toContain(input.domainProfile.name);
    expect(prompt).toContain('"schema_version"');
    expect(prompt).toContain("Never approve a requirement");
    expect(prompt).toContain("rawText.slice(start_offset, end_offset) === excerpt");
    expect(prompt).toContain("Do not return markdown fences");
    expect(prompt).not.toMatch(/chain of thought/i);
  });

  it("keeps domain guidance distinct from direct evidence", () => {
    const prompt = buildGeminiPrompt(bookingInput());

    expect(prompt).toContain("Domain guidance is context, not direct source evidence");
    expect(prompt).toContain("assumed items have no source_references");
  });

  it("includes each keyed source exactly once", () => {
    const input = {
      ...bookingInput(),
      sourceDocuments: [
        { key: "source-a", id: "source-a-id", title: "Source A", text: "unique evidence alpha" },
        { key: "source-b", id: "source-b-id", title: "Source B", text: "unique evidence beta" },
      ],
    };

    const prompt = buildGeminiPrompt(input);

    expect(prompt).toContain("Source key: source-a\nTitle: Source A\nrawText:\nunique evidence alpha");
    expect(prompt).toContain("Source key: source-b\nTitle: Source B\nrawText:\nunique evidence beta");
    expect(prompt.split("unique evidence alpha")).toHaveLength(2);
    expect(prompt.split("unique evidence beta")).toHaveLength(2);
  });
});
