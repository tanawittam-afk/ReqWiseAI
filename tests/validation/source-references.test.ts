import { describe, expect, it } from "vitest";
import { checkSourceReferences, refSlot } from "../../lib/validation/source-references";
import type { ProviderOutput } from "../../lib/contracts/provider-output";
import type { SourceDocumentInput } from "../../lib/contracts/analysis-input";

const doc: SourceDocumentInput = {
  key: "s1",
  id: "src-1",
  title: "t",
  text: "hello brave new world",
};
//        0     6     12  16
const docs = [doc];

function withRef(ref: Record<string, unknown>): ProviderOutput {
  return {
    schema_version: "1.0.0",
    items: [
      {
        key: "i-1",
        type: "business_requirement",
        title: "t",
        description: "d",
        evidence_class: "stated",
        origin: "source_analysis",
        confidence: 0.5,
        source_references: [ref],
        related_item_keys: [],
      },
    ],
  } as unknown as ProviderOutput;
}

describe("source reference validation — exact offsets", () => {
  it("verifies a matching span", () => {
    const start = doc.text.indexOf("brave");
    const result = checkSourceReferences(
      withRef({ source_document_key: "s1", excerpt: "brave", start_offset: start, end_offset: start + 5 }),
      docs,
    );
    expect(result.issues).toHaveLength(0);
    expect(result.offsetVerified.get(refSlot(0, 0))).toBe(true);
  });

  it("rejects an excerpt that does not match the span", () => {
    const result = checkSourceReferences(
      withRef({ source_document_key: "s1", excerpt: "world", start_offset: 0, end_offset: 5 }),
      docs,
    );
    expect(result.issues.some((i) => i.code === "excerpt_offset_mismatch")).toBe(true);
    expect(result.offsetVerified.get(refSlot(0, 0))).toBe(false);
  });

  it("rejects an end offset beyond the source length", () => {
    const result = checkSourceReferences(
      withRef({ source_document_key: "s1", excerpt: "x", start_offset: 0, end_offset: 9999 }),
      docs,
    );
    expect(result.issues.some((i) => i.code === "offset_out_of_range")).toBe(true);
  });

  it("rejects a non-increasing range", () => {
    const result = checkSourceReferences(
      withRef({ source_document_key: "s1", excerpt: "x", start_offset: 5, end_offset: 5 }),
      docs,
    );
    expect(result.issues.some((i) => i.code === "offset_range_invalid")).toBe(true);
  });

  it("rejects a reference to an unknown source document", () => {
    const result = checkSourceReferences(
      withRef({ source_document_key: "does-not-exist", excerpt: "hello", start_offset: 0, end_offset: 5 }),
      docs,
    );
    expect(result.issues.some((i) => i.code === "unknown_source_document")).toBe(true);
  });
});

describe("source reference validation — no offsets", () => {
  it("accepts an excerpt that occurs in the source but does not claim offset verification", () => {
    const result = checkSourceReferences(
      withRef({ source_document_key: "s1", excerpt: "brave new" }),
      docs,
    );
    expect(result.issues).toHaveLength(0);
    // The distinction the contract insists on: found, but no exact span proven.
    expect(result.offsetVerified.get(refSlot(0, 0))).toBe(false);
  });

  it("rejects an excerpt that does not occur in the source at all", () => {
    const result = checkSourceReferences(
      withRef({ source_document_key: "s1", excerpt: "not in the text" }),
      docs,
    );
    expect(result.issues.some((i) => i.code === "excerpt_not_found")).toBe(true);
  });
});
